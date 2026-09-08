import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { ActionResult } from "@prisma/client";
import { calculateContactCompleteness } from "@/lib/scoring";
import Papa from "papaparse";
import {
    extractPhones,
    normalizeEmail,
    normalizeWebsite,
    normalizeCompanyName,
    parseCsvDate,
    splitMultiActionCell,
} from "@/lib/csv/sanitizer";

// ============================================
// CSV IMPORT API (streaming + batched for performance)
// ============================================
// Accepts multipart/form-data: file (raw CSV), mappings (JSON), importType.
// Either: listId (add to existing list) OR missionId + listName (create new list).
// whenAlreadyWorkedOn: "skip" | "add_anyway" — when adding to existing list, skip rows whose company already has actions.
// Uses RFC 4180 compliant parsing via PapaParse, cached batch queries to avoid O(N^2) load,
// and bulk updates to prevent connection pool exhaustion.
// ============================================

const BATCH_SIZE = 1000;

type ActionColumnMode = "single" | "multi-column";
type ActionColumnGroup = {
    id?: string;
    statusColumn?: string;
    dateColumn?: string;
    noteColumn?: string;
    channelColumn?: string;
    callbackDateColumn?: string;
};

interface CompanyCacheItem {
    id: string;
    name: string;
    hasActions: boolean;
}

