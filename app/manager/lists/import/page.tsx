"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Select, FileUpload, useToast, Modal, Input, Badge, Tooltip } from "@/components/ui";
import {
    ArrowLeft,
    ArrowRight,
    Upload,
    Check,
    Loader2,
    FileText,
    AlertCircle,
    CheckCircle2,
    Table,
    Building2,
    User,
    XCircle,
    Sparkles,
    Search,
    RotateCcw,
    Save,
    ChevronDown,
    ChevronRight,
    Info,
    TrendingUp,
    Database,
    Mail,
    Phone,
    Globe,
    MapPin,
    Briefcase,
    Users,
    Calendar,
    History,
    Download,
} from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import { CSV_PRESETS, detectBestPreset, applyPresetMappings } from "@/lib/csv/presets";
import { splitMultiActionCell } from "@/lib/csv/sanitizer";
import { AiMappingAssistant } from "./_components/AiMappingAssistant";
import { LiveCrmLeadPreview } from "./_components/LiveCrmLeadPreview";
import type { AiMappingSuggestion } from "@/app/api/lists/import/ai-mapping/route";

// ============================================
// TYPES
// ============================================

interface Mission {
    id: string;
    name: string;
}

interface SdrOption {
    id: string;
    name: string;
    role: string;
}

interface ListOption {
    id: string;
    name: string;
    missionId: string;
}

interface ColumnMapping {
    csvColumn: string;
    targetField: string;
    confidence?: number;
    autoDetected?: boolean;
    reasoning?: string;
    isCustomField?: boolean;
}

interface ColumnStats {
    column: string;
    totalRows: number;
    filledRows: number;
    uniqueValues: number;
    dataType: 'text' | 'email' | 'phone' | 'url' | 'number' | 'date';
    sampleValues: string[];
}

interface StatusMapping {
    csvValue: string;
    actionResult: string;
    count: number;
}

interface ChannelMapping {
    csvValue: string;
    channel: 'CALL' | 'EMAIL' | 'LINKEDIN';
    count: number;
}

interface ActionColumnMapping {
    statusColumn: string;
    dateColumn: string;
    callbackDateColumn: string;
    noteColumn: string;
    channelColumn: string;
}

interface ActionColumnGroup {
    id: string;
    statusColumn: string;
    dateColumn: string;
    noteColumn: string;
    channelColumn: string;
    callbackDateColumn: string;
}

interface PreviewRow {
    [key: string]: string;
}

// Keep each request payload below typical serverless limits (e.g. Vercel 413).
const IMPORT_CHUNK_THRESHOLD_BYTES = 4 * 1024 * 1024;
const IMPORT_CHUNK_TARGET_BYTES = 3.5 * 1024 * 1024;

function inferDataType(samples: string[]): ColumnStats["dataType"] {
    const nonEmpty = samples.filter((v) => v.trim().length > 0);
    if (nonEmpty.length === 0) return "text";
    const emailCount = nonEmpty.filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())).length;
    const urlCount = nonEmpty.filter((v) => /^https?:\/\//i.test(v.trim()) || /^www\./i.test(v.trim())).length;
    const phoneCount = nonEmpty.filter((v) => /^[+()\d\s.-]{8,}$/.test(v.trim())).length;
    const numberCount = nonEmpty.filter((v) => /^-?\d+([.,]\d+)?$/.test(v.trim())).length;
    const dateCount = nonEmpty.filter((v) => /^(\d{1,2}[\/-]\d{1,2}[\/-](\d{2}|\d{4})|\d{4}-\d{1,2}-\d{1,2})/.test(v.trim())).length;
    const n = nonEmpty.length;
    if (emailCount / n > 0.6) return "email";
    if (urlCount / n > 0.6) return "url";
    if (phoneCount / n > 0.6) return "phone";
    if (dateCount / n > 0.6) return "date";
    if (numberCount / n > 0.7) return "number";
    return "text";
}

// ============================================
// FIELD OPTIONS
// ============================================

const COMPANY_FIELDS = [
    { value: "", label: "Ignorer" },
    { value: "company.name", label: "Nom de société *" },
    { value: "company.industry", label: "Industrie" },
    { value: "company.country", label: "Pays" },
    { value: "company.website", label: "Site web" },
    { value: "company.phone", label: "Téléphone société" },
    { value: "company.additionalPhones", label: "Téléphones société (suppl.)" },
    { value: "company.size", label: "Taille" },
    { value: "__custom_company__", label: "➕ Champ personnalisé société..." },
];

const CONTACT_FIELDS = [
    { value: "contact.firstName", label: "Prénom" },
    { value: "contact.lastName", label: "Nom" },
    { value: "contact.email", label: "Email" },
    { value: "contact.phone", label: "Téléphone" },
     { value: "contact.additionalPhones", label: "Téléphones (suppl.)" },
    { value: "contact.title", label: "Fonction" },
    { value: "contact.linkedin", label: "LinkedIn" },
    { value: "__custom_contact__", label: "➕ Champ personnalisé contact..." },
];

const ALL_FIELDS = [...COMPANY_FIELDS, ...CONTACT_FIELDS];

// Count lines in file by streaming (avoids loading full file; used for progress %)
async function countFileLines(file: File): Promise<number> {
    const stream = file.stream();
    const reader = stream.getReader();
    const dec = new TextDecoder();
    let count = 0;
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? "";
        count += parts.length;
    }
    if (buffer.trim()) count++;
    return Math.max(0, count - 1);
}

function splitRowsIntoChunks(rows: Record<string, string>[], targetRowsPerChunk = 2500): string[] {
    if (rows.length === 0) return [];
    const chunks: string[] = [];
    for (let i = 0; i < rows.length; i += targetRowsPerChunk) {
        const slice = rows.slice(i, i + targetRowsPerChunk);
        chunks.push(Papa.unparse(slice));
    }
    return chunks;
}

// ============================================
// CSV IMPORT PAGE
// ============================================

