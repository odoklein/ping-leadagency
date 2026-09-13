/**
 * Client daily report — generation.
 *
 * Lazy by design: the report for a given Paris day is built the first time the
 * client opens the page, then reused for every later visit that day. The
 * unique (clientId, reportDate) row doubles as the lock, so two tabs opening at
 * once produce one row and one Mistral call.
 *
 * Deliberately free of any Request/Response coupling: a nightly cron route can
 * call generateClientDailyReport() for every active client without changes.
 */

import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DISPLAY_TZ } from "@/lib/date";
import { getMistralModel, mistralFetch } from "@/lib/ai/mistral";
import { safeParseJsonFromModel } from "@/lib/ai/json";
import { buildClientDailyMetrics } from "./metrics";
import { buildNarrativePrompt, SYSTEM_PROMPT } from "./prompt";
import {
    narrativeSchema,
    type ClientDailyMetrics,
    type ClientDailyReportStatus,
    type ClientReportNarrative,
} from "./types";

const ZONE = DISPLAY_TZ;
/** A pending row older than this was abandoned (crash, timeout) and can be reclaimed. */
const PENDING_STALE_MS = 3 * 60 * 1000;
/** Mistral's free tier rate-limits bursts; one retry absorbs it. */
const RETRY_DELAY_MS = 2500;

/**
 * Model for the narrative. Defaults to the account-safe model resolved by
 * lib/ai/mistral (mistral-small-latest unless MISTRAL_MODEL says otherwise);
 * set CLIENT_REPORT_MODEL to give this report a stronger model than the rest
 * of the app once the subscription tier allows it.
 */
function getReportModel(): string {
    return process.env.CLIENT_REPORT_MODEL || getMistralModel();
}

export interface GenerateParams {
    clientId: string;
    /** Paris day to generate. Defaults to today. */
    reportDate?: Date | string;
    /** Regenerate even if a completed report already exists. */
    force?: boolean;
}

export interface GenerateResult {
    status: ClientDailyReportStatus;
    reportDate: string;
    metrics: ClientDailyMetrics;
    narrative: ClientReportNarrative | null;
    generatedAt: string | null;
    modelUsed: string | null;
    /** True when another request is already generating this report. */
    inFlight?: boolean;
}

/** Paris calendar day as the UTC-midnight Date a @db.Date column expects. */
export function toReportDateKey(value?: Date | string): Date {
    const day = value
        ? DateTime.fromJSDate(new Date(value), { zone: ZONE })
        : DateTime.now().setZone(ZONE);
    return new Date(`${day.toISODate()}T00:00:00.000Z`);
}

export function reportDateToIso(value: Date): string {
    return DateTime.fromJSDate(value, { zone: "utc" }).toISODate() ?? "";
}

/**
 * Deterministic narrative used when Mistral is unavailable or fails.
 * Not a stand-in for analysis — it states what happened and says so plainly,
 * which is better than an empty page or invented insight.
 */
