/**
 * Client daily report — shared contracts.
 *
 * Two halves, deliberately separated:
 *  - `ClientDailyMetrics`: every number, computed from SQL in metrics.ts.
 *  - `ClientReportNarrative`: prose only, written by the model on top of the
 *    snapshot. The model never produces a figure; it references one by key.
 */

import { z } from "zod";

// ============================================
// METRICS (deterministic, SQL-derived)
// ============================================

export interface MetricWindow {
    /** Human label, e.g. "Depuis hier" or "Ces 4 derniers jours". */
    label: string;
    /** Precise label of the covered range, e.g. "10 – 13 septembre". */
    rangeLabel: string;
    start: string;
    end: string;
    days: number;
    /** Business days inside the window. 0 means a weekend or a holiday. */
    businessDays: number;
    actions: number;
    calls: number;
    emails: number;
    linkedin: number;
    contactsReached: number;
    qualified: number;
    meetings: number;
}

export interface WindowComparison extends MetricWindow {
    previous: {
        label: string;
        actions: number;
        contactsReached: number;
        qualified: number;
        meetings: number;
    } | null;
}

export interface MonthMetrics extends MetricWindow {
    opportunities: number;
    objective: number;
    objectiveProgressPct: number;
    businessDaysElapsed: number;
    businessDaysTotal: number;
    /** Linear projection of month-end meetings at the current pace. */
    projectedMeetings: number;
    previousMonth: {
        label: string;
        meetings: number;
        contactsReached: number;
    } | null;
}

export interface FunnelMetrics {
    actions: number;
    contactsReached: number;
    qualified: number;
    meetings: number;
    opportunities: number;
    /** Percentages, one decimal. */
    reachToQualified: number;
    qualifiedToMeeting: number;
    reachToMeeting: number;
}

export interface TrendPoint {
    /** Week label, e.g. "08/09". */
    label: string;
    weekStart: string;
    meetings: number;
    actions: number;
}

export interface MonthlyPoint {
    label: string;
    year: number;
    month: number;
    meetings: number;
    objective: number;
}

export interface MeetingWon {
    /** Stable reference the model cites in rdvSpotlight. */
    ref: string;
    company: string;
    contactName: string | null;
    contactTitle: string | null;
    /** When the meeting was booked. */
    bookedAt: string;
    /** Scheduled date of the meeting, when known. */
    scheduledAt: string | null;
    type: string | null;
    category: string | null;
    /** Short excerpt of the SDR note / call summary — context for the model. */
    context: string | null;
}

export interface UpcomingMeeting {
    ref: string;
    company: string;
    contactName: string | null;
    scheduledAt: string;
    type: string | null;
}

export interface ResultBreakdownEntry {
    result: string;
    label: string;
    count: number;
    share: number;
}

export interface MissionSummary {
    id: string;
    name: string;
    isActive: boolean;
    objective: string | null;
    startDate: string;
    endDate: string;
    sdrCount: number;
    channels: string[];
}

export interface SessionsSummary {
    total: number;
    lastDate: string | null;
    lastType: string | null;
    openTasks: number;
    openTaskLabels: string[];
}

export interface ClientDailyMetrics {
    version: 1;
    client: { name: string; logo: string | null };
    /** Report day, Europe/Paris, yyyy-MM-dd. */
    reportDate: string;
    reportDateLabel: string;
    generatedAt: string;
    /** Since the previous report (or yesterday on a first run). */
    brief: WindowComparison;
    week: MetricWindow;
    month: MonthMetrics;
    funnel: FunnelMetrics;
    /** Last 90 days, aggregated by week. */
    trend: TrendPoint[];
    /** Monthly meetings since the first mission started. */
    monthlySeries: MonthlyPoint[];
    meetingsWon: MeetingWon[];
    /**
     * Which window meetingsWon covers: the brief window, or — when that one
     * holds none — the last 30 days, so a quiet Monday still shows the work.
     */
    meetingsWonScope: "brief" | "recent";
    meetingsUpcoming: UpcomingMeeting[];
    resultBreakdown: ResultBreakdownEntry[];
    channelMix: Array<{ channel: string; count: number }>;
    missions: MissionSummary[];
    sessions: SessionsSummary;
    totals: { meetingsAllTime: number; activeMissions: number };
    /** True when the brief window holds too little activity to analyse. */
    isQuiet: boolean;
}

// ============================================
// NARRATIVE (model output)
//
// Every enum uses .catch() and every field a .default() so an unexpected value
// degrades to something renderable instead of throwing at render time —
// same guardrail as app/api/analyse-ia/run/route.ts.
// ============================================

export const momentumDirectionEnum = z.enum(["UP", "DOWN", "STABLE"]);
export const severityEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const ownerEnum = z.enum(["AGENCE", "CLIENT"]);

export const narrativeSchema = z.object({
    headline: z.string().default(""),
    executiveSummary: z.string().default(""),
    momentum: z
        .object({
            direction: momentumDirectionEnum.catch("STABLE"),
            comment: z.string().default(""),
        })
        .default({ direction: "STABLE", comment: "" }),
    highlights: z
        .array(
            z.object({
                title: z.string().default(""),
                detail: z.string().default(""),
                metricRef: z.string().default(""),
            })
        )
        .default([]),
    watchouts: z
        .array(
            z.object({
                title: z.string().default(""),
                detail: z.string().default(""),
                severity: severityEnum.catch("MEDIUM"),
            })
        )
        .default([]),
    rdvSpotlight: z
        .array(
            z.object({
                ref: z.string().default(""),
                note: z.string().default(""),
            })
        )
        .default([]),
    nextSteps: z
        .array(
            z.object({
                action: z.string().default(""),
                owner: ownerEnum.catch("AGENCE"),
                horizon: z.string().default(""),
            })
        )
        .default([]),
    questionsForYou: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).catch(0.5),
    dataQuality: z.number().min(0).max(1).catch(0.5),
    uncertainties: z.array(z.string()).default([]),
});

export type ClientReportNarrative = z.infer<typeof narrativeSchema>;

export type ClientDailyReportStatus = "pending" | "completed" | "fallback" | "failed";

/** Payload returned by GET /api/client/reporting/daily. */
export interface ClientDailyReportPayload {
    reportDate: string;
    status: ClientDailyReportStatus | "absent";
    metrics: ClientDailyMetrics;
    narrative: ClientReportNarrative | null;
    generatedAt: string | null;
    modelUsed: string | null;
    /** True when this is an archived day rather than today's report. */
    isArchive: boolean;
}