export default function ImportListPage() {
    const router = useRouter();
    const { success, error: showError } = useToast();

    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [sdrOptions, setSdrOptions] = useState<SdrOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // Step 1: File & Mission
    const [file, setFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<"new" | "existing">("new");
    const [missionId, setMissionId] = useState("");
    const [listName, setListName] = useState("");
    const [listId, setListId] = useState("");
    const [lists, setLists] = useState<ListOption[]>([]);
    const [whenAlreadyWorkedOn, setWhenAlreadyWorkedOn] = useState<"skip" | "add_anyway">("skip");

    // Step 2: Import Type Selection
    const [importType, setImportType] = useState<"companies-only" | "companies-contacts">("companies-contacts");

    // Step 3: Column mapping
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
    const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
    const [detectedPresetInfo, setDetectedPresetInfo] = useState<{ id: string; name: string; count: number } | null>(null);
    const [totalRows, setTotalRows] = useState(0);
    const [columnStats, setColumnStats] = useState<ColumnStats[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['company', 'contact']));
    const [showQualityReport, setShowQualityReport] = useState(false);
    
    // Action history import
    const [importActions, setImportActions] = useState(false);
    const [assignedSdrId, setAssignedSdrId] = useState("");
    const [actionColumnMapping, setActionColumnMapping] = useState<ActionColumnMapping>({
        statusColumn: "",
        dateColumn: "",
        callbackDateColumn: "",
        noteColumn: "",
        channelColumn: "",
    });
    const [actionColumnMode, setActionColumnMode] = useState<"single" | "multi-column">("single");
    const [actionColumnGroups, setActionColumnGroups] = useState<ActionColumnGroup[]>([]);
    const [statusMappings, setStatusMappings] = useState<StatusMapping[]>([]);
    const [detectedStatuses, setDetectedStatuses] = useState<string[]>([]);
    const [detectedChannels, setDetectedChannels] = useState<string[]>([]);
    const [channelMappings, setChannelMappings] = useState<ChannelMapping[]>([]);
    /** Per-column unique values and counts from ALL rows (used for status/channel mapping) */
    const [fullColumnUniqueValues, setFullColumnUniqueValues] = useState<Record<string, { values: string[]; counts: Record<string, number> }>>({});

    // Step 4: Validation
    const [validationResult, setValidationResult] = useState<{
        valid: number;
        errors: string[];
        warnings: string[];
    } | null>(null);

    // Step 5: Import result
    const [importResult, setImportResult] = useState<{
        companies: number;
        contacts: number;
        actions?: number;
        errors: number;
        errorDetails?: string[];
    } | null>(null);

    const [importProgress, setImportProgress] = useState<number | null>(null);

    // Custom field modal state
    const [customFieldPrompt, setCustomFieldPrompt] = useState<{
        index: number;
        type: "company" | "contact";
    } | null>(null);
    const [customFieldValue, setCustomFieldValue] = useState("");

    const mappedCount = mappings.filter(m => m.targetField && m.targetField !== "").length;
    const requiredMapped = mappings.some(m => m.targetField === "company.name");
    const canGoToType = !!file && !!missionId && (importMode === "new" ? !!listName?.trim() : !!listId);
    const mappingCompletion = csvHeaders.length > 0 ? Math.round((mappedCount / csvHeaders.length) * 100) : 0;

    const autoMapStatusValues = () => {
        if (statusMappings.length === 0) return;
        const next = statusMappings.map((entry) => {
            const v = entry.csvValue.toLowerCase().trim();
            let actionResult = entry.actionResult;
            if (!actionResult) {
                if (v.includes("pas de réponse") || v.includes("no answer")) actionResult = "NO_ANSWER";
                else if (v.includes("rappel") || v.includes("callback")) actionResult = "CALLBACK_REQUESTED";
                else if (v.includes("rdv") || v.includes("meeting") || v.includes("book")) actionResult = "MEETING_BOOKED";
                else if (v.includes("annul")) actionResult = "MEETING_CANCELLED";
                else if (v.includes("refus") || v.includes("not interested")) actionResult = "NOT_INTERESTED";
                else if (v.includes("wrong") || v.includes("faux numéro")) actionResult = "WRONG_NUMBER";
                else if (v.includes("email sent") || v.includes("email envoyé")) actionResult = "EMAIL_SENT";
            }
            return { ...entry, actionResult };
        });
        setStatusMappings(next);
    };

    const addActionColumnGroup = () => {
        const nextIndex = actionColumnGroups.length + 1;
        setActionColumnGroups((prev) => [
            ...prev,
            {
                id: `call-${Date.now()}-${nextIndex}`,
                statusColumn: "",
                dateColumn: "",
                noteColumn: "",
                channelColumn: "",
                callbackDateColumn: "",
            },
        ]);
    };

    const updateActionColumnGroup = (
        id: string,
        patch: Partial<Omit<ActionColumnGroup, "id">>
    ) => {
        setActionColumnGroups((prev) =>
            prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
        );
    };

    const removeActionColumnGroup = (id: string) => {
        setActionColumnGroups((prev) => prev.filter((g) => g.id !== id));
    };

    const sequencePreviewRows = previewData.slice(0, 3).map((row, idx) => {
        const multiStatuses = actionColumnGroups
            .map((g) => (g.statusColumn ? row[g.statusColumn] || "" : ""))
            .filter((v) => !!v)
            .map((v) => v.trim());
        const statuses =
            actionColumnMode === "multi-column"
                ? multiStatuses
                : actionColumnMapping.statusColumn
                    ? splitMultiActionCell(row[actionColumnMapping.statusColumn] || "")
                    : [];
        const dates =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.dateColumn ? row[g.dateColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.dateColumn
                    ? splitMultiActionCell(row[actionColumnMapping.dateColumn] || "")
                    : [];
        const channels =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.channelColumn ? row[g.channelColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.channelColumn
                    ? splitMultiActionCell(row[actionColumnMapping.channelColumn] || "")
                    : [];
        const notes =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.noteColumn ? row[g.noteColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.noteColumn
                    ? splitMultiActionCell(row[actionColumnMapping.noteColumn] || "")
                    : [];
        const lengths = [statuses.length, dates.length, channels.length, notes.length].filter((n) => n > 0);
        const maxLen = lengths.length > 0 ? Math.max(...lengths) : 0;
        const minLen = lengths.length > 0 ? Math.min(...lengths) : 0;
        return {
            rowNumber: idx + 1,
            statuses,
            dates,
            channels,
            notes,
            actionCount: statuses.length,
            hasPotentialMisalignment: lengths.length > 1 && maxLen !== minLen,
        };
    });

    const isWorkedConflictActive =
        importMode === "existing" && whenAlreadyWorkedOn === "skip" && importActions;

    const statusResultByCsv = new Map(
        statusMappings.map((m) => [m.csvValue.trim().toLowerCase(), m.actionResult])
    );
    const channelByCsv = new Map(
        channelMappings.map((m) => [m.csvValue.trim().toLowerCase(), m.channel])
    );
    const channelLabelByValue: Record<"CALL" | "EMAIL" | "LINKEDIN", string> = {
        CALL: "Appel",
        EMAIL: "Email",
        LINKEDIN: "LinkedIn",
    };
    const channelEmojiByValue: Record<"CALL" | "EMAIL" | "LINKEDIN", string> = {
        CALL: "📞",
        EMAIL: "📧",
        LINKEDIN: "💼",
    };

    const reconstructedActionPreview = previewData.slice(0, 3).map((row, idx) => {
        const companyCol = mappings.find((m) => m.targetField === "company.name")?.csvColumn;
        const companyName = (companyCol ? row[companyCol] : "")?.trim() || `Ligne ${idx + 1}`;
        const statuses =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.statusColumn ? row[g.statusColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.statusColumn
                    ? splitMultiActionCell(row[actionColumnMapping.statusColumn] || "")
                    : [];
        const dates =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.dateColumn ? row[g.dateColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.dateColumn
                    ? splitMultiActionCell(row[actionColumnMapping.dateColumn] || "")
                    : [];
        const channels =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.channelColumn ? row[g.channelColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.channelColumn
                    ? splitMultiActionCell(row[actionColumnMapping.channelColumn] || "")
                    : [];
        const notes =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.noteColumn ? row[g.noteColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.noteColumn
                    ? splitMultiActionCell(row[actionColumnMapping.noteColumn] || "")
                    : [];
        const callbacks =
            actionColumnMode === "multi-column"
                ? actionColumnGroups
                    .map((g) => (g.callbackDateColumn ? row[g.callbackDateColumn] || "" : ""))
                    .filter((v) => !!v)
                    .map((v) => v.trim())
                : actionColumnMapping.callbackDateColumn
                    ? splitMultiActionCell(row[actionColumnMapping.callbackDateColumn] || "")
                    : [];

        const actions = statuses.map((status, actionIdx) => {
            const statusKey = status.trim().toLowerCase();
            const mappedResult = statusResultByCsv.get(statusKey) || "";
            const resultLabel = mappedResult ? ACTION_RESULT_LABELS[mappedResult as keyof typeof ACTION_RESULT_LABELS] : undefined;
            const rawChannel = (channels[actionIdx] ?? channels[0] ?? "").trim().toLowerCase();
            const mappedChannel = (channelByCsv.get(rawChannel) || "CALL") as "CALL" | "EMAIL" | "LINKEDIN";
            return {
                channel: mappedChannel,
                channelLabel: channelLabelByValue[mappedChannel],
                channelEmoji: channelEmojiByValue[mappedChannel],
                date: dates[actionIdx] ?? dates[0] ?? "",
                callbackDate: callbacks[actionIdx] ?? callbacks[0] ?? "",
                sourceStatus: status,
                mappedLabel: resultLabel,
                note: notes[actionIdx] ?? notes[0] ?? "",
            };
        });

        return {
            companyName,
            actionCount: actions.length,
            actions,
        };
    });

    // ============================================
    // FETCH MISSIONS
    // ============================================

    useEffect(() => {
        const fetchMissionsAndSdrs = async () => {
            setIsLoading(true);
            try {
                const [missionsRes, sdrsRes] = await Promise.all([
                    fetch("/api/missions?isActive=true"),
                    fetch("/api/users?role=SDR,BUSINESS_DEVELOPER&status=active&limit=200"),
                ]);
                const [missionsJson, sdrsJson] = await Promise.all([
                    missionsRes.json(),
                    sdrsRes.json(),
                ]);
                if (missionsJson.success) {
                    setMissions(missionsJson.data);
                }
                if (sdrsJson.success) {
                    const users = Array.isArray(sdrsJson.data?.users) ? sdrsJson.data.users : [];
                    setSdrOptions(users.map((u: { id: string; name: string; role: string }) => ({
                        id: u.id,
                        name: u.name,
                        role: u.role,
                    })));
                }
            } catch (err) {
                console.error("Failed to fetch import references:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMissionsAndSdrs();
    }, []);

    // Fetch lists when mission changes (for "add to existing list")
    useEffect(() => {
        if (importMode !== "existing" || !missionId) {
            setLists([]);
            setListId("");
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/lists?missionId=${missionId}&limit=200`);
                const json = await res.json();
                if (cancelled || !json.success) return;
                const items = (json.data ?? []) as { id: string; name: string; missionId: string }[];
                setLists(items);
                setListId((prev) => (items.some((l) => l.id === prev) ? prev : items[0]?.id ?? ""));
            } catch {
                if (!cancelled) setLists([]);
            }
        })();
        return () => { cancelled = true; };
    }, [importMode, missionId]);

    // Detect unique status values for selected action status columns (single or multi-column mode)
    useEffect(() => {
        const selectedStatusColumns =
            actionColumnMode === "multi-column"
                ? actionColumnGroups.map((g) => g.statusColumn).filter(Boolean)
                : actionColumnMapping.statusColumn
                    ? [actionColumnMapping.statusColumn]
                    : [];
        if (selectedStatusColumns.length === 0) {
            setDetectedStatuses([]);
            setStatusMappings([]);
            return;
        }
        const aggregateCounts: Record<string, number> = {};
        for (const col of selectedStatusColumns) {
            const data = fullColumnUniqueValues[col];
            if (!data) continue;
            for (const csvValue of data.values) {
                aggregateCounts[csvValue] = (aggregateCounts[csvValue] || 0) + (data.counts[csvValue] || 0);
            }
        }
        const values = Object.keys(aggregateCounts).sort();
        setDetectedStatuses(values);
        setStatusMappings((prev) => {
            const prevByValue = new Map(prev.map((m) => [m.csvValue, m.actionResult]));
            return values.map((csvValue) => ({
                csvValue,
                actionResult: prevByValue.get(csvValue) || "",
                count: aggregateCounts[csvValue] || 0,
            }));
        });
    }, [actionColumnMode, actionColumnGroups, actionColumnMapping.statusColumn, fullColumnUniqueValues]);

    // Detect unique channel values for selected action channel columns (single or multi-column mode)
    useEffect(() => {
        const selectedChannelColumns =
            actionColumnMode === "multi-column"
                ? actionColumnGroups.map((g) => g.channelColumn).filter(Boolean)
                : actionColumnMapping.channelColumn
                    ? [actionColumnMapping.channelColumn]
                    : [];
        if (selectedChannelColumns.length === 0) {
            setDetectedChannels([]);
            setChannelMappings([]);
            return;
        }
        const aggregateCounts: Record<string, number> = {};
        for (const col of selectedChannelColumns) {
            const data = fullColumnUniqueValues[col];
            if (!data) continue;
            for (const csvValue of data.values) {
                aggregateCounts[csvValue] = (aggregateCounts[csvValue] || 0) + (data.counts[csvValue] || 0);
            }
        }
        const values = Object.keys(aggregateCounts).sort();
        setDetectedChannels(values);
        setChannelMappings((prev) => {
            const prevByValue = new Map(prev.map((m) => [m.csvValue, m.channel]));
            return values.map((csvValue) => ({
                csvValue,
                channel: prevByValue.get(csvValue) || "CALL",
                count: aggregateCounts[csvValue] || 0,
            }));
        });
    }, [actionColumnMode, actionColumnGroups, actionColumnMapping.channelColumn, fullColumnUniqueValues]);

    const handleApplyPreset = (presetId: string) => {
        const presetMappings = applyPresetMappings(presetId, csvHeaders);
        setMappings((prev) =>
            prev.map((m) => ({
                ...m,
                targetField: presetMappings[m.csvColumn] || m.targetField || "",
                autoDetected: !!presetMappings[m.csvColumn],
                confidence: presetMappings[m.csvColumn] ? 95 : m.confidence,
                reasoning: presetMappings[m.csvColumn] ? `Format ${presetId} reconnu` : m.reasoning,
            }))
        );
        const preset = CSV_PRESETS.find((p) => p.id === presetId);
        if (preset) {
            success("Preset appliqué", `Mapping ${preset.name} appliqué`);
        }
    };

    const handleApplyAiSuggestions = (suggestions: AiMappingSuggestion[]) => {
        const suggestionMap = new Map(suggestions.map((s) => [s.csvColumn, s]));
        setMappings((prev) =>
            prev.map((m) => {
                const s = suggestionMap.get(m.csvColumn);
                if (s && s.targetField) {
                    return {
                        ...m,
                        targetField: s.targetField,
                        confidence: s.confidence,
                        autoDetected: true,
                        reasoning: s.reasoning,
                        isCustomField: s.isCustomField,
                    };
                }
                return m;
            })
        );
    };

    const handleApplyAiActionSuggestions = (actions: { statusColumn?: string; dateColumn?: string; noteColumn?: string }) => {
        if (actions.statusColumn || actions.dateColumn || actions.noteColumn) {
            setImportActions(true);
            setActionColumnMapping((prev) => ({
                ...prev,
                statusColumn: actions.statusColumn || prev.statusColumn,
                dateColumn: actions.dateColumn || prev.dateColumn,
                noteColumn: actions.noteColumn || prev.noteColumn,
            }));
        }
    };

    const parseCSV = useCallback((file: File) => {
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: (header) => header.replace(/^\ufeff/, "").trim(),
            complete: (results) => {
                if (results.errors.length > 0 && results.data.length === 0) {
                    showError("Erreur", "Le fichier CSV n'a pas pu être lu: " + (results.errors[0]?.message || "Erreur de format"));
                    return;
                }

                const headers = (results.meta.fields || []).filter(Boolean);
                if (headers.length === 0 || results.data.length === 0) {
                    showError("Erreur", "Le fichier CSV doit contenir au moins une ligne d'en-tête et une ligne de données");
                    return;
                }

                setCsvHeaders(headers);
                const dataRows = results.data;
                setParsedRows(dataRows);
                setTotalRows(dataRows.length);
                setPreviewData(dataRows.slice(0, 5));

                // Auto-detection using presets first, then intelligent keyword matching
                const bestPresetMatch = detectBestPreset(headers);
                let autoMappings: ColumnMapping[] = [];

                if (bestPresetMatch && bestPresetMatch.confidence >= 40) {
                    const presetMappings = applyPresetMappings(bestPresetMatch.preset.id, headers);
                    autoMappings = headers.map((header) => ({
                        csvColumn: header,
                        targetField: presetMappings[header] || "",
                        autoDetected: !!presetMappings[header],
                    }));
                    setDetectedPresetInfo({
                        name: bestPresetMatch.preset.name,
                        id: bestPresetMatch.preset.id,
                        count: bestPresetMatch.matchedCount,
                    });
                } else {
                    setDetectedPresetInfo(null);
                    autoMappings = headers.map((header) => {
                        const lowerHeader = header.toLowerCase();
                        let targetField = "";

                        if ((lowerHeader.includes("phone") || lowerHeader.includes("téléphone") || lowerHeader.includes("tel")) &&
                            (lowerHeader.includes("company") || lowerHeader.includes("société") || lowerHeader.includes("entreprise"))) {
                            targetField = "company.phone";
                        } else if (lowerHeader.includes("size") || lowerHeader.includes("taille") || lowerHeader.includes("employees") || lowerHeader.includes("employés")) {
                            targetField = "company.size";
                        } else if (lowerHeader.includes("company") || lowerHeader.includes("société") || lowerHeader.includes("entreprise") || lowerHeader.includes("organization")) {
                            targetField = "company.name";
                        } else if (lowerHeader.includes("industry") || lowerHeader.includes("secteur") || lowerHeader.includes("industrie")) {
                            targetField = "company.industry";
                        } else if (lowerHeader.includes("country") || lowerHeader.includes("pays")) {
                            targetField = "company.country";
                        } else if (lowerHeader.includes("website") || lowerHeader.includes("site") || lowerHeader.includes("url") || lowerHeader.includes("domain")) {
                            targetField = "company.website";
                        } else if (lowerHeader.includes("firstname") || lowerHeader.includes("prénom") || lowerHeader === "first name" || lowerHeader === "prenom") {
                            targetField = "contact.firstName";
                        } else if (lowerHeader.includes("lastname") || lowerHeader === "nom" || lowerHeader === "last name" || lowerHeader.includes("surname")) {
                            targetField = "contact.lastName";
                        } else if (lowerHeader.includes("email") || lowerHeader.includes("mail") || lowerHeader.includes("e-mail")) {
                            targetField = "contact.email";
                        } else if (lowerHeader.includes("phone") || lowerHeader.includes("téléphone") || lowerHeader.includes("tel") || lowerHeader.includes("mobile")) {
                            targetField = "contact.phone";
                        } else if (lowerHeader.includes("title") || lowerHeader.includes("fonction") || lowerHeader.includes("poste") || lowerHeader.includes("job")) {
                            targetField = "contact.title";
                        } else if (lowerHeader.includes("linkedin")) {
                            targetField = "contact.linkedin";
                        }

                        return { csvColumn: header, targetField };
                    });
                }

                setMappings(autoMappings);

                // Fast single-pass calculation of column statistics and unique values (no O(N x M) main-thread freeze!)
                const sampleRows = dataRows.slice(0, 1000);
                const colUnique: Record<string, { values: string[]; counts: Record<string, number> }> = {};
                const colFilled: Record<string, number> = {};
                const colSamples: Record<string, string[]> = {};

                headers.forEach((h) => {
                    colUnique[h] = { values: [], counts: {} };
                    colFilled[h] = 0;
                    colSamples[h] = [];
                });

                for (const row of sampleRows) {
                    for (const h of headers) {
                        const rawValue = (row[h] || "").trim();
                        if (!rawValue) continue;
                        colFilled[h]++;
                        if (colSamples[h].length < 3) colSamples[h].push(rawValue);

                        const splitValues = splitMultiActionCell(rawValue);
                        const valuesToCount = splitValues.length > 1 ? splitValues : [rawValue];
                        for (const val of valuesToCount) {
                            const existing = colUnique[h].counts[val];
                            if (existing === undefined) {
                                colUnique[h].values.push(val);
                                colUnique[h].counts[val] = 1;
                            } else {
                                colUnique[h].counts[val]++;
                            }
                        }
                    }
                }

                headers.forEach((h) => {
                    colUnique[h].values.sort();
                });
                setFullColumnUniqueValues(colUnique);

                const stats: ColumnStats[] = headers.map((header) => {
                    const filled = Math.round((colFilled[header] / Math.max(sampleRows.length, 1)) * dataRows.length);
                    const samples = colSamples[header] || [];
                    return {
                        column: header,
                        totalRows: dataRows.length,
                        filledRows: filled,
                        uniqueValues: Object.keys(colUnique[header]?.counts ?? {}).length,
                        dataType: inferDataType(samples),
                        sampleValues: samples,
                    };
                });
                setColumnStats(stats);

                // Auto-generate list name from file
                if (!listName) {
                    const name = file.name.replace(/\.csv$/i, "").replace(/[_-]/g, " ");
                    setListName(name);
                }
            },
        });
    }, [listName, showError, success]);

    // ============================================
    // HANDLE FILE SELECTION
    // ============================================

    const handleFileSelected = (files: File[]) => {
        if (files.length > 0) {
            setFile(files[0]);
            parseCSV(files[0]);
        }
    };

    // ============================================
    // VALIDATE DATA
    // ============================================

    const validateData = () => {
        const hasCompanyName = mappings.some(m => m.targetField === "company.name");
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!hasCompanyName) {
            errors.push("Le champ 'Nom de société' est obligatoire");
        }

        // Check for duplicate mappings
        const usedFields = new Map<string, string>();
        for (const mapping of mappings) {
            if (mapping.targetField && mapping.targetField !== "" &&
                !mapping.targetField.startsWith("__custom")) {
                const existing = usedFields.get(mapping.targetField);
                if (existing) {
                    errors.push(`Le champ "${mapping.targetField}" est mappé à la fois par "${existing}" et "${mapping.csvColumn}"`);
                } else {
                    usedFields.set(mapping.targetField, mapping.csvColumn);
                }
            }
        }

        if (importType === "companies-contacts") {
            const hasContact = mappings.some(m => m.targetField.startsWith("contact."));
            if (!hasContact) {
                warnings.push("Aucun champ contact mappé - seules les sociétés seront importées");
            }

            const hasEmail = mappings.some(m => m.targetField === "contact.email");
            if (hasContact && !hasEmail) {
                warnings.push("Pas d'email mappé - les contacts ne pourront pas être enrichis");
            }
        }

        // Check for company phone if companies-only
        if (importType === "companies-only") {
            const hasCompanyPhone = mappings.some(m => m.targetField === "company.phone");
            if (!hasCompanyPhone) {
                warnings.push("Aucun téléphone société mappé - les SDR ne pourront pas appeler directement les sociétés");
            }
        }

        // Validation for action history import: require full mapping of detected statuses
        if (importActions) {
            if (!assignedSdrId) {
                errors.push("Sélectionnez un SDR pour assigner l'historique des prospects déjà travaillés");
            }
            const hasStatusMapping =
                actionColumnMode === "multi-column"
                    ? actionColumnGroups.some((g) => !!g.statusColumn)
                    : !!actionColumnMapping.statusColumn;
            if (!hasStatusMapping) {
                errors.push(
                    actionColumnMode === "multi-column"
                        ? "Vous avez activé l'historique d'actions mais aucun groupe d'appel n'a de colonne de statut"
                        : "Vous avez activé l'historique d'actions mais aucune colonne de statut n'est sélectionnée"
                );
            } else if (statusMappings.length > 0 && statusMappings.some(m => !m.actionResult)) {
                errors.push("Tous les statuts trouvés dans la colonne d'historique doivent être mappés à un résultat CRM");
            }

            const previewMisaligned = previewData.slice(0, 20).some((row) => {
                const statuses =
                    actionColumnMode === "multi-column"
                        ? actionColumnGroups
                            .map((g) => (g.statusColumn ? row[g.statusColumn] || "" : ""))
                            .filter((v) => !!v)
                        : actionColumnMapping.statusColumn
                            ? splitMultiActionCell(row[actionColumnMapping.statusColumn] || "")
                            : [];
                if (statuses.length <= 1) return false;
                const dates =
                    actionColumnMode === "multi-column"
                        ? actionColumnGroups.map((g) => (g.dateColumn ? row[g.dateColumn] || "" : "")).filter((v) => !!v)
                        : actionColumnMapping.dateColumn
                            ? splitMultiActionCell(row[actionColumnMapping.dateColumn] || "")
                            : [];
                const channels =
                    actionColumnMode === "multi-column"
                        ? actionColumnGroups.map((g) => (g.channelColumn ? row[g.channelColumn] || "" : "")).filter((v) => !!v)
                        : actionColumnMapping.channelColumn
                            ? splitMultiActionCell(row[actionColumnMapping.channelColumn] || "")
                            : [];
                const notes =
                    actionColumnMode === "multi-column"
                        ? actionColumnGroups.map((g) => (g.noteColumn ? row[g.noteColumn] || "" : "")).filter((v) => !!v)
                        : actionColumnMapping.noteColumn
                            ? splitMultiActionCell(row[actionColumnMapping.noteColumn] || "")
                            : [];
                const lengths = [statuses.length, dates.length, channels.length, notes.length].filter((n) => n > 1);
                return lengths.some((n) => n !== statuses.length);
            });

            if (previewMisaligned) {
                warnings.push("Certaines lignes semblent avoir un nombre de valeurs différent entre statuts/dates/canaux/notes. Vérifiez la section 'Aperçu séquence multi-actions'.");
            }

            if (importMode === "existing" && whenAlreadyWorkedOn === "skip") {
                warnings.push("Conflit potentiel: vous importez l'historique d'actions mais vous avez choisi d'ignorer les sociétés déjà travaillées. Une partie de l'historique peut être ignorée.");
            }
        }

        setValidationResult({
            valid: errors.length === 0 ? totalRows : 0, // FIXED: Use totalRows instead of previewData.length
            errors,
            warnings,
        });

        if (errors.length === 0) {
            setStep(4);
        }
    };

    // ============================================
    // IMPORT DATA
    // ============================================

    const handleImport = async () => {
        if (!file) return;

        setIsImporting(true);
        setImportProgress(0);

        try {
            const totalRows = await countFileLines(file);
            type ImportDoneData = { listId?: string; companiesCreated: number; contactsCreated: number; actionsCreated?: number; errors: number };
            const uploadChunk = async (
                uploadFile: File,
                opts: { existingListId?: string; chunkRows?: number; processedRowsBefore?: number; totalRowsAll?: number }
            ): Promise<{ data?: ImportDoneData; error?: string }> => {
                const formData = new FormData();
                formData.append("file", uploadFile);
                if (opts.existingListId) {
                    formData.append("listId", opts.existingListId);
                    formData.append("whenAlreadyWorkedOn", whenAlreadyWorkedOn);
                } else if (importMode === "existing" && listId) {
                    formData.append("listId", listId);
                    formData.append("whenAlreadyWorkedOn", whenAlreadyWorkedOn);
                } else {
                    formData.append("missionId", missionId);
                    formData.append("listName", listName);
                }
                formData.append("mappings", JSON.stringify(mappings));
                formData.append("importType", importType);
                formData.append("importActions", String(importActions));
                if (assignedSdrId) {
                    formData.append("assignedSdrId", assignedSdrId);
                }
                formData.append("actionColumnMapping", JSON.stringify(actionColumnMapping));
                if (actionColumnMode === "multi-column") {
                    formData.append("actionColumnMode", actionColumnMode);
                    formData.append("actionColumnGroups", JSON.stringify(actionColumnGroups));
                }
                formData.append("statusMappings", JSON.stringify(statusMappings));
                formData.append("channelMappings", JSON.stringify(channelMappings));
                if ((opts.chunkRows ?? 0) > 0) formData.append("totalRows", String(opts.chunkRows));

                const res = await fetch("/api/lists/import", { method: "POST", body: formData });
                if (!res.ok || !res.body) {
                    const json = await res.json().catch(() => ({}));
                    if (res.status === 413) return { error: "Le fichier est trop gros pour un envoi unique." };
                    return { error: (json as { error?: string }).error || "L'import a échoué" };
                }

                const reader = res.body.getReader();
                const dec = new TextDecoder();
                let buffer = "";
                let doneData: ImportDoneData | undefined;
                let errorMsg: string | undefined;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += dec.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() ?? "";
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        try {
                            const msg = JSON.parse(trimmed) as { type: string; percent?: number; data?: ImportDoneData; error?: string };
                            if (msg.type === "progress" && msg.percent != null) {
                                if (opts.totalRowsAll && opts.chunkRows && opts.processedRowsBefore != null) {
                                    const processedThisChunk = Math.round((msg.percent / 100) * opts.chunkRows);
                                    const globalPercent = Math.min(
                                        100,
                                        Math.round(((opts.processedRowsBefore + processedThisChunk) / opts.totalRowsAll) * 100)
                                    );
                                    setImportProgress(globalPercent);
                                } else {
                                    setImportProgress(msg.percent);
                                }
                            }
                            if (msg.type === "done" && msg.data) doneData = msg.data;
                            if (msg.type === "error" && msg.error) errorMsg = msg.error;
                        } catch {
                            // ignore malformed lines
                        }
                    }
                }

                if (errorMsg) return { error: errorMsg };
                if (!doneData) return { error: "Réponse invalide" };
                return { data: doneData };
            };

            const shouldChunk = file.size > IMPORT_CHUNK_THRESHOLD_BYTES && parsedRows.length > 3000;
            if (!shouldChunk) {
                const single = await uploadChunk(file, { chunkRows: totalRows, processedRowsBefore: 0, totalRowsAll: totalRows });
                if (single.error || !single.data) {
                    showError("Erreur", single.error || "L'import a échoué");
                    return;
                }
                setImportProgress(100);
                setImportResult({
                    companies: single.data.companiesCreated,
                    contacts: single.data.contactsCreated,
                    actions: single.data.actionsCreated,
                    errors: single.data.errors,
                    errorDetails: (single.data as { errorDetails?: string[] }).errorDetails,
                });
                setStep(5);
                success("Import réussi", `${single.data.companiesCreated} sociétés et ${single.data.contactsCreated} contacts importés`);
                return;
            }

            const csvChunks = splitRowsIntoChunks(parsedRows, 2500);
            if (csvChunks.length === 0) {
                showError("Erreur", "Le fichier CSV est vide");
                return;
            }

            let targetListId = importMode === "existing" ? listId : "";
            let companiesTotal = 0;
            let contactsTotal = 0;
            let actionsTotal = 0;
            let errorsTotal = 0;
            const allErrors: string[] = [];
            let processedRowsBefore = 0;

            for (let i = 0; i < csvChunks.length; i++) {
                const chunkText = csvChunks[i];
                const chunkRows = Math.min(2500, parsedRows.length - (i * 2500));
                const chunkFile = new File([chunkText], `${file.name.replace(/\.csv$/i, "")}-part-${i + 1}.csv`, { type: "text/csv" });
                const result = await uploadChunk(chunkFile, {
                    existingListId: targetListId || undefined,
                    chunkRows,
                    processedRowsBefore,
                    totalRowsAll: totalRows,
                });
                if (result.error || !result.data) {
                    showError("Erreur", result.error || "L'import a échoué");
                    return;
                }
                targetListId = result.data.listId || targetListId;
                companiesTotal += result.data.companiesCreated;
                contactsTotal += result.data.contactsCreated;
                actionsTotal += result.data.actionsCreated ?? 0;
                errorsTotal += result.data.errors;
                if ((result.data as { errorDetails?: string[] }).errorDetails) {
                    allErrors.push(...((result.data as { errorDetails?: string[] }).errorDetails || []));
                }
                processedRowsBefore += chunkRows;
                setImportProgress(Math.min(100, Math.round((processedRowsBefore / Math.max(totalRows, 1)) * 100)));
            }

            setImportProgress(100);
            setImportResult({
                companies: companiesTotal,
                contacts: contactsTotal,
                actions: actionsTotal,
                errors: errorsTotal,
                errorDetails: allErrors,
            });
            setStep(5);
            success("Import réussi", `${companiesTotal} sociétés et ${contactsTotal} contacts importés`);
        } catch (err) {
            console.error("Import failed:", err);
            showError("Erreur", "L'import a échoué");
        } finally {
            setIsImporting(false);
            setImportProgress(null);
        }
    };

    const downloadErrorsCsv = () => {
        if (!importResult?.errorDetails || importResult.errorDetails.length === 0) return;
        const csvContent = Papa.unparse(
            importResult.errorDetails.map((err, i) => ({
                Ligne: i + 1,
                Motif: err,
            }))
        );
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `erreurs_import_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ============================================
    // STEP INDICATORS
    // ============================================

    const steps = [
        { num: 1, label: "Fichier", icon: Upload },
        { num: 2, label: "Type", icon: Building2 },
        { num: 3, label: "Mapping", icon: ArrowRight },
        { num: 4, label: "Validation", icon: CheckCircle2 },
        { num: 5, label: "Import", icon: Database },
    ];

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className={`elan-page mx-auto transition-all duration-300 ${step === 3 ? "max-w-7xl" : "max-w-4xl"}`}>
            {/* Header */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-5">
                <div className="flex items-center gap-4">
                <Link href="/manager/lists">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Importer CSV</h1>
                    <p className="text-slate-500 mt-1">
                        Importez des societes, contacts, et historique d&apos;actions en 5 etapes
                    </p>
                </div>
            </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/80 border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">Fichier</p>
                        <p className="text-sm font-medium text-slate-900 truncate">{file?.name || "Aucun fichier"}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">Mission</p>
                        <p className="text-sm font-medium text-slate-900 truncate">{missions.find(m => m.id === missionId)?.name || "Non selectionnee"}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-slate-200 p-3">
                        <p className="text-xs text-slate-500">Mapping</p>
                        <p className="text-sm font-medium text-slate-900">{mappedCount}/{csvHeaders.length || 0} colonnes</p>
                    </div>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-between">
                {steps.map((s, i) => (
                    <div key={s.num} className="flex items-center">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${step >= s.num
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-slate-100 text-slate-500"
                            }`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > s.num
                                ? "bg-indigo-500 text-white"
                                : step === s.num
                                    ? "bg-indigo-500 text-white"
                                    : "bg-slate-300 text-slate-600"
                                }`}>
                                {step > s.num ? <Check className="w-3 h-3" /> : s.num}
                            </span>
                            <span className="text-sm font-medium">{s.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`w-12 h-0.5 mx-2 ${step > s.num ? "bg-indigo-500" : "bg-slate-200"
                                }`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step 1: File & Mission Selection */}
            {step === 1 && (
                <Card>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Destination
                            </label>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setImportMode("new")}
                                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${importMode === "new"
                                        ? "border-indigo-500 bg-indigo-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                >
                                    <span className="font-semibold text-slate-900">Nouvelle liste</span>
                                    <p className="text-sm text-slate-500 mt-1">Créer une nouvelle liste dans la mission</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImportMode("existing")}
                                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${importMode === "existing"
                                        ? "border-indigo-500 bg-indigo-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}
                                >
                                    <span className="font-semibold text-slate-900">Ajouter à une liste existante</span>
                                    <p className="text-sm text-slate-500 mt-1">Mapper les colonnes et fusionner avec la liste</p>
                                </button>
                            </div>
                        </div>

                        <Select
                            label="Mission *"
                            placeholder="Sélectionner une mission..."
                            options={missions.map(m => ({ value: m.id, label: m.name }))}
                            value={missionId}
                            onChange={(v) => { setMissionId(v); setListId(""); }}
                            searchable
                        />

                        {importMode === "new" ? (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nom de la liste *
                                </label>
                                <input
                                    type="text"
                                    value={listName}
                                    onChange={(e) => setListName(e.target.value)}
                                    placeholder="Ex: Liste CSV Mars 2025"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        ) : (
                            <>
                                <Select
                                    label="Liste existante *"
                                    placeholder={missionId ? "Choisir une liste..." : "Sélectionnez d'abord une mission"}
                                    options={lists.map(l => ({ value: l.id, label: l.name }))}
                                    value={listId}
                                    onChange={setListId}
                                    searchable
                                    disabled={!missionId || lists.length === 0}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Si la société existe déjà et a déjà été travaillée
                                    </label>
                                    <select
                                        value={whenAlreadyWorkedOn}
                                        onChange={(e) => setWhenAlreadyWorkedOn(e.target.value as "skip" | "add_anyway")}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="skip">Ignorer la ligne (ne pas ajouter)</option>
                                        <option value="add_anyway">Ajouter quand même (nouveaux contacts possibles)</option>
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">
                                        « Déjà travaillée » = la société a au moins une action enregistrée.
                                    </p>
                                </div>
                            </>
                        )}

                        <FileUpload
                            label="Fichier CSV *"
                            accept=".csv"
                            maxSize={200}
                            onFilesSelected={handleFileSelected}
                        />

                        <div className="flex justify-end">
                            <Button
                                variant="primary"
                                onClick={() => setStep(2)}
                                disabled={!canGoToType}
                                className="gap-2"
                            >
                                Suivant
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Step 2: Import Type Selection */}
            {step === 2 && (
                <Card>
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 mb-2">Type d'import</h2>
                            <p className="text-sm text-slate-500">
                                Choisissez ce que vous souhaitez importer depuis votre fichier CSV
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setImportType("companies-only")}
                                className={`p-6 rounded-xl border-2 transition-all text-left ${importType === "companies-only"
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${importType === "companies-only"
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-slate-100 text-slate-400"
                                        }`}>
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-900 mb-1">Sociétés uniquement</h3>
                                        <p className="text-sm text-slate-600">
                                            Importez uniquement les sociétés. Les SDR pourront appeler directement les sociétés qui ont un numéro de téléphone.
                                        </p>
                                    </div>
                                    {importType === "companies-only" && (
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={() => setImportType("companies-contacts")}
                                className={`p-6 rounded-xl border-2 transition-all text-left ${importType === "companies-contacts"
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${importType === "companies-contacts"
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-slate-100 text-slate-400"
                                        }`}>
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-900 mb-1">Sociétés + Contacts</h3>
                                        <p className="text-sm text-slate-600">
                                            Importez les sociétés avec leurs contacts associés. Permet un ciblage plus précis.
                                        </p>
                                    </div>
                                    {importType === "companies-contacts" && (
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                    )}
                                </div>
                            </button>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Retour
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => setStep(3)}
                                className="gap-2"
                            >
                                Suivant
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Step 3: Column Mapping */}
            {step === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Mapping Controls */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                        <Card>
                            <div className="space-y-6">
                                {/* Header with Stats */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                            Mapper les colonnes
                                            <Badge variant="primary" className="text-xs">
                                                {mappedCount}/{csvHeaders.length} mappées
                                            </Badge>
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Associez chaque colonne CSV à un champ de données
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Tooltip content="Détection automatique basée sur les noms de colonnes et suggestions IA">
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-lg">
                                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                                <span className="text-sm font-medium text-indigo-700">Auto-détecté</span>
                                            </div>
                                        </Tooltip>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-slate-800">Progression du mapping</p>
                                        <p className="text-xs text-slate-500">{mappingCompletion}%</p>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${mappingCompletion}%` }} />
                                    </div>
                                    {!requiredMapped && (
                                        <p className="text-xs text-rose-600 mt-2">Le champ obligatoire `Nom de société` n&apos;est pas encore mappé.</p>
                                    )}
                                </div>

                                {/* Assistant IA de mapping */}
                                <AiMappingAssistant
                                    headers={csvHeaders}
                                    sampleRows={previewData}
                                    importType={importType}
                                    onApplySuggestions={handleApplyAiSuggestions}
                                    onApplyActionSuggestions={handleApplyAiActionSuggestions}
                                />

                                {/* Presets Toolbar */}
                        <div className="flex flex-col gap-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Presets d&apos;import rapides :</span>
                                </div>
                                <span className="text-[11px] text-slate-400">Cliquez pour appliquer un mapping standard</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {CSV_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleApplyPreset(preset.id)}
                                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors shadow-sm flex items-center gap-1.5"
                                    >
                                        <span>{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {detectedPresetInfo && (
                            <div className="flex items-center justify-between p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-800">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                    <span>
                                        Format <strong>{detectedPresetInfo.name}</strong> détecté ({detectedPresetInfo.count} colonnes automatiquement reconnues).
                                    </span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleApplyPreset(detectedPresetInfo.id)}
                                    className="h-7 text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                >
                                    Réappliquer
                                </Button>
                            </div>
                        )}

                        {/* Bulk Actions Toolbar */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher une colonne..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setMappings(mappings.map(m => ({ ...m, targetField: "" })));
                                    }}
                                    className="gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Réinitialiser
                                </Button>
                            </div>

                            {/* Action history toggle */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-slate-500" />
                                        <p className="text-sm font-medium text-slate-900">Prospects déjà travaillés ?</p>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Activez cette option pour importer l&apos;historique des statuts (appels, emails, LinkedIn) depuis votre CSV.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setImportActions(!importActions)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${importActions ? "bg-indigo-600" : "bg-slate-300"}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${importActions ? "translate-x-5" : ""}`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {mappings
                                .filter(m => !searchQuery || m.csvColumn.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((mapping, i) => {
                                const availableFields = importType === "companies-only" ? [...COMPANY_FIELDS] : [...ALL_FIELDS];
                                const currentTarget = mapping.targetField;
                                const isCustomCompany = currentTarget.startsWith("company.") && !COMPANY_FIELDS.some(f => f.value === currentTarget);
                                const isCustomContact = currentTarget.startsWith("contact.") && !CONTACT_FIELDS.some(f => f.value === currentTarget);

                                if (isCustomCompany) {
                                    availableFields.push({ value: currentTarget, label: `Société (Perso): ${currentTarget.replace('company.', '')}` });
                                }
                                if (isCustomContact) {
                                    availableFields.push({ value: currentTarget, label: `Contact (Perso): ${currentTarget.replace('contact.', '')}` });
                                }

                                const getFieldIcon = () => {
                                    if (currentTarget.startsWith("company.")) return <Building2 className="w-4 h-4 text-blue-500" />;
                                    if (currentTarget.startsWith("contact.")) return <User className="w-4 h-4 text-purple-500" />;
                                    return null;
                                };

                                return (
                                    <div key={mapping.csvColumn} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <p className="text-sm font-semibold text-slate-900">{mapping.csvColumn}</p>
                                                {currentTarget && getFieldIcon()}
                                                {mapping.confidence != null && mapping.targetField && (
                                                    <span
                                                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            mapping.confidence >= 85
                                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                                : mapping.confidence >= 65
                                                                ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                                                : "bg-amber-100 text-amber-800 border border-amber-200"
                                                        }`}
                                                        title={mapping.reasoning || `${mapping.confidence}% certitude`}
                                                    >
                                                        <Sparkles className="w-2.5 h-2.5" />
                                                        {mapping.confidence}%
                                                    </span>
                                                )}
                                                {mapping.isCustomField && (
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                                                        Perso
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">
                                                Exemple: {previewData[0]?.[mapping.csvColumn] || "—"}
                                            </p>
                                            {mapping.reasoning && (
                                                <p className="text-[11px] text-indigo-600/80 truncate mt-0.5">
                                                    💡 {mapping.reasoning}
                                                </p>
                                            )}
                                            {(() => {
                                                const stat = columnStats.find(s => s.column === mapping.csvColumn);
                                                if (!stat) return null;
                                                const fillRate = stat.totalRows > 0 ? Math.round((stat.filledRows / stat.totalRows) * 100) : 0;
                                                return (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                            rempli {fillRate}%
                                                        </span>
                                                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                            {stat.uniqueValues} uniques
                                                        </span>
                                                        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                                            {stat.dataType}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        <Select
                                            options={availableFields}
                                            value={mapping.targetField}
                                            onChange={(value) => {
                                                const newMappings = [...mappings];
                                                const actualIndex = mappings.findIndex(m => m.csvColumn === mapping.csvColumn);
                                                if (value === "__custom_company__") {
                                                    setCustomFieldPrompt({ index: actualIndex, type: 'company' });
                                                    setCustomFieldValue("");
                                                } else if (value === "__custom_contact__") {
                                                    setCustomFieldPrompt({ index: actualIndex, type: 'contact' });
                                                    setCustomFieldValue("");
                                                } else {
                                                    newMappings[actualIndex].targetField = value;
                                                    newMappings[actualIndex].confidence = undefined;
                                                    newMappings[actualIndex].reasoning = undefined;
                                                    newMappings[actualIndex].isCustomField = false;
                                                    setMappings(newMappings);
                                                }
                                            }}
                                            className="w-56 flex-shrink-0"
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Action history configuration */}
                        {importActions && (
                            <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                        Historique des actions
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Configurez les colonnes pour reconstruire l&apos;historique des statuts et des notes de vos prospects.
                                    </p>
                                </div>
                                <Select
                                    label="Assigner l'historique à (SDR) *"
                                    placeholder="Sélectionner un SDR..."
                                    options={sdrOptions.map((s) => ({
                                        value: s.id,
                                        label: `${s.name} (${s.role === "BUSINESS_DEVELOPER" ? "BD" : "SDR"})`,
                                    }))}
                                    value={assignedSdrId}
                                    onChange={setAssignedSdrId}
                                    searchable
                                />
                                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                                    <p className="text-xs font-medium text-indigo-800 mb-1">Format multi-appels accepte</p>
                                    <p className="text-xs text-indigo-700">
                                        Vous pouvez separer les sequences avec <strong>;</strong>, <strong>|</strong>, retour a la ligne, <strong>-&gt;</strong>, <strong>=&gt;</strong>, <strong>→</strong> ou <strong>»</strong>.
                                    </p>
                                    <p className="text-[11px] text-indigo-700 mt-1">
                                        Exemple: <span className="font-medium">No answer ; Callback requested ; Meeting booked</span>
                                    </p>
                                </div>
                                {isWorkedConflictActive && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                        <p className="text-xs font-semibold text-amber-800">Attention: regle potentiellement contradictoire</p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            Vous avez active l&apos;historique multi-actions, mais en destination vous avez choisi
                                            <span className="font-medium"> &quot;Ignorer les societes deja travaillees&quot;</span>. Les actions
                                            historiques de ces societes seront ignorees.
                                        </p>
                                        <p className="text-[11px] text-amber-700 mt-1">
                                            Conseil: passez sur &quot;Ajouter quand meme&quot; si vous voulez conserver tout l&apos;historique.
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-slate-700">Mode de mapping des actions</p>
                                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                                            <button
                                                type="button"
                                                className={`px-3 py-1.5 text-xs rounded ${actionColumnMode === "single" ? "bg-indigo-600 text-white" : "text-slate-700"}`}
                                                onClick={() => setActionColumnMode("single")}
                                            >
                                                Colonne unique
                                            </button>
                                            <button
                                                type="button"
                                                className={`px-3 py-1.5 text-xs rounded ${actionColumnMode === "multi-column" ? "bg-indigo-600 text-white" : "text-slate-700"}`}
                                                onClick={() => setActionColumnMode("multi-column")}
                                            >
                                                Multi-colonnes
                                            </button>
                                        </div>
                                    </div>

                                    {actionColumnMode === "single" ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-700">Colonne statut</p>
                                                <Select
                                                    options={[
                                                        { value: "", label: "Ignorer" },
                                                        ...csvHeaders.map(h => ({ value: h, label: h })),
                                                    ]}
                                                    value={actionColumnMapping.statusColumn}
                                                    onChange={(value) =>
                                                        setActionColumnMapping(prev => ({ ...prev, statusColumn: value }))
                                                    }
                                                />
                                                <p className="text-xs text-slate-500">
                                                    Valeurs comme &quot;Tentative&quot;, &quot;Meeting booké&quot;, etc.
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-700">Colonne date</p>
                                                <Select
                                                    options={[
                                                        { value: "", label: "Ignorer" },
                                                        ...csvHeaders.map(h => ({ value: h, label: h })),
                                                    ]}
                                                    value={actionColumnMapping.dateColumn}
                                                    onChange={(value) =>
                                                        setActionColumnMapping(prev => ({ ...prev, dateColumn: value }))
                                                    }
                                                />
                                                <p className="text-xs text-slate-500">
                                                    Date à laquelle l&apos;action a eu lieu (optionnel).
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-700">Colonne date callback / RDV</p>
                                                <Select
                                                    options={[
                                                        { value: "", label: "Ignorer" },
                                                        ...csvHeaders.map(h => ({ value: h, label: h })),
                                                    ]}
                                                    value={actionColumnMapping.callbackDateColumn}
                                                    onChange={(value) =>
                                                        setActionColumnMapping(prev => ({ ...prev, callbackDateColumn: value }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-700">Colonne note</p>
                                                <Select
                                                    options={[
                                                        { value: "", label: "Ignorer" },
                                                        ...csvHeaders.map(h => ({ value: h, label: h })),
                                                    ]}
                                                    value={actionColumnMapping.noteColumn}
                                                    onChange={(value) =>
                                                        setActionColumnMapping(prev => ({ ...prev, noteColumn: value }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium text-slate-700">Colonne canal</p>
                                                <Select
                                                    options={[
                                                        { value: "", label: "Ignorer" },
                                                        ...csvHeaders.map(h => ({ value: h, label: h })),
                                                    ]}
                                                    value={actionColumnMapping.channelColumn}
                                                    onChange={(value) =>
                                                        setActionColumnMapping(prev => ({ ...prev, channelColumn: value }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {actionColumnGroups.map((group, idx) => (
                                                <div key={group.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-medium text-slate-900">Appel {idx + 1}</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeActionColumnGroup(group.id)}
                                                            className="h-7 text-xs text-rose-600"
                                                        >
                                                            Supprimer
                                                        </Button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <Select
                                                            label="Statut"
                                                            options={[{ value: "", label: "Ignorer" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
                                                            value={group.statusColumn}
                                                            onChange={(value) => updateActionColumnGroup(group.id, { statusColumn: value })}
                                                        />
                                                        <Select
                                                            label="Date"
                                                            options={[{ value: "", label: "Ignorer" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
                                                            value={group.dateColumn}
                                                            onChange={(value) => updateActionColumnGroup(group.id, { dateColumn: value })}
                                                        />
                                                        <Select
                                                            label="Note"
                                                            options={[{ value: "", label: "Ignorer" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
                                                            value={group.noteColumn}
                                                            onChange={(value) => updateActionColumnGroup(group.id, { noteColumn: value })}
                                                        />
                                                        <Select
                                                            label="Canal"
                                                            options={[{ value: "", label: "Ignorer" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
                                                            value={group.channelColumn}
                                                            onChange={(value) => updateActionColumnGroup(group.id, { channelColumn: value })}
                                                        />
                                                        <Select
                                                            label="Date callback / RDV"
                                                            options={[{ value: "", label: "Ignorer" }, ...csvHeaders.map(h => ({ value: h, label: h }))]}
                                                            value={group.callbackDateColumn}
                                                            onChange={(value) => updateActionColumnGroup(group.id, { callbackDateColumn: value })}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            <Button
                                                variant="secondary"
                                                onClick={addActionColumnGroup}
                                                className="gap-2"
                                            >
                                                Ajouter un appel
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Status mappings */}
                                {detectedStatuses.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-medium text-slate-700">
                                                Mapping des statuts CSV vers les résultats CRM
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" onClick={autoMapStatusValues} className="h-7 text-xs">
                                                    Auto-mapper
                                                </Button>
                                                {statusMappings.some(m => !m.actionResult) && (
                                                    <span className="text-[11px] text-amber-600">
                                                        Certains statuts ne sont pas encore mappes
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Statut CSV</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Occurrences</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Résultat CRM</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {statusMappings.map((m, idx) => (
                                                        <tr key={m.csvValue} className="border-t border-slate-100">
                                                            <td className="px-3 py-1.5 text-slate-900">{m.csvValue}</td>
                                                            <td className="px-3 py-1.5 text-slate-500">{m.count}</td>
                                                            <td className="px-3 py-1.5">
                                                                <Select
                                                                    options={Object.entries(ACTION_RESULT_LABELS).map(([value, label]) => ({
                                                                        value,
                                                                        label,
                                                                    }))}
                                                                    value={m.actionResult}
                                                                    onChange={(value) => {
                                                                        const next = [...statusMappings];
                                                                        next[idx] = { ...next[idx], actionResult: value };
                                                                        setStatusMappings(next);
                                                                    }}
                                                                    className="w-52"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Channel mappings (optional) */}
                                {(
                                    (actionColumnMode === "single" && !!actionColumnMapping.channelColumn) ||
                                    (actionColumnMode === "multi-column" && actionColumnGroups.some((g) => !!g.channelColumn))
                                ) && detectedChannels.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-slate-700">
                                            Mapping des valeurs de canal vers les canaux CRM
                                        </p>
                                        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Canal CSV</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Occurrences</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Canal CRM</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {channelMappings.map((m, idx) => (
                                                        <tr key={m.csvValue} className="border-t border-slate-100">
                                                            <td className="px-3 py-1.5 text-slate-900">{m.csvValue}</td>
                                                            <td className="px-3 py-1.5 text-slate-500">{m.count}</td>
                                                            <td className="px-3 py-1.5">
                                                                <Select
                                                                    options={[
                                                                        { value: 'CALL', label: 'Appel' },
                                                                        { value: 'EMAIL', label: 'Email' },
                                                                        { value: 'LINKEDIN', label: 'LinkedIn' },
                                                                    ]}
                                                                    value={m.channel}
                                                                    onChange={(value) => {
                                                                        const next = [...channelMappings];
                                                                        next[idx] = { ...next[idx], channel: value as 'CALL' | 'EMAIL' | 'LINKEDIN' };
                                                                        setChannelMappings(next);
                                                                    }}
                                                                    className="w-40"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {(
                                    (actionColumnMode === "single" && !!actionColumnMapping.statusColumn) ||
                                    (actionColumnMode === "multi-column" && actionColumnGroups.some((g) => !!g.statusColumn))
                                ) && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-slate-700">Reconstruction avant import (simulation CRM)</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            {reconstructedActionPreview.map((row, rowIdx) => (
                                                <div key={`reco-${rowIdx}`} className="rounded-lg border border-slate-200 bg-white p-3">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {row.companyName} - {row.actionCount} action{row.actionCount > 1 ? "s" : ""} detectee{row.actionCount > 1 ? "s" : ""}
                                                    </p>
                                                    <div className="mt-2 space-y-1.5">
                                                        {row.actions.length > 0 ? row.actions.map((action, actionIdx) => (
                                                            <div key={`reco-${rowIdx}-action-${actionIdx}`} className="text-xs text-slate-700">
                                                                <span>{action.channelEmoji} {action.channelLabel}</span>
                                                                <span> · {action.date || "date non fournie"}</span>
                                                                <span> · {action.mappedLabel || action.sourceStatus}</span>
                                                                {action.callbackDate && (
                                                                    <span> -&gt; RDV/Rappel {action.callbackDate}</span>
                                                                )}
                                                                {action.note && (
                                                                    <span> · "{action.note}"</span>
                                                                )}
                                                            </div>
                                                        )) : (
                                                            <p className="text-xs text-slate-500">Aucune action detectee pour cet exemple.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs font-medium text-slate-700">Apercu sequence multi-actions (3 premieres lignes)</p>
                                        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Ligne</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Actions detectees</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Exemple de sequence</th>
                                                        <th className="px-3 py-2 text-left text-slate-700 font-medium">Qualite</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sequencePreviewRows.map((row) => (
                                                        <tr key={`seq-preview-${row.rowNumber}`} className="border-t border-slate-100">
                                                            <td className="px-3 py-2 text-slate-900">#{row.rowNumber}</td>
                                                            <td className="px-3 py-2 text-slate-700">{row.actionCount || 0}</td>
                                                            <td className="px-3 py-2 text-slate-600 max-w-[420px] truncate">
                                                                {row.statuses.length > 0 ? row.statuses.join(" -> ") : "Aucune sequence"}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                {row.hasPotentialMisalignment ? (
                                                                    <span className="text-amber-600">A verifier (tailles differentes)</span>
                                                                ) : (
                                                                    <span className="text-emerald-600">OK</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Preview */}
                        <div>
                            <h3 className="text-sm font-medium text-slate-700 mb-2">Aperçu des données</h3>
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                            {csvHeaders.slice(0, 5).map(h => (
                                                <th key={h} className="text-left py-2 px-3 text-slate-700 font-medium">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.slice(0, 3).map((row, i) => (
                                            <tr key={i} className="border-b border-slate-100 last:border-0">
                                                {csvHeaders.slice(0, 5).map(h => (
                                                    <td key={h} className="py-2 px-3 text-slate-600 truncate max-w-[200px]">
                                                        {row[h] || "—"}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Retour
                            </Button>
                            <Button variant="primary" onClick={validateData} className="gap-2">
                                Valider
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Right Column: Sticky Live CRM Lead Preview */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-6 space-y-4">
                <LiveCrmLeadPreview
                    sampleRows={previewData}
                    mappings={mappings}
                    importType={importType}
                    actionColumnMapping={actionColumnMapping}
                    importActions={importActions}
                />

                {/* Summary / Readiness Box */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm text-xs space-y-2.5">
                    <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-100 pb-2">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                            Statut du mapping
                        </span>
                        <span className="text-indigo-600 font-mono">{mappedCount} / {csvHeaders.length} colonnes</span>
                    </div>
                    <div className="space-y-1.5 text-slate-600">
                        <div className="flex items-center justify-between">
                            <span>Nom de société :</span>
                            <span className={requiredMapped ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                                {requiredMapped ? "✅ Mappé" : "❌ Requis"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Lignes CSV détectées :</span>
                            <span className="font-semibold text-slate-800">{totalRows.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Mode d&apos;import :</span>
                            <span className="font-medium text-slate-800">
                                {importType === "companies-only" ? "Sociétés seules" : "Sociétés + Contacts"}
                            </span>
                        </div>
                        {importActions && (
                            <div className="flex items-center justify-between text-amber-700">
                                <span>Historique actions :</span>
                                <span className="font-semibold">Activé</span>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="primary"
                        onClick={validateData}
                        disabled={!requiredMapped}
                        className="w-full mt-2 gap-1.5 text-xs py-2 h-9"
                    >
                        <span>Continuer vers validation</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )}

            {/* Step 4: Validation */}
            {step === 4 && validationResult && (
                <Card>
                    <div className="space-y-6">
                        <div className="text-center py-8">
                            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-slate-900">Prêt pour l&apos;import</h2>
                            <p className="text-slate-500 mt-1">
                                {validationResult.valid} lignes valides détectées
                            </p>
                        </div>

                        {validationResult.warnings.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-700">Avertissements</p>
                                        <ul className="text-sm text-amber-600 mt-1 space-y-1">
                                            {validationResult.warnings.map((w, i) => (
                                                <li key={i}>• {w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 rounded-xl p-4">
                            <h3 className="font-medium text-slate-900 mb-2">Résumé de l&apos;import</h3>
                            <ul className="text-sm text-slate-600 space-y-1">
                                <li>• {importMode === "existing" ? "Liste existante: " : "Liste: "}<span className="text-slate-900 font-medium">{importMode === "existing" ? lists.find(l => l.id === listId)?.name ?? listId : listName}</span></li>
                                <li>• Mission: <span className="text-slate-900 font-medium">{missions.find(m => m.id === missionId)?.name}</span></li>
                                <li>• Type: <span className="text-slate-900 font-medium">
                                    {importType === "companies-only" ? "Sociétés uniquement" : "Sociétés + Contacts"}
                                </span></li>
                                <li>• Fichier: <span className="text-slate-900 font-medium">{file?.name}</span></li>
                                <li>• Lignes: <span className="text-slate-900 font-medium">{validationResult.valid}</span></li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-3">
                            {isImporting && importProgress != null && (
                                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${importProgress}%` }}
                                    />
                                </div>
                            )}
                            <div className="flex justify-between">
                                <Button variant="ghost" onClick={() => setStep(3)} className="gap-2" disabled={isImporting}>
                                    <ArrowLeft className="w-4 h-4" />
                                    Retour
                                </Button>
                                <Button
                                    variant="success"
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="gap-2"
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {importProgress != null ? `Import… ${importProgress}%` : "Import en cours…"}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Lancer l&apos;import
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Step 5: Result */}
            {step === 5 && importResult && (
                <Card>
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900">Import terminé !</h2>
                        <p className="text-slate-500 mt-1">
                            {importResult.companies} sociétés et {importResult.contacts} contacts importés
                            {importResult.actions ? ` (${importResult.actions} actions créées)` : ""}
                        </p>

                        {importResult.errors > 0 && (
                            <div className="mt-6 max-w-lg mx-auto p-4 rounded-xl bg-rose-50 border border-rose-200 text-left shadow-sm">
                                <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm mb-1">
                                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                    <span>{importResult.errors} ligne{importResult.errors > 1 ? "s" : ""} n&apos;ont pas pu être importée{importResult.errors > 1 ? "s" : ""}</span>
                                </div>
                                <p className="text-xs text-rose-700 mb-3">
                                    Certaines lignes présentaient des anomalies (nom de société manquant ou colonnes incomplètes).
                                </p>
                                {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                                    <ul className="text-xs text-rose-700 mb-3 space-y-1 list-disc pl-4 bg-white/70 p-2.5 rounded-lg border border-rose-100 max-h-36 overflow-y-auto font-mono">
                                        {importResult.errorDetails.slice(0, 5).map((e, idx) => (
                                            <li key={idx}>{e}</li>
                                        ))}
                                        {importResult.errorDetails.length > 5 && (
                                            <li className="text-slate-400 italic font-sans list-none">... et {importResult.errorDetails.length - 5} autres erreurs</li>
                                        )}
                                    </ul>
                                )}
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={downloadErrorsCsv}
                                    className="w-full gap-2 text-rose-700 border-rose-300 hover:bg-rose-100 bg-white"
                                >
                                    <Download className="w-4 h-4" />
                                    Télécharger le rapport d&apos;erreurs CSV
                                </Button>
                            </div>
                        )}

                        <div className="flex justify-center gap-4 mt-8">
                            <Link href="/manager/lists">
                                <Button variant="secondary" className="gap-2">
                                    <Table className="w-4 h-4" />
                                    Voir les listes
                                </Button>
                            </Link>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setStep(1);
                                    setFile(null);
                                    setMissionId("");
                                    setListName("");
                                    setCsvHeaders([]);
                                    setMappings([]);
                                    setPreviewData([]);
                                    setAssignedSdrId("");
                                    setValidationResult(null);
                                    setImportResult(null);
                                }}
                                className="gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Nouvel import
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
            {/* Custom Field Modal */}
            <Modal
                isOpen={customFieldPrompt !== null}
                onClose={() => setCustomFieldPrompt(null)}
                title={customFieldPrompt?.type === 'company' ? "Champ personnalisé société" : "Champ personnalisé contact"}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        Saisissez le nom du champ personnalisé à utiliser. Ne mettez pas d'espaces.
                    </p>
                    <Input
                        label="Nom du champ"
                        placeholder={customFieldPrompt?.type === 'company' ? "ex: revenue, techStack" : "ex: department, seniority"}
                        value={customFieldValue}
                        onChange={(e) => setCustomFieldValue(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setCustomFieldPrompt(null)}>
                            Annuler
                        </Button>
                        <Button
                            variant="primary"
                            disabled={!customFieldValue.trim()}
                            onClick={() => {
                                if (customFieldPrompt && customFieldValue.trim()) {
                                    const newMappings = [...mappings];
                                    const prefix = customFieldPrompt.type === 'company' ? 'company' : 'contact';
                                    const sanitized = customFieldValue.trim().replace(/\s+/g, '_');
                                    newMappings[customFieldPrompt.index].targetField = `${prefix}.${sanitized}`;
                                    setMappings(newMappings);
                                    setCustomFieldPrompt(null);
                                }
                            }}
                        >
                            Valider
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