export function buildFallbackNarrative(m: ClientDailyMetrics): ClientReportNarrative {
    const previous = m.brief.previous;
    // A window with no business day is a weekend, not a drop in performance.
    const isNonWorkingWindow = m.brief.businessDays === 0;
    const direction: "UP" | "DOWN" | "STABLE" = !previous || isNonWorkingWindow
        ? "STABLE"
        : m.brief.meetings > previous.meetings
          ? "UP"
          : m.brief.meetings < previous.meetings
            ? "DOWN"
            : "STABLE";

    const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

    const summary = isNonWorkingWindow
        ? `Période non ouvrée (${m.brief.rangeLabel}) : aucune prospection n'était planifiée. Depuis le début du mois, ${m.month.meetings} ${plural(m.month.meetings, "rendez-vous a été décroché", "rendez-vous ont été décrochés")} pour un objectif de ${m.month.objective}.`
        : m.isQuiet
        ? `Période calme : ${m.brief.actions} ${plural(m.brief.actions, "action", "actions")} sur ${m.brief.rangeLabel}. Depuis le début du mois, ${m.month.meetings} ${plural(m.month.meetings, "rendez-vous a été décroché", "rendez-vous ont été décrochés")} pour un objectif de ${m.month.objective}.`
        : `Sur ${m.brief.rangeLabel}, l'équipe a mené ${m.brief.actions} ${plural(m.brief.actions, "action", "actions")} et touché ${m.brief.contactsReached} ${plural(m.brief.contactsReached, "contact", "contacts")}, dont ${m.brief.qualified} ${plural(m.brief.qualified, "qualifié", "qualifiés")}. ${m.brief.meetings} ${plural(m.brief.meetings, "rendez-vous a été décroché", "rendez-vous ont été décrochés")} sur la période. Sur le mois, le compteur est à ${m.month.meetings} rendez-vous pour un objectif de ${m.month.objective}, après ${m.month.businessDaysElapsed} ${plural(m.month.businessDaysElapsed, "jour ouvré", "jours ouvrés")} sur ${m.month.businessDaysTotal}.`;

    const highlights = [] as ClientReportNarrative["highlights"];
    if (m.brief.meetings > 0) {
        highlights.push({
            title: `${m.brief.meetings} ${plural(m.brief.meetings, "nouveau rendez-vous", "nouveaux rendez-vous")}`,
            detail: `Décroché${m.brief.meetings > 1 ? "s" : ""} sur ${m.brief.rangeLabel}.`,
            metricRef: "brief.meetings",
        });
    }
    if (m.funnel.reachToMeeting > 0) {
        highlights.push({
            title: `${m.funnel.reachToMeeting}% de transformation`,
            detail: "Part des contacts touchés ce mois-ci qui débouchent sur un rendez-vous.",
            metricRef: "funnel.reachToMeeting",
        });
    }

    const watchouts = [] as ClientReportNarrative["watchouts"];
    if (!isNonWorkingWindow && m.month.businessDaysElapsed >= 3 && m.month.projectedMeetings < m.month.objective) {
        watchouts.push({
            title: "Projection sous l'objectif",
            detail: `Au rythme actuel, le mois se terminerait autour de ${m.month.projectedMeetings} rendez-vous pour un objectif de ${m.month.objective}.`,
            severity: "MEDIUM",
        });
    }

    return {
        headline: isNonWorkingWindow
            ? "Période non ouvrée, reprise au prochain jour travaillé"
            : m.isQuiet
              ? "Période calme sur la prospection"
              : `${m.brief.meetings} ${plural(m.brief.meetings, "rendez-vous", "rendez-vous")} sur ${m.brief.label.toLowerCase()}`,
        executiveSummary: summary,
        momentum: {
            direction,
            comment: isNonWorkingWindow
                ? "Aucun jour ouvré sur la période couverte."
                : previous
                  ? `${m.brief.meetings} rendez-vous sur la période contre ${previous.meetings} sur la période précédente équivalente.`
                  : "Pas encore de période précédente comparable.",
        },
        highlights,
        watchouts,
        rdvSpotlight: [],
        nextSteps: [],
        questionsForYou: [],
        confidence: 0.3,
        dataQuality: m.isQuiet ? 0.3 : 0.6,
        uncertainties: [
            "Synthèse automatique calculée à partir des données brutes, sans analyse rédigée par l'IA.",
        ],
    };
}

/**
 * Build (or reuse) the report for one client and one Paris day.
 * Returns null when the client does not exist.
 */
