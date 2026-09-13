/**
 * Client daily report — deterministic metrics engine.
 *
 * Server-only. Every figure the client reads comes from here, never from the
 * model: generate.ts hands this snapshot to Mistral and only asks for prose on
 * top of it. Scope is always a single client (missions -> campaigns -> actions).
 */

import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { DISPLAY_TZ } from "@/lib/date";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import type {
    ClientDailyMetrics,
    FunnelMetrics,
    MeetingWon,
    MetricWindow,
    MonthlyPoint,
    ResultBreakdownEntry,
    TrendPoint,
    UpcomingMeeting,
    WindowComparison,
} from "./types";

const ZONE = DISPLAY_TZ;

/** Results that count as a qualified contact — same set as get-report-data.ts. */
const QUALIFIED_RESULTS = new Set(["INTERESTED", "CALLBACK_REQUESTED", "MEETING_BOOKED"]);

const TREND_DAYS = 90;
const MAX_MEETINGS_DETAILED = 12;
const MAX_UPCOMING = 8;
const MAX_RESULT_ROWS = 8;
/** Below this many actions the brief window is not worth analysing. */
const QUIET_THRESHOLD = 5;

type LeanAction = {
    contactId: string | null;
    companyId: string | null;
    result: string;
    channel: string;
    createdAt: Date;
};

/**
 * Mission.objective is free text ("15 RDV / mois", "20", ...). Extract the
 * first integer, mirroring the parsing the monthly summary already does.
 */