function normalizePersonName(value: string | null | undefined): string {
    return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Extract company data from a row using mappings */
function extractCompanyFromRow(
    row: Record<string, string>,
    mappings: { csvColumn: string; targetField: string }[]
): {
    companyData: Record<string, string>;
    companyCustomData: Record<string, string>;
    hasCompanyData: boolean;
    additionalPhones: string[];
} {
    const companyData: Record<string, string> = {};
    const companyCustomData: Record<string, string> = {};
    let hasCompanyData = false;
    const standardFields = ["name", "industry", "country", "website", "size", "phone"];
    const additionalPhones: string[] = [];

    for (const mapping of mappings) {
        if (!mapping.targetField.startsWith("company.")) continue;
        const field = mapping.targetField.replace("company.", "");
        const value = row[mapping.csvColumn];
        if (!value) continue;
        if (field === "additionalPhones") {
            additionalPhones.push(value.trim());
        } else if (standardFields.includes(field)) {
            companyData[field] = value.trim();
        } else {
            companyCustomData[field] = value.trim();
        }
        hasCompanyData = true;
    }
    return { companyData, companyCustomData, hasCompanyData, additionalPhones };
}

/** Extract contact data from a row using mappings */
function extractContactFromRow(
    row: Record<string, string>,
    mappings: { csvColumn: string; targetField: string }[]
): {
    contactData: Record<string, string>;
    contactCustomData: Record<string, string>;
    hasContactData: boolean;
    additionalPhones: string[];
} {
    const contactData: Record<string, string> = {};
    const contactCustomData: Record<string, string> = {};
    let hasContactData = false;
    const standardFields = ["firstName", "lastName", "email", "phone", "title", "linkedin"];
    const phoneColumns: string[] = [];
    const additionalPhones: string[] = [];

    for (const mapping of mappings) {
        if (!mapping.targetField.startsWith("contact.")) continue;
        const field = mapping.targetField.replace("contact.", "");
        const value = row[mapping.csvColumn];
        if (!value) continue;
        const trimmed = value.trim();

        if (field === "phone") {
            phoneColumns.push(trimmed);
        } else if (field === "additionalPhones") {
            additionalPhones.push(trimmed);
        } else if (standardFields.includes(field)) {
            contactData[field] = trimmed;
        } else {
            contactCustomData[field] = trimmed;
        }
        hasContactData = true;
    }

    if (phoneColumns.length > 0) {
        contactData.phone = phoneColumns[0];
        if (phoneColumns.length > 1) {
            additionalPhones.push(...phoneColumns.slice(1));
        }
    }

    return { contactData, contactCustomData, hasContactData, additionalPhones };
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== "MANAGER") {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const contentType = req.headers.get("content-type") ?? "";
        if (!contentType.includes("multipart/form-data")) {
            return NextResponse.json(
                { success: false, error: "Content-Type doit être multipart/form-data" },
                { status: 400 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const listIdParam = formData.get("listId") as string | null;
        const missionIdParam = formData.get("missionId") as string | null;
        const listName = formData.get("listName") as string | null;
        const mappingsStr = formData.get("mappings") as string | null;
        const importType = (formData.get("importType") as string) || "companies-contacts";
        const totalRowsStr = formData.get("totalRows") as string | null;
        const totalRows = totalRowsStr ? parseInt(totalRowsStr, 10) : null;
        const importActionsStr = formData.get("importActions") as string | null;
        const actionColumnMappingStr = formData.get("actionColumnMapping") as string | null;
        const actionColumnModeStr = formData.get("actionColumnMode") as string | null;
        const actionColumnGroupsStr = formData.get("actionColumnGroups") as string | null;
        const statusMappingsStr = formData.get("statusMappings") as string | null;
        const channelMappingsStr = formData.get("channelMappings") as string | null;
        const whenAlreadyWorkedOn = (formData.get("whenAlreadyWorkedOn") as string) || "add_anyway";
        const assignedSdrIdParam = (formData.get("assignedSdrId") as string | null)?.trim() || null;

        if (!file || !mappingsStr) {
            return NextResponse.json(
                { success: false, error: "Données manquantes (file, mappings)" },
                { status: 400 }
            );
        }
        const addToExistingList = !!listIdParam?.trim();
        if (addToExistingList) {
            if (!listIdParam?.trim()) {
                return NextResponse.json(
                    { success: false, error: "listId requis pour ajouter à une liste existante" },
                    { status: 400 }
                );
            }
        } else {
            if (!missionIdParam?.trim() || !listName?.trim()) {
                return NextResponse.json(
                    { success: false, error: "Données manquantes (missionId et listName pour une nouvelle liste)" },
                    { status: 400 }
                );
            }
        }

        let mappings: { csvColumn: string; targetField: string }[];
        try {
            mappings = JSON.parse(mappingsStr) as { csvColumn: string; targetField: string }[];
        } catch {
            return NextResponse.json(
                { success: false, error: "mappings invalide (JSON attendu)" },
                { status: 400 }
            );
        }

        const importActions = importActionsStr === "true";
        let actionColumnMapping: {
            statusColumn?: string;
            dateColumn?: string;
            callbackDateColumn?: string;
            noteColumn?: string;
            channelColumn?: string;
        } | null = null;
        let actionColumnMode: ActionColumnMode = "single";
        let actionColumnGroups: ActionColumnGroup[] = [];
        let statusMappings: { csvValue: string; actionResult: ActionResult; count: number }[] = [];
        let channelMappings: { csvValue: string; channel: "CALL" | "EMAIL" | "LINKEDIN"; count: number }[] = [];

        if (actionColumnMappingStr) {
            try {
                actionColumnMapping = JSON.parse(actionColumnMappingStr) as typeof actionColumnMapping;
            } catch {
                actionColumnMapping = null;
            }
        }
        if (statusMappingsStr) {
            try {
                statusMappings = JSON.parse(statusMappingsStr) as typeof statusMappings;
            } catch {
                statusMappings = [];
            }
        }
        if (channelMappingsStr) {
            try {
                channelMappings = JSON.parse(channelMappingsStr) as typeof channelMappings;
            } catch {
                channelMappings = [];
            }
        }
        if (actionColumnModeStr === "multi-column") {
            actionColumnMode = "multi-column";
        }
        if (actionColumnGroupsStr) {
            try {
                const parsed = JSON.parse(actionColumnGroupsStr) as ActionColumnGroup[];
                actionColumnGroups = Array.isArray(parsed) ? parsed : [];
            } catch {
                actionColumnGroups = [];
            }
        }

        let assignedSdrId = session.user.id;
        if (assignedSdrIdParam) {
            const assignee = await prisma.user.findFirst({
                where: {
                    id: assignedSdrIdParam,
                    isActive: true,
                    role: { in: ["SDR", "BUSINESS_DEVELOPER"] },
                },
                select: { id: true },
            });
            if (!assignee) {
                return NextResponse.json(
                    { success: false, error: "SDR d'assignation invalide" },
                    { status: 400 }
                );
            }
            assignedSdrId = assignee.id;
        }

        let list: { id: string; missionId: string };
        let missionId: string;

        if (addToExistingList) {
            const existingList = await prisma.list.findUnique({
                where: { id: listIdParam!.trim() },
                select: { id: true, missionId: true },
            });
            if (!existingList) {
                return NextResponse.json(
                    { success: false, error: "Liste existante non trouvée" },
                    { status: 404 }
                );
            }
            list = existingList;
            missionId = existingList.missionId;
        } else {
            const mission = await prisma.mission.findUnique({
                where: { id: missionIdParam! },
            });
            if (!mission) {
                return NextResponse.json(
                    { success: false, error: "Mission non trouvée" },
                    { status: 404 }
                );
            }
            missionId = missionIdParam!;
            const created = await prisma.list.create({
                data: {
                    name: listName!,
                    type: "CLIENT",
                    source: "CSV Import",
                    missionId,
                    importConfig: {
                        importType,
                        mappings,
                        importedAt: new Date().toISOString(),
                        actionHistory: {
                            importActions,
                            actionColumnMapping,
                            actionColumnMode,
                            actionColumnGroups,
                            statusMappings,
                            channelMappings,
                        },
                    },
                },
            });
            list = created;
        }

        // Shared in-memory caches across batches to avoid O(N^2) round trips
        const companyCache = new Map<string, CompanyCacheItem>();
        let cachedCampaignId: string | null = null;

        let companiesCreated = 0;
        let contactsCreated = 0;
        let actionsCreated = 0;
        const errors: string[] = [];

        // Read file text and parse RFC-4180 compliant CSV with PapaParse
        const csvContent = await file.text();
        const parsed = Papa.parse<Record<string, string>>(csvContent, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: (header) => header.replace(/^\ufeff/, "").trim(),
        });

        if (parsed.errors.length > 0 && parsed.data.length === 0) {
            return NextResponse.json(
                { success: false, error: `Erreur de parsing CSV: ${parsed.errors[0]?.message}` },
                { status: 400 }
            );
        }

        const allRows = parsed.data;
        const totalCsvRows = allRows.length;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (obj: object) => {
                    controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
                };

                try {
                    let processed = 0;

                    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
                        const batchRows = allRows.slice(i, i + BATCH_SIZE).map((row, idx) => ({
                            rowIndex: i + idx,
                            row,
                        }));

                        const { companies: batchCompanies, contacts: batchContacts, actions: batchActions, errs, campaignId } =
                            await processBatch(
                                list.id,
                                batchRows,
                                mappings,
                                importType,
                                {
                                    importActions,
                                    actionColumnMapping,
                                    actionColumnMode,
                                    actionColumnGroups,
                                    statusMappings,
                                    channelMappings,
                                    missionId,
                                    sdrId: assignedSdrId,
                                    whenAlreadyWorkedOn: addToExistingList ? (whenAlreadyWorkedOn === "skip" ? "skip" : "add_anyway") : "add_anyway",
                                    companyCache,
                                    cachedCampaignId,
                                }
                            );

                        if (campaignId) cachedCampaignId = campaignId;
                        companiesCreated += batchCompanies;
                        contactsCreated += batchContacts;
                        actionsCreated += batchActions;
                        errors.push(...errs);

                        processed += batchRows.length;
                        const percent = totalRows != null && totalRows > 0
                            ? Math.min(100, Math.round((processed / totalRows) * 100))
                            : Math.min(100, Math.round((processed / Math.max(totalCsvRows, 1)) * 100));

                        send({ type: "progress", percent, processed });
                    }

                    send({
                        type: "done",
                        data: {
                            listId: list.id,
                            companiesCreated,
                            contactsCreated,
                            actionsCreated,
                            errors: errors.length,
                            errorDetails: errors.slice(0, 10),
                        },
                    });
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Erreur lors de l'import";
                    console.error("CSV import error:", err);
                    send({ type: "error", error: message });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: { "Content-Type": "application/x-ndjson" },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur lors de l'import";
        console.error("CSV import error:", error);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

/** Process one batch of rows with batched DB queries and in-memory cache */
async function processBatch(
    listId: string,
    rows: { rowIndex: number; row: Record<string, string> }[],
    mappings: { csvColumn: string; targetField: string }[],
    importType: string,
    options: {
        importActions: boolean;
        actionColumnMode?: ActionColumnMode;
        actionColumnGroups?: ActionColumnGroup[];
        actionColumnMapping: {
            statusColumn?: string;
            dateColumn?: string;
            callbackDateColumn?: string;
            noteColumn?: string;
            channelColumn?: string;
        } | null;
        statusMappings: { csvValue: string; actionResult: ActionResult; count: number }[];
        channelMappings: { csvValue: string; channel: "CALL" | "EMAIL" | "LINKEDIN"; count: number }[];
        missionId: string | null;
        sdrId: string;
        whenAlreadyWorkedOn: "skip" | "add_anyway";
        companyCache: Map<string, CompanyCacheItem>;
        cachedCampaignId: string | null;
    }
): Promise<{ companies: number; contacts: number; actions: number; errs: string[]; campaignId: string | null }> {
    const errs: string[] = [];
    let companiesCreated = 0;
    let contactsCreated = 0;
    let actionsCreated = 0;
    let currentCampaignId = options.cachedCampaignId;
    const { companyCache } = options;

    type RowInfo = {
        rowIndex: number;
        row: Record<string, string>;
        companyData: Record<string, string>;
        companyCustomData: Record<string, string>;
        companyName: string;
        contactData?: Record<string, string>;
        contactCustomData?: Record<string, string>;
        contactAdditionalPhones?: string[];
        companyAdditionalPhones?: string[];
    };
    const validRows: RowInfo[] = [];

    // 1) Parse and sanitize rows
    for (const { rowIndex, row } of rows) {
        const {
            companyData,
            companyCustomData,
            hasCompanyData,
            additionalPhones: companyAdditionalPhones,
        } = extractCompanyFromRow(row, mappings);

        if (!hasCompanyData || !companyData.name) {
            errs.push(`Ligne ${rowIndex + 1}: Nom de société manquant`);
            continue;
        }

        const info: RowInfo = {
            rowIndex,
            row,
            companyData,
            companyCustomData,
            companyName: companyData.name,
            companyAdditionalPhones,
        };

        if (importType === "companies-contacts") {
            const {
                contactData,
                contactCustomData,
                hasContactData,
                additionalPhones: contactAdditionalPhones,
            } = extractContactFromRow(row, mappings);

            if (hasContactData && (contactData.email || contactData.firstName || contactData.lastName)) {
                info.contactData = contactData;
                info.contactCustomData = contactCustomData;
                info.contactAdditionalPhones = contactAdditionalPhones;
            }
        }
        validRows.push(info);
    }

    if (validRows.length === 0) {
        return { companies: 0, contacts: 0, actions: 0, errs, campaignId: currentCampaignId };
    }

    const uniqueRawNames = [...new Set(validRows.map((r) => r.companyName))];
    const uniqueNormalizedNames = [...new Set(uniqueRawNames.map((n) => normalizeCompanyName(n)))];
    const skipAlreadyWorked = options.whenAlreadyWorkedOn === "skip";

    // 2) Cache check & selective DB load (Fixes O(N^2) load: only query companies not in cache)
    const missingNamesFromCache = uniqueNormalizedNames.filter((n) => !companyCache.has(n));
    if (missingNamesFromCache.length > 0) {
        const missingRawNames = uniqueRawNames.filter((raw) =>
            missingNamesFromCache.includes(normalizeCompanyName(raw))
        );

        const foundCompanies = await prisma.company.findMany({
            where: {
                listId,
                name: { in: missingRawNames },
            },
            select: { id: true, name: true, _count: { select: { actions: true } } },
        });

        for (const c of foundCompanies) {
            companyCache.set(normalizeCompanyName(c.name), {
                id: c.id,
                name: c.name,
                hasActions: (c._count?.actions ?? 0) > 0,
            });
        }
    }

    const namesToConsider = skipAlreadyWorked
        ? uniqueNormalizedNames.filter((n) => {
            const existing = companyCache.get(n);
            return !existing || !existing.hasActions;
        })
        : uniqueNormalizedNames;

    // 3) Create missing companies
    const namesToCreate = namesToConsider.filter((n) => !companyCache.has(n));
    const companyPayloadByName = new Map<
        string,
        {
            companyData: Record<string, string>;
            companyCustomData: Record<string, string>;
            companyAdditionalPhones: string[];
        }
    >();

    for (const r of validRows) {
        const key = normalizeCompanyName(r.companyName);
        if (!companyCache.has(key) && !companyPayloadByName.has(key)) {
            companyPayloadByName.set(key, {
                companyData: r.companyData,
                companyCustomData: r.companyCustomData,
                companyAdditionalPhones: r.companyAdditionalPhones ?? [],
            });
        }
    }

    if (namesToCreate.length > 0) {
        const companiesCreateData = namesToCreate
            .map((name) => {
                const payload = companyPayloadByName.get(name);
                if (!payload) return null;
                const { companyData, companyCustomData } = payload;

                // Sanitize phone using libphonenumber-js
                const { primaryPhone, additionalPhones: extraPhones } = extractPhones(companyData.phone);
                const allExtraPhones = [...extraPhones, ...(payload.companyAdditionalPhones ?? [])];

                // Sanitize website / domain
                const { url: websiteUrl } = normalizeWebsite(companyData.website);

                const createData: Record<string, unknown> = {
                    name: companyData.name,
                    industry: companyData.industry || null,
                    country: companyData.country || null,
                    website: websiteUrl,
                    size: companyData.size || null,
                    listId,
                };

                if (primaryPhone) (createData as Record<string, unknown>).phone = primaryPhone;

                const customData: Record<string, unknown> = { ...companyCustomData };
                if (allExtraPhones.length > 0) customData.additionalPhones = allExtraPhones;
                if (Object.keys(customData).length > 0) createData.customData = customData;

                return createData as Parameters<typeof prisma.company.createMany>[0]["data"][number];
            })
            .filter(Boolean);

        if (companiesCreateData.length > 0) {
            const created = await prisma.company.createMany({
                data: companiesCreateData,
            });
            companiesCreated += created.count;

            const namesQuery = namesToCreate.map((n) => companyPayloadByName.get(n)?.companyData.name).filter(Boolean) as string[];
            const createdCompanies = await prisma.company.findMany({
                where: {
                    listId,
                    name: { in: namesQuery },
                },
                select: { id: true, name: true },
            });

            for (const c of createdCompanies) {
                companyCache.set(normalizeCompanyName(c.name), {
                    id: c.id,
                    name: c.name,
                    hasActions: false,
                });
            }
        }
    }

    // 4) Contacts: Preload existing contacts ONLY for companies in this batch
    const batchCompanyIds = [...new Set(
        validRows
            .map((r) => companyCache.get(normalizeCompanyName(r.companyName))?.id)
            .filter(Boolean)
    )] as string[];

    const existingContacts = await prisma.contact.findMany({
        where: { companyId: { in: batchCompanyIds } },
        select: { companyId: true, email: true, firstName: true, lastName: true },
    });

    const existingContactKeys = new Set<string>();
    for (const c of existingContacts) {
        const normEmail = normalizeEmail(c.email);
        if (normEmail) {
            existingContactKeys.add(`${c.companyId}:email:${normEmail}`);
        }
        if (c.firstName != null || c.lastName != null) {
            existingContactKeys.add(
                `${c.companyId}:name:${normalizePersonName(c.firstName)}:${normalizePersonName(c.lastName)}`
            );
        }
    }

    const contactExists = (companyId: string, email: string | null, firstName: string | null, lastName: string | null) =>
        (!!normalizeEmail(email) && existingContactKeys.has(`${companyId}:email:${normalizeEmail(email)}`)) ||
        existingContactKeys.has(
            `${companyId}:name:${normalizePersonName(firstName)}:${normalizePersonName(lastName)}`
        );

    const contactsToCreate: {
        companyId: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        additionalPhones?: string[] | undefined;
        title: string | null;
        linkedin: string | null;
        customData: Record<string, string> | undefined;
    }[] = [];

    for (const r of validRows) {
        const company = companyCache.get(normalizeCompanyName(r.companyName));
        if (!company || !r.contactData) continue;
        if (skipAlreadyWorked && company.hasActions) continue;

        const cd = r.contactData;
        const email = normalizeEmail(cd.email);
        const firstName = cd.firstName ? cd.firstName.trim() : null;
        const lastName = cd.lastName ? cd.lastName.trim() : null;

        if (contactExists(company.id, email, firstName, lastName)) continue;

        if (email) existingContactKeys.add(`${company.id}:email:${email}`);
        existingContactKeys.add(
            `${company.id}:name:${normalizePersonName(firstName)}:${normalizePersonName(lastName)}`
        );

        // Sanitize phone using libphonenumber-js
        const { primaryPhone, additionalPhones: extraPhones } = extractPhones(cd.phone);
        const allExtraPhones = [...extraPhones, ...(r.contactAdditionalPhones ?? [])];
        const uniqueExtraPhones = Array.from(new Set(allExtraPhones.filter((p) => !primaryPhone || p !== primaryPhone)));

        contactsToCreate.push({
            companyId: company.id,
            firstName,
            lastName,
            email,
            phone: primaryPhone,
            additionalPhones: uniqueExtraPhones.length > 0 ? uniqueExtraPhones : undefined,
            title: cd.title ? cd.title.trim() : null,
            linkedin: cd.linkedin ? cd.linkedin.trim() : null,
            customData: r.contactCustomData && Object.keys(r.contactCustomData).length > 0 ? r.contactCustomData : undefined,
        });
    }

    if (contactsToCreate.length > 0) {
        await prisma.contact.createMany({
            data: contactsToCreate.map((c) => ({
                companyId: c.companyId,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone,
                title: c.title,
                linkedin: c.linkedin,
                status: calculateContactCompleteness({
                    firstName: c.firstName,
                    lastName: c.lastName,
                    title: c.title,
                    email: c.email,
                    phone: c.phone,
                    linkedin: c.linkedin,
                }),
                ...(c.additionalPhones ? { additionalPhones: c.additionalPhones } : {}),
                ...(c.customData ? { customData: c.customData } : {}),
            })),
        });
        contactsCreated = contactsToCreate.length;

        // Group status updates into max 3 queries (Fixes 500-query connection pool exhaustion)
        const affectedCompanyIds = [...new Set(contactsToCreate.map((c) => c.companyId))];
        const contactsByCompany = await prisma.contact.findMany({
            where: { companyId: { in: affectedCompanyIds } },
            select: { companyId: true, status: true },
        });

        const statusByCompany = new Map<string, "INCOMPLETE" | "PARTIAL" | "ACTIONABLE">();
        for (const row of contactsByCompany) {
            const prev = statusByCompany.get(row.companyId) ?? "INCOMPLETE";
            if (row.status === "ACTIONABLE") statusByCompany.set(row.companyId, "ACTIONABLE");
            else if (row.status === "PARTIAL" && prev !== "ACTIONABLE") statusByCompany.set(row.companyId, "PARTIAL");
            else if (!statusByCompany.has(row.companyId)) statusByCompany.set(row.companyId, "INCOMPLETE");
        }

        const actionableIds: string[] = [];
        const partialIds: string[] = [];
        const incompleteIds: string[] = [];

        for (const [companyId, status] of statusByCompany.entries()) {
            if (status === "ACTIONABLE") actionableIds.push(companyId);
            else if (status === "PARTIAL") partialIds.push(companyId);
            else incompleteIds.push(companyId);
        }

        await Promise.all([
            actionableIds.length > 0 ? prisma.company.updateMany({ where: { id: { in: actionableIds } }, data: { status: "ACTIONABLE" } }) : null,
            partialIds.length > 0 ? prisma.company.updateMany({ where: { id: { in: partialIds } }, data: { status: "PARTIAL" } }) : null,
            incompleteIds.length > 0 ? prisma.company.updateMany({ where: { id: { in: incompleteIds } }, data: { status: "INCOMPLETE" } }) : null,
        ].filter(Boolean));
    }

    // 5) Historical Actions
    const shouldCreateActions =
        options.importActions &&
        (
            (options.actionColumnMode === "multi-column" &&
                !!options.actionColumnGroups?.some((g) => !!g.statusColumn)) ||
            (options.actionColumnMode !== "multi-column" &&
                options.actionColumnMapping &&
                !!options.actionColumnMapping.statusColumn)
        ) &&
        options.statusMappings.length > 0;

    if (shouldCreateActions) {
        const actionColumnMapping = options.actionColumnMapping;
        const actionColumnMode: ActionColumnMode = options.actionColumnMode === "multi-column" ? "multi-column" : "single";
        const actionColumnGroups: ActionColumnGroup[] = options.actionColumnGroups ?? [];
        const { statusMappings, channelMappings, sdrId } = options;

        const allContacts = await prisma.contact.findMany({
            where: { companyId: { in: batchCompanyIds } },
            select: { id: true, companyId: true, email: true, firstName: true, lastName: true },
        });

        const contactIdByKey = new Map<string, string>();
        for (const c of allContacts) {
            const normalizedEmail = normalizeEmail(c.email);
            const emailKey = normalizedEmail ? `${c.companyId}:email:${normalizedEmail}` : null;
            const nameKey = `${c.companyId}:name:${normalizePersonName(c.firstName)}:${normalizePersonName(c.lastName)}`;
            if (emailKey && !contactIdByKey.has(emailKey)) contactIdByKey.set(emailKey, c.id);
            if (!contactIdByKey.has(nameKey)) contactIdByKey.set(nameKey, c.id);
        }

        const findContactIdForRow = (companyId: string, rowInfo: RowInfo): string | undefined => {
            const cd = rowInfo.contactData;
            if (!cd) return undefined;
            const email = normalizeEmail(cd.email);
            const firstName = normalizePersonName(cd.firstName);
            const lastName = normalizePersonName(cd.lastName);
            if (email) {
                const key = `${companyId}:email:${email}`;
                const id = contactIdByKey.get(key);
                if (id) return id;
            }
            const nameKey = `${companyId}:name:${firstName}:${lastName}`;
            return contactIdByKey.get(nameKey);
        };

        const actionsToCreate: {
            contactId?: string | null;
            companyId: string;
            sdrId: string;
            campaignId: string;
            channel: "CALL" | "EMAIL" | "LINKEDIN";
            result: ActionResult;
            note?: string | null;
            createdAt?: Date;
            callbackDate?: Date;
        }[] = [];

        const normalizeMappingValue = (value: string): string => value.trim().toLowerCase();

        const statusMap = new Map<string, ActionResult>();
        for (const m of statusMappings) {
            if (m.actionResult) {
                statusMap.set(normalizeMappingValue(m.csvValue), m.actionResult);
            }
        }
        const channelMap = new Map<string, "CALL" | "EMAIL" | "LINKEDIN">();
        for (const m of channelMappings) {
            channelMap.set(normalizeMappingValue(m.csvValue), m.channel);
        }

        const statusColumn = actionColumnMapping?.statusColumn;
        const dateColumn = actionColumnMapping?.dateColumn;
        const callbackDateColumn = actionColumnMapping?.callbackDateColumn;
        const noteColumn = actionColumnMapping?.noteColumn;
        const channelColumn = actionColumnMapping?.channelColumn;
        const defaultChannel: "CALL" | "EMAIL" | "LINKEDIN" = "CALL";

        // Retrieve or create campaign once and cache it
        if (!currentCampaignId && options.missionId) {
            const listWithMission = await prisma.list.findUnique({
                where: { id: listId },
                select: {
                    missionId: true,
                    mission: { select: { name: true } },
                },
            });
            const campaignName = listWithMission?.mission?.name?.trim() || "Historique import";

            const existingCampaign = await prisma.campaign.findFirst({
                where: {
                    missionId: options.missionId,
                    name: campaignName,
                },
                select: { id: true },
            });

            if (existingCampaign) {
                currentCampaignId = existingCampaign.id;
            } else {
                const createdCampaign = await prisma.campaign.create({
                    data: {
                        missionId: options.missionId,
                        name: campaignName,
                        icp: "Import CSV historique",
                        pitch: "Campagne générée automatiquement pour l'import d'historique d'actions depuis un CSV.",
                        isActive: true,
                    },
                    select: { id: true },
                });
                currentCampaignId = createdCampaign.id;
            }
        }

        if (currentCampaignId) {
            for (const info of validRows) {
                const company = companyCache.get(normalizeCompanyName(info.companyName));
                if (!company) continue;

                const statuses = actionColumnMode === "multi-column"
                    ? actionColumnGroups
                        .map((g) => (g.statusColumn ? (info.row[g.statusColumn] ?? "").trim() : ""))
                        .filter((v) => v.length > 0)
                    : (statusColumn ? splitMultiActionCell(info.row[statusColumn]) : []);
                if (statuses.length === 0) continue;

                const dateValues = actionColumnMode === "multi-column"
                    ? actionColumnGroups
                        .map((g) => (g.dateColumn ? (info.row[g.dateColumn] ?? "").trim() : ""))
                        .filter((v) => v.length > 0)
                    : (dateColumn ? splitMultiActionCell(info.row[dateColumn]) : []);

                const callbackDateValues = actionColumnMode === "multi-column"
                    ? actionColumnGroups
                        .map((g) => (g.callbackDateColumn ? (info.row[g.callbackDateColumn] ?? "").trim() : ""))
                        .filter((v) => v.length > 0)
                    : (callbackDateColumn ? splitMultiActionCell(info.row[callbackDateColumn]) : []);

                const noteValues = actionColumnMode === "multi-column"
                    ? actionColumnGroups
                        .map((g) => (g.noteColumn ? (info.row[g.noteColumn] ?? "").trim() : ""))
                        .filter((v) => v.length > 0)
                    : (noteColumn ? splitMultiActionCell(info.row[noteColumn]) : []);

                const channelValues = actionColumnMode === "multi-column"
                    ? actionColumnGroups
                        .map((g) => (g.channelColumn ? (info.row[g.channelColumn] ?? "").trim() : ""))
                        .filter((v) => v.length > 0)
                    : (channelColumn ? splitMultiActionCell(info.row[channelColumn]) : []);

                const contactId = findContactIdForRow(company.id, info);

                for (let i = 0; i < statuses.length; i++) {
                    const result = statusMap.get(normalizeMappingValue(statuses[i]));
                    if (!result) continue;

                    let channel: "CALL" | "EMAIL" | "LINKEDIN" = defaultChannel;
                    const rawChannel = channelValues[i] ?? channelValues[0];
                    if (rawChannel) {
                        const mapped = channelMap.get(normalizeMappingValue(rawChannel));
                        if (mapped) channel = mapped;
                    }

                    let createdAt: Date | undefined;
                    const rawDate = dateValues[i] ?? (dateValues.length === 1 ? dateValues[0] : undefined);
                    if (rawDate) {
                        const parsedDate = parseCsvDate(rawDate);
                        if (parsedDate) createdAt = parsedDate;
                    }

                    // Safe note mapping: only copy if exactly 1 note exists across all calls
                    const rawNote = noteValues[i] ?? (noteValues.length === 1 ? noteValues[0] : undefined);
                    const note = rawNote?.trim() ? rawNote.trim() : undefined;

                    let callbackDate: Date | undefined;
                    const rawCallbackDate = callbackDateValues[i] ?? (callbackDateValues.length === 1 ? callbackDateValues[0] : undefined);
                    if (rawCallbackDate) {
                        const parsedCallback = parseCsvDate(rawCallbackDate);
                        if (parsedCallback) callbackDate = parsedCallback;
                    }

                    if (!callbackDate && (result === "MEETING_BOOKED" || result === "CALLBACK_REQUESTED" || result === "MEETING_CANCELLED")) {
                        callbackDate = createdAt;
                    }

                    actionsToCreate.push({
                        companyId: company.id,
                        contactId: contactId ?? null,
                        sdrId,
                        campaignId: currentCampaignId,
                        channel,
                        result,
                        note: note ?? null,
                        createdAt,
                        callbackDate,
                    });
                }
            }

            if (actionsToCreate.length > 0) {
                await prisma.action.createMany({
                    data: actionsToCreate,
                });
                actionsCreated = actionsToCreate.length;
            }
        }
    }

    return { companies: companiesCreated, contacts: contactsCreated, actions: actionsCreated, errs, campaignId: currentCampaignId };
}