export async function generateClientDailyReport(
    params: GenerateParams
): Promise<GenerateResult | null> {
    const { clientId, force = false } = params;
    const reportDateKey = toReportDateKey(params.reportDate);
    const reportDateIso = reportDateToIso(reportDateKey);
    const where = { clientId_reportDate: { clientId, reportDate: reportDateKey } };

    const existing = await prisma.clientDailyReport.findUnique({ where });

    if (existing && !force && (existing.status === "completed" || existing.status === "fallback")) {
        return {
            status: existing.status as ClientDailyReportStatus,
            reportDate: reportDateIso,
            metrics: existing.metrics as unknown as ClientDailyMetrics,
            narrative: (existing.narrative as unknown as ClientReportNarrative) ?? null,
            generatedAt: existing.updatedAt.toISOString(),
            modelUsed: existing.modelUsed,
        };
    }

    if (
        existing &&
        !force &&
        existing.status === "pending" &&
        Date.now() - existing.updatedAt.getTime() < PENDING_STALE_MS
    ) {
        return {
            status: "pending",
            reportDate: reportDateIso,
            metrics: existing.metrics as unknown as ClientDailyMetrics,
            narrative: null,
            generatedAt: null,
            modelUsed: null,
            inFlight: true,
        };
    }

    // The brief window runs from the day after the previous report, so a client
    // who has not opened the portal for a week gets a report covering that week
    // rather than a thin "yesterday" slice.
    const previousReport = await prisma.clientDailyReport.findFirst({
        where: { clientId, reportDate: { lt: reportDateKey }, status: { in: ["completed", "fallback"] } },
        orderBy: { reportDate: "desc" },
        select: { reportDate: true, narrative: true },
    });
    const briefStart = previousReport
        ? DateTime.fromISO(reportDateToIso(previousReport.reportDate), { zone: ZONE })
              .plus({ days: 1 })
              .startOf("day")
              .toJSDate()
        : null;

    const metrics = await buildClientDailyMetrics({
        clientId,
        reportDate: reportDateKey,
        briefStart,
    });
    if (!metrics) return null;

    // Claim the slot. A concurrent first visit loses the race and polls instead.
    try {
        if (existing) {
            await prisma.clientDailyReport.update({
                where,
                data: {
                    status: "pending",
                    metrics: metrics as unknown as Prisma.InputJsonValue,
                    periodStart: new Date(metrics.brief.start),
                    periodEnd: new Date(metrics.brief.end),
                    errorMessage: null,
                },
            });
        } else {
            await prisma.clientDailyReport.create({
                data: {
                    clientId,
                    reportDate: reportDateKey,
                    periodStart: new Date(metrics.brief.start),
                    periodEnd: new Date(metrics.brief.end),
                    metrics: metrics as unknown as Prisma.InputJsonValue,
                    status: "pending",
                },
            });
        }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return {
                status: "pending",
                reportDate: reportDateIso,
                metrics,
                narrative: null,
                generatedAt: null,
                modelUsed: null,
                inFlight: true,
            };
        }
        throw error;
    }

    const startedAt = Date.now();
    const priorHeadline =
        (previousReport?.narrative as unknown as ClientReportNarrative | null)?.headline ?? null;

    try {
        const narrative = await requestNarrative(metrics, priorHeadline);
        const record = await prisma.clientDailyReport.update({
            where,
            data: {
                status: "completed",
                narrative: narrative.value as unknown as Prisma.InputJsonValue,
                modelUsed: narrative.model,
                tokensUsed: narrative.tokensUsed,
                durationMs: Date.now() - startedAt,
                errorMessage: null,
            },
        });
        return {
            status: "completed",
            reportDate: reportDateIso,
            metrics,
            narrative: narrative.value,
            generatedAt: record.updatedAt.toISOString(),
            modelUsed: narrative.model,
        };
    } catch (error) {
        // The client still gets a readable report: figures are all there, and
        // the deterministic summary says plainly that the analysis is missing.
        const fallback = buildFallbackNarrative(metrics);
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        console.error(`[client-daily-report] ${clientId} ${reportDateIso}:`, message);
        const record = await prisma.clientDailyReport.update({
            where,
            data: {
                status: "fallback",
                narrative: fallback as unknown as Prisma.InputJsonValue,
                modelUsed: null,
                durationMs: Date.now() - startedAt,
                errorMessage: message.slice(0, 500),
            },
        });
        return {
            status: "fallback",
            reportDate: reportDateIso,
            metrics,
            narrative: fallback,
            generatedAt: record.updatedAt.toISOString(),
            modelUsed: null,
        };
    }
}

async function requestNarrative(
    metrics: ClientDailyMetrics,
    priorHeadline: string | null
): Promise<{ value: ClientReportNarrative; tokensUsed: number | null; model: string }> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY non configurée");

    const model = getReportModel();
    const payload = {
        model,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildNarrativePrompt(metrics, priorHeadline) },
        ],
        temperature: 0.35,
        max_tokens: 2500,
        response_format: { type: "json_object" },
    };

    let response = await mistralFetch(apiKey, payload);

    // 429 / 5xx are transient here: one retry rather than falling straight back
    // to the deterministic summary for a burst limit.
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        response = await mistralFetch(apiKey, payload);
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            `Mistral API error: ${error?.error?.message || response.statusText || response.status}`
        );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse vide de Mistral");

    const parsed = narrativeSchema.safeParse(safeParseJsonFromModel(content));
    if (!parsed.success) {
        throw new Error(
            `Réponse non conforme: ${parsed.error.issues
                .slice(0, 3)
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("; ")}`
        );
    }

    return {
        value: parsed.data,
        tokensUsed: result.usage?.total_tokens ?? null,
        // mistralFetch may downgrade the model when the tier forbids it.
        model: result.model ?? model,
    };
}