export function parseMissionObjective(objective: string | null | undefined): number {
    if (!objective) return 0;
    const match = objective.match(/\d+/);
    if (!match) return 0;
    const parsed = parseInt(match[0], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function businessDaysBetween(start: DateTime, end: DateTime): number {
    if (end < start) return 0;
    let count = 0;
    let cursor = start.startOf("day");
    const last = end.startOf("day");
    while (cursor <= last) {
        if (cursor.weekday <= 5) count++;
        cursor = cursor.plus({ days: 1 });
    }
    return count;
}

function rate(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
}

function contactKey(action: LeanAction): string | null {
    if (action.contactId) return action.contactId;
    if (action.companyId) return `company:${action.companyId}`;
    return null;
}

function aggregate(actions: LeanAction[], start: DateTime, end: DateTime) {
    const startMs = start.toMillis();
    const endMs = end.toMillis();
    const reached = new Set<string>();
    const qualified = new Set<string>();
    let total = 0;
    let calls = 0;
    let emails = 0;
    let linkedin = 0;
    let meetings = 0;

    for (const action of actions) {
        const ms = action.createdAt.getTime();
        if (ms < startMs || ms > endMs) continue;
        total++;
        if (action.channel === "CALL") calls++;
        else if (action.channel === "EMAIL") emails++;
        else if (action.channel === "LINKEDIN") linkedin++;
        if (action.result === "MEETING_BOOKED") meetings++;
        const key = contactKey(action);
        if (key) {
            reached.add(key);
            if (QUALIFIED_RESULTS.has(action.result)) qualified.add(key);
        }
    }

    return {
        actions: total,
        calls,
        emails,
        linkedin,
        contactsReached: reached.size,
        qualified: qualified.size,
        meetings,
    };
}

function formatRange(start: DateTime, end: DateTime): string {
    const sameMonth = start.hasSame(end, "month") && start.hasSame(end, "year");
    if (start.hasSame(end, "day")) return start.setLocale("fr").toFormat("d MMMM yyyy");
    if (sameMonth) {
        return `${start.setLocale("fr").toFormat("d")} – ${end.setLocale("fr").toFormat("d MMMM yyyy")}`;
    }
    return `${start.setLocale("fr").toFormat("d MMM")} – ${end.setLocale("fr").toFormat("d MMM yyyy")}`;
}

function briefLabel(start: DateTime, end: DateTime, today: DateTime): string {
    const days = Math.max(1, Math.round(end.startOf("day").diff(start.startOf("day"), "days").days) + 1);
    if (start.hasSame(today, "day")) return "Aujourd'hui";
    if (start.hasSame(today.minus({ days: 1 }), "day")) return "Depuis hier";
    if (days <= 7) return `Ces ${days} derniers jours`;
    return `Depuis le ${start.setLocale("fr").toFormat("d MMMM")}`;
}

function emptyWindow(label: string, start: DateTime, end: DateTime): MetricWindow {
    return {
        label,
        rangeLabel: formatRange(start, end),
        start: start.toISO() ?? "",
        end: end.toISO() ?? "",
        days: Math.max(1, Math.round(end.diff(start, "days").days)),
        businessDays: businessDaysBetween(start, end),
        actions: 0,
        calls: 0,
        emails: 0,
        linkedin: 0,
        contactsReached: 0,
        qualified: 0,
        meetings: 0,
    };
}

export interface BuildMetricsParams {
    clientId: string;
    /** Paris day the report is dated. Defaults to today. */
    reportDate?: Date | string;
    /**
     * Start of the "since your last report" window. Defaults to the start of
     * the day before reportDate.
     */
    briefStart?: Date | null;
}

/**
 * Build the full metrics snapshot for one client.
 * Returns null only when the client does not exist.
 */
export async function buildClientDailyMetrics(
    params: BuildMetricsParams
): Promise<ClientDailyMetrics | null> {
    const { clientId } = params;

    const today = params.reportDate
        ? DateTime.fromJSDate(new Date(params.reportDate), { zone: ZONE }).startOf("day")
        : DateTime.now().setZone(ZONE).startOf("day");
    const dayEnd = today.endOf("day");
    const now = DateTime.now().setZone(ZONE);
    /** Never aggregate past the current instant on the report day itself. */
    const windowEnd = now < dayEnd ? now : dayEnd;

    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, logo: true },
    });
    if (!client) return null;

    const missions = await prisma.mission.findMany({
        where: { clientId },
        select: {
            id: true,
            name: true,
            isActive: true,
            objective: true,
            startDate: true,
            endDate: true,
            channels: true,
            _count: { select: { sdrAssignments: true } },
        },
        orderBy: { startDate: "asc" },
    });

    const monthStart = today.startOf("month");
    const monthEnd = today.endOf("month");
    const weekStart = today.startOf("week");
    const briefStart = params.briefStart
        ? DateTime.fromJSDate(new Date(params.briefStart), { zone: ZONE }).startOf("day")
        : today.minus({ days: 1 }).startOf("day");
    const trendStart = today.minus({ days: TREND_DAYS }).startOf("day");

    const missionSummaries = missions.map((mission) => ({
        id: mission.id,
        name: mission.name,
        isActive: mission.isActive,
        objective: mission.objective,
        startDate: DateTime.fromJSDate(mission.startDate).setZone(ZONE).setLocale("fr").toFormat("d MMM yyyy"),
        endDate: DateTime.fromJSDate(mission.endDate).setZone(ZONE).setLocale("fr").toFormat("d MMM yyyy"),
        sdrCount: mission._count.sdrAssignments,
        channels: mission.channels as string[],
    }));

    const activeMissions = missions.filter((m) => m.isActive);
    const objective =
        activeMissions.reduce((sum, m) => sum + parseMissionObjective(m.objective), 0) ||
        parseMissionObjective(missions[0]?.objective) ||
        10;

    const base: ClientDailyMetrics = {
        version: 1,
        client: { name: client.name, logo: client.logo },
        reportDate: today.toISODate() ?? "",
        reportDateLabel: today.setLocale("fr").toFormat("cccc d MMMM yyyy"),
        generatedAt: now.toISO() ?? "",
        brief: {
            ...emptyWindow(briefLabel(briefStart, windowEnd, today), briefStart, windowEnd),
            previous: null,
        },
        week: emptyWindow("Cette semaine", weekStart, windowEnd),
        month: {
            ...emptyWindow(monthStart.setLocale("fr").toFormat("LLLL yyyy"), monthStart, windowEnd),
            opportunities: 0,
            objective,
            objectiveProgressPct: 0,
            businessDaysElapsed: businessDaysBetween(monthStart, windowEnd),
            businessDaysTotal: businessDaysBetween(monthStart, monthEnd),
            projectedMeetings: 0,
            previousMonth: null,
        },
        funnel: {
            actions: 0,
            contactsReached: 0,
            qualified: 0,
            meetings: 0,
            opportunities: 0,
            reachToQualified: 0,
            qualifiedToMeeting: 0,
            reachToMeeting: 0,
        },
        trend: [],
        monthlySeries: [],
        meetingsWon: [],
        meetingsWonScope: "brief",
        meetingsUpcoming: [],
        resultBreakdown: [],
        channelMix: [],
        missions: missionSummaries,
        sessions: { total: 0, lastDate: null, lastType: null, openTasks: 0, openTaskLabels: [] },
        totals: { meetingsAllTime: 0, activeMissions: activeMissions.length },
        isQuiet: true,
    };

    if (missions.length === 0) return base;

    const missionIds = missions.map((m) => m.id);
    const campaigns = await prisma.campaign.findMany({
        where: { missionId: { in: missionIds } },
        select: { id: true },
    });
    const campaignIds = campaigns.map((c) => c.id);

    const sessionsSummary = await buildSessionsSummary(clientId);
    base.sessions = sessionsSummary;

    if (campaignIds.length === 0) return base;

    // The previous brief window (same length, immediately before) and the
    // previous month both need history, so fetch from the earliest of them.
    const previousBriefStart = briefStart.minus({
        milliseconds: windowEnd.toMillis() - briefStart.toMillis(),
    });
    const previousMonthStart = monthStart.minus({ months: 1 });
    const fetchStart = DateTime.min(trendStart, previousBriefStart, previousMonthStart, briefStart);

    const [leanActions, meetingActions, upcomingActions, allMeetings, monthOpportunities] =
        await Promise.all([
            prisma.action.findMany({
                where: {
                    campaignId: { in: campaignIds },
                    createdAt: { gte: fetchStart.toJSDate(), lte: windowEnd.toJSDate() },
                },
                select: {
                    contactId: true,
                    companyId: true,
                    result: true,
                    channel: true,
                    createdAt: true,
                },
            }),
            prisma.action.findMany({
                where: {
                    campaignId: { in: campaignIds },
                    result: "MEETING_BOOKED",
                    createdAt: { gte: briefStart.toJSDate(), lte: windowEnd.toJSDate() },
                },
                select: {
                    id: true,
                    createdAt: true,
                    callbackDate: true,
                    meetingType: true,
                    meetingCategory: true,
                    note: true,
                    callSummary: true,
                    company: { select: { name: true } },
                    contact: {
                        select: { firstName: true, lastName: true, title: true, company: { select: { name: true } } },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: MAX_MEETINGS_DETAILED,
            }),
            prisma.action.findMany({
                where: {
                    campaignId: { in: campaignIds },
                    result: "MEETING_BOOKED",
                    callbackDate: {
                        gte: now.toJSDate(),
                        lte: now.plus({ days: 7 }).toJSDate(),
                    },
                },
                select: {
                    id: true,
                    callbackDate: true,
                    meetingType: true,
                    company: { select: { name: true } },
                    contact: {
                        select: { firstName: true, lastName: true, company: { select: { name: true } } },
                    },
                },
                orderBy: { callbackDate: "asc" },
                take: MAX_UPCOMING,
            }),
            prisma.action.findMany({
                where: { campaignId: { in: campaignIds }, result: "MEETING_BOOKED" },
                select: { createdAt: true },
            }),
            prisma.opportunity.count({
                where: {
                    contact: { company: { list: { missionId: { in: missionIds } } } },
                    createdAt: { gte: monthStart.toJSDate(), lte: windowEnd.toJSDate() },
                },
            }),
        ]);

    // A brief window with no meetings (a weekend, a quiet Monday) would leave
    // the timeline empty, which reads as "nothing happened". Fall back to the
    // last 30 days so the work stays visible, and say which window it covers.
    const meetingsWonScope: "brief" | "recent" = meetingActions.length > 0 ? "brief" : "recent";
    const recentMeetingActions =
        meetingActions.length > 0
            ? meetingActions
            : await prisma.action.findMany({
                  where: {
                      campaignId: { in: campaignIds },
                      result: "MEETING_BOOKED",
                      createdAt: {
                          gte: windowEnd.minus({ days: 30 }).toJSDate(),
                          lte: windowEnd.toJSDate(),
                      },
                  },
                  select: {
                      id: true,
                      createdAt: true,
                      callbackDate: true,
                      meetingType: true,
                      meetingCategory: true,
                      note: true,
                      callSummary: true,
                      company: { select: { name: true } },
                      contact: {
                          select: {
                              firstName: true,
                              lastName: true,
                              title: true,
                              company: { select: { name: true } },
                          },
                      },
                  },
                  orderBy: { createdAt: "desc" },
                  take: MAX_MEETINGS_DETAILED,
              });

    const actions = leanActions as LeanAction[];

    // ---- Windows ----
    const briefAgg = aggregate(actions, briefStart, windowEnd);
    const previousBriefAgg = aggregate(actions, previousBriefStart, briefStart.minus({ milliseconds: 1 }));
    const weekAgg = aggregate(actions, weekStart, windowEnd);
    const monthAgg = aggregate(actions, monthStart, windowEnd);
    const previousMonthAgg = aggregate(actions, previousMonthStart, monthStart.minus({ milliseconds: 1 }));

    const brief: WindowComparison = {
        ...base.brief,
        ...briefAgg,
        previous: {
            label: "Période précédente équivalente",
            actions: previousBriefAgg.actions,
            contactsReached: previousBriefAgg.contactsReached,
            qualified: previousBriefAgg.qualified,
            meetings: previousBriefAgg.meetings,
        },
    };

    const businessDaysElapsed = base.month.businessDaysElapsed;
    const businessDaysTotal = base.month.businessDaysTotal;
    const projectedMeetings =
        businessDaysElapsed > 0
            ? Math.round((monthAgg.meetings / businessDaysElapsed) * businessDaysTotal)
            : monthAgg.meetings;

    // ---- Funnel (month to date) ----
    const funnel: FunnelMetrics = {
        actions: monthAgg.actions,
        contactsReached: monthAgg.contactsReached,
        qualified: monthAgg.qualified,
        meetings: monthAgg.meetings,
        opportunities: monthOpportunities,
        reachToQualified: rate(monthAgg.qualified, monthAgg.contactsReached),
        qualifiedToMeeting: rate(monthAgg.meetings, monthAgg.qualified),
        reachToMeeting: rate(monthAgg.meetings, monthAgg.contactsReached),
    };

    // ---- 90-day trend, by week ----
    const weekBuckets = new Map<string, TrendPoint>();
    for (let cursor = trendStart.startOf("week"); cursor <= windowEnd; cursor = cursor.plus({ weeks: 1 })) {
        weekBuckets.set(cursor.toISODate() ?? "", {
            label: cursor.setLocale("fr").toFormat("dd/MM"),
            weekStart: cursor.toISO() ?? "",
            meetings: 0,
            actions: 0,
        });
    }
    for (const action of actions) {
        const at = DateTime.fromJSDate(action.createdAt).setZone(ZONE);
        if (at < trendStart) continue;
        const key = at.startOf("week").toISODate() ?? "";
        const bucket = weekBuckets.get(key);
        if (!bucket) continue;
        bucket.actions++;
        if (action.result === "MEETING_BOOKED") bucket.meetings++;
    }

    // ---- Monthly series since the first mission started ----
    const monthlyMap = new Map<string, MonthlyPoint>();
    for (const meeting of allMeetings) {
        const at = DateTime.fromJSDate(meeting.createdAt).setZone(ZONE);
        const key = at.toFormat("yyyy-MM");
        const existing = monthlyMap.get(key);
        if (existing) {
            existing.meetings++;
        } else {
            monthlyMap.set(key, {
                label: at.setLocale("fr").toFormat("LLL yyyy"),
                year: at.year,
                month: at.month,
                meetings: 1,
                objective,
            });
        }
    }

    // ---- Result & channel breakdown (month to date) ----
    const resultCounts = new Map<string, number>();
    const channelCounts = new Map<string, number>();
    for (const action of actions) {
        const at = DateTime.fromJSDate(action.createdAt).setZone(ZONE);
        if (at < monthStart || at > windowEnd) continue;
        resultCounts.set(action.result, (resultCounts.get(action.result) ?? 0) + 1);
        channelCounts.set(action.channel, (channelCounts.get(action.channel) ?? 0) + 1);
    }
    const resultBreakdown: ResultBreakdownEntry[] = Array.from(resultCounts.entries())
        .map(([result, count]) => ({
            result,
            label: ACTION_RESULT_LABELS[result] ?? result,
            count,
            share: rate(count, monthAgg.actions),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_RESULT_ROWS);

    // ---- Meetings won over the brief window ----
    const meetingsWon: MeetingWon[] = recentMeetingActions.map((action, index) => {
        const contactName = action.contact
            ? [action.contact.firstName, action.contact.lastName].filter(Boolean).join(" ").trim() || null
            : null;
        const rawContext = action.callSummary?.trim() || action.note?.trim() || null;
        return {
            ref: `RDV-${index + 1}`,
            company:
                action.company?.name ?? action.contact?.company?.name ?? "Entreprise non renseignée",
            contactName,
            contactTitle: action.contact?.title ?? null,
            bookedAt: action.createdAt.toISOString(),
            scheduledAt: action.callbackDate ? action.callbackDate.toISOString() : null,
            type: action.meetingType,
            category: action.meetingCategory,
            context: rawContext ? rawContext.slice(0, 400) : null,
        };
    });

    const meetingsUpcoming: UpcomingMeeting[] = upcomingActions
        .filter((action) => action.callbackDate)
        .map((action, index) => ({
            ref: `NEXT-${index + 1}`,
            company: action.company?.name ?? action.contact?.company?.name ?? "Entreprise non renseignée",
            contactName: action.contact
                ? [action.contact.firstName, action.contact.lastName].filter(Boolean).join(" ").trim() || null
                : null,
            scheduledAt: action.callbackDate!.toISOString(),
            type: action.meetingType,
        }));

    return {
        ...base,
        brief,
        week: { ...base.week, ...weekAgg },
        month: {
            ...base.month,
            ...monthAgg,
            opportunities: monthOpportunities,
            objectiveProgressPct: objective > 0 ? Math.round((monthAgg.meetings / objective) * 100) : 0,
            projectedMeetings,
            previousMonth: {
                label: previousMonthStart.setLocale("fr").toFormat("LLLL yyyy"),
                meetings: previousMonthAgg.meetings,
                contactsReached: previousMonthAgg.contactsReached,
            },
        },
        funnel,
        trend: Array.from(weekBuckets.values()),
        monthlySeries: Array.from(monthlyMap.values()).sort(
            (a, b) => a.year - b.year || a.month - b.month
        ),
        meetingsWon,
        meetingsWonScope,
        meetingsUpcoming,
        resultBreakdown,
        channelMix: Array.from(channelCounts.entries()).map(([channel, count]) => ({ channel, count })),
        totals: { meetingsAllTime: allMeetings.length, activeMissions: activeMissions.length },
        isQuiet: briefAgg.actions < QUIET_THRESHOLD,
    };
}

async function buildSessionsSummary(clientId: string) {
    const [sessions, total, openTaskCount, openTaskSample] = await Promise.all([
        prisma.clientSession.findMany({
            where: { clientId },
            select: { type: true, date: true },
            orderBy: { date: "desc" },
            take: 1,
        }),
        prisma.clientSession.count({ where: { clientId } }),
        prisma.sessionTask.count({ where: { session: { clientId }, doneAt: null } }),
        prisma.sessionTask.findMany({
            where: { session: { clientId }, doneAt: null },
            select: { label: true },
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
    ]);
    const last = sessions[0];
    return {
        total,
        lastDate: last ? last.date.toISOString() : null,
        lastType: last ? last.type : null,
        openTasks: openTaskCount,
        openTaskLabels: openTaskSample.map((t) => t.label),
    };
}
