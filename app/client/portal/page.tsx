"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui";
import {
    RefreshCw,
    ArrowRight,
    Calendar,
    Sparkles,
    PhoneCall,
    TrendingUp,
    CalendarCheck,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { DashboardSkeleton } from "@/components/client/skeletons";
import { BreakdownCharts } from "@/components/client/BreakdownCharts";
import {
    calculateCampaignHealth,
    calculateFunnelSummary,
    calculateProspectFeedbackInsight,
} from "@/lib/client/insight-engine";
import type { ClientDailyMetrics } from "@/lib/reporting/client-daily/types";

interface DashboardStats {
    totalActions: number;
    meetingsBooked: number;
    monthlyObjective: number;
    activeMissions: number;
    uniqueContacts?: number;
    contactsReached?: number;
    conversionRate?: number;
    resultBreakdown?: Record<string, number>;
}

interface ClientMeeting {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    note?: string | null;
    result?: string;
    contact: {
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        company: { name: string };
    } | null;
    company?: { name: string } | null;
    campaign: {
        name: string;
        mission: { name: string };
    };
    interlocuteur?: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
    } | null;
}

interface Mission {
    id: string;
    name: string;
    isActive: boolean;
}

interface PortalSettings {
    portalShowCallHistory: boolean;
    portalShowDatabase: boolean;
}

const MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const ACTION_LABELS_FALLBACK: Record<string, string> = {
    NO_RESPONSE: "Pas de réponse",
    CALLBACK_REQUESTED: "Rappel demandé",
    INTERESTED: "Intéressé",
    MEETING_BOOKED: "Rendez-vous fixé",
    DISQUALIFIED: "Refus / Non intéressé",
    BAD_CONTACT: "Standard / Mauvais numéro",
};

function getGreeting(): string {
    const h = new Date().getHours();
    if (h >= 18) return "Bonsoir";
    if (h >= 12) return "Bon après-midi";
    return "Bonjour";
}

function formatMeetingDate(dateString: string): string {
    const d = new Date(dateString);
    return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

function formatMeetingTime(dateString: string): string {
    const d = new Date(dateString);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatShortMonth(dateString: string): string {
    const d = new Date(dateString);
    return d.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase().replace(".", "");
}

export default function ClientPortal() {
    const { data: session } = useSession();
    const toast = useToast();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [dailyMetrics, setDailyMetrics] = useState<ClientDailyMetrics | null>(null);
    const [upcomingMeetings, setUpcomingMeetings] = useState<ClientMeeting[]>([]);
    const [missionName, setMissionName] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);
    const [totalMeetingsCount, setTotalMeetingsCount] = useState<number>(0);

    const clientId = (session?.user as { clientId?: string })?.clientId;
    const userName = session?.user?.name?.split(" ")[0] ?? "Client";

    const now = new Date();
    const currentMonth = MONTH_NAMES[now.getMonth()];
    const currentYear = now.getFullYear();

    const fetchData = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        try {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            const startDate = monthStart.toISOString().split("T")[0];
            const endDate = monthEnd.toISOString().split("T")[0];

            const [statsRes, missionsRes, meetingsRes, settingsRes, dailyReportRes] = await Promise.all([
                fetch(`/api/stats?startDate=${startDate}&endDate=${endDate}`),
                fetch("/api/missions?isActive=true"),
                clientId ? fetch(`/api/clients/${clientId}/meetings`) : Promise.resolve(null),
                fetch("/api/client/portal/settings"),
                fetch("/api/client/reporting/daily"),
            ]);

            const [statsJson, missionsJson, meetingsJson, settingsJson, dailyJson] = await Promise.all([
                statsRes.json(),
                missionsRes.json(),
                meetingsRes?.ok ? meetingsRes.json() : Promise.resolve(null),
                settingsRes.json(),
                dailyReportRes.ok ? dailyReportRes.json() : Promise.resolve({ success: false }),
            ]);

            if (statsJson.success) setStats(statsJson.data);
            if (dailyJson?.success && dailyJson.data?.metrics) {
                setDailyMetrics(dailyJson.data.metrics as ClientDailyMetrics);
            }
            if (missionsJson.success) {
                const missions = Array.isArray(missionsJson.data) ? (missionsJson.data as Mission[]) : [];
                setMissionName(missions[0]?.name ?? "");
            }
            if (meetingsJson?.success) {
                const allMeetings: ClientMeeting[] = meetingsJson.data?.allMeetings ?? [];
                const upcoming = allMeetings
                    .filter((m) => {
                        if (!m.callbackDate) return true;
                        return new Date(m.callbackDate) >= new Date();
                    })
                    .sort((a, b) => {
                        const da = a.callbackDate ? new Date(a.callbackDate).getTime() : 0;
                        const db = b.callbackDate ? new Date(b.callbackDate).getTime() : 0;
                        return da - db;
                    })
                    .slice(0, 5);
                setUpcomingMeetings(upcoming);
                const nonCancelledCount = allMeetings.filter(
                    (m) => m.result !== "MEETING_CANCELLED"
                ).length;
                setTotalMeetingsCount(nonCancelledCount);
            }
            if (settingsJson?.success) {
                setPortalSettings(settingsJson.data);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Erreur de chargement", "Impossible de charger les données");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading && !stats && !dailyMetrics) {
        return <DashboardSkeleton />;
    }

    // Consolidated deterministic figures
    const meetingsBooked =
        totalMeetingsCount || dailyMetrics?.month.meetings || stats?.meetingsBooked || 0;
    const monthlyObjective =
        dailyMetrics?.month.objective || stats?.monthlyObjective || 10;
    const businessDaysElapsed =
        dailyMetrics?.month.businessDaysElapsed ?? Math.min(now.getDate(), 22);
    const businessDaysTotal =
        dailyMetrics?.month.businessDaysTotal ?? 22;

    const projectedMeetings =
        dailyMetrics?.month.projectedMeetings !== undefined
            ? dailyMetrics.month.projectedMeetings
            : businessDaysElapsed > 0
            ? Math.round((meetingsBooked / businessDaysElapsed) * businessDaysTotal)
            : meetingsBooked;

    // 1. Campaign Health Engine
    const campaignHealth = calculateCampaignHealth({
        meetingsWon: meetingsBooked,
        monthlyObjective,
        businessDaysElapsed,
        businessDaysTotal,
        projectedMeetings,
    });

    // 2. Mini-Funnel Performance
    const contactedCount =
        dailyMetrics?.funnel.contactsReached ||
        dailyMetrics?.month.contactsReached ||
        stats?.uniqueContacts ||
        stats?.contactsReached ||
        stats?.totalActions ||
        0;

    const qualifiedCount =
        dailyMetrics?.funnel.qualified ||
        dailyMetrics?.month.qualified ||
        (stats?.resultBreakdown?.INTERESTED || 0) +
            (stats?.resultBreakdown?.CALLBACK_REQUESTED || 0) +
            meetingsBooked;

    const totalActions =
        dailyMetrics?.funnel.actions ||
        dailyMetrics?.month.actions ||
        stats?.totalActions ||
        contactedCount;

    const funnelSummary = calculateFunnelSummary({
        contacted: contactedCount,
        qualified: qualifiedCount,
        meetings: meetingsBooked,
        totalActions,
    });

    // 3. Prospect Feedback Insight Engine
    const rawBreakdown =
        dailyMetrics?.resultBreakdown && dailyMetrics.resultBreakdown.length > 0
            ? dailyMetrics.resultBreakdown
            : stats?.resultBreakdown
            ? Object.entries(stats.resultBreakdown).map(([result, count]) => ({
                  result,
                  label: ACTION_LABELS_FALLBACK[result] || result,
                  count,
                  share: Math.round((count / Math.max(totalActions, 1)) * 1000) / 10,
              }))
            : [];

    const prospectFeedbackInsight = calculateProspectFeedbackInsight({
        resultBreakdown: rawBreakdown,
        totalActions,
    });

    const objectivePct = Math.min(
        100,
        Math.round((meetingsBooked / Math.max(1, monthlyObjective)) * 100)
    );

    return (
        <div className="min-h-full bg-[#ECE5D8] p-4 md:p-6 space-y-6">
            {/* ── Greeting bar ── */}
            <div
                className="flex flex-wrap items-center justify-between gap-4"
                style={{ animation: "dashFadeUp 0.4s ease both" }}
            >
                <div>
                    <h1 className="text-2xl md:text-[28px] font-bold text-[var(--elan-ink)] tracking-tight leading-tight">
                        {getGreeting()},{" "}
                        <span className="gradient-text">{userName}</span>
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <p className="text-sm text-[var(--elan-slate)]">
                            Votre campagne · {currentMonth} {currentYear}
                        </p>
                        {missionName && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2890F8] bg-[#e6f0fa] border border-[#2890F8]/20 px-2 py-[2px] rounded-full">
                                <TrendingUp className="w-3 h-3" />
                                {missionName}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => fetchData(true)}
                    disabled={isRefreshing}
                    className="w-10 h-10 rounded-xl border border-[var(--elan-line)] flex items-center justify-center text-[var(--elan-slate)] hover:text-[#2890F8] hover:border-[#2890F8]/30 transition-all duration-200 disabled:opacity-50 bg-[var(--elan-surface)]/80 backdrop-blur-sm hover:shadow-md hover:shadow-[rgba(40,144,248,0.18)]"
                    title="Rafraîchir"
                    aria-label="Actualiser les données"
                >
                    <RefreshCw
                        className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            isRefreshing && "animate-spin"
                        )}
                    />
                </button>
            </div>

            {/* ── 1. CAMPAIGN HEALTH & HERO COCKPIT ── */}
            <div
                className="relative overflow-hidden rounded-2xl shadow-xl bg-[#080808] p-6 md:p-8 border border-white/[0.08]"
                style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "60ms" }}
            >
                {/* Decorative gradients */}
                <div className="pointer-events-none absolute top-0 right-0 w-80 h-80 rounded-full bg-[#2890F8]/10 -translate-y-1/2 translate-x-1/3 blur-2xl" />
                <div className="pointer-events-none absolute bottom-0 left-0 w-60 h-60 rounded-full bg-emerald-500/10 translate-y-1/2 -translate-x-1/4 blur-2xl" />

                {/* Health Indicator Badge */}
                <div className="relative flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div
                        className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border",
                            campaignHealth.tone === "emerald" &&
                                "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
                            campaignHealth.tone === "amber" &&
                                "bg-amber-500/15 border-amber-500/30 text-amber-400",
                            campaignHealth.tone === "blue" &&
                                "bg-[#2890F8]/15 border-[#2890F8]/30 text-[#2890F8]"
                        )}
                    >
                        <span
                            className={cn(
                                "w-2 h-2 rounded-full",
                                campaignHealth.tone === "emerald" && "bg-emerald-400 animate-pulse",
                                campaignHealth.tone === "amber" && "bg-amber-400 animate-pulse",
                                campaignHealth.tone === "blue" && "bg-[#2890F8]"
                            )}
                        />
                        <span>{campaignHealth.badgeLabel}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                        {campaignHealth.paceComment}
                    </p>
                </div>

                {/* Hero Figure: 2 RDV OBTENUS */}
                <div className="relative mb-6">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
                        Résultats de votre campagne · {currentMonth} {currentYear}
                    </p>
                    <div className="flex items-baseline gap-3">
                        <AnimatedNumber
                            value={meetingsBooked}
                            className="text-[64px] md:text-[76px] font-black text-white leading-none tracking-tight drop-shadow-sm"
                        />
                        <span className="text-2xl md:text-3xl font-extrabold text-slate-300">
                            {meetingsBooked > 1 ? "RDV OBTENUS" : "RDV OBTENU"}
                        </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-2.5 font-medium max-w-2xl leading-relaxed">
                        {campaignHealth.summary}
                    </p>
                </div>

                {/* Target Gauge & Projection */}
                <div className="relative pt-4 border-t border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">
                            Objectif mensuel :{" "}
                            <strong className="text-white font-bold">
                                {meetingsBooked} / {monthlyObjective} RDV
                            </strong>
                        </span>
                        <span className="text-emerald-400 font-bold">
                            {objectivePct}% atteint
                        </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#2890F8] to-emerald-400 transition-all duration-700"
                            style={{ width: `${Math.max(4, objectivePct)}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-[11.5px] text-slate-400 pt-0.5">
                        <span>
                            Projection fin de mois :{" "}
                            <strong className="text-white font-semibold">
                                {campaignHealth.projectedMeetings} RDV
                            </strong>
                        </span>
                        <span>
                            {campaignHealth.projectedPct}% de l&apos;objectif projeté
                        </span>
                    </div>
                </div>
            </div>

            {/* ── 2. PROCHAINS RENDEZ-VOUS ── */}
            <div
                className="premium-card overflow-hidden"
                style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "100ms" }}
            >
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--elan-line)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#2890F8] flex items-center justify-center shadow-sm">
                            <CalendarCheck className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-[var(--elan-ink)] uppercase tracking-wider">
                                Prochains rendez-vous
                            </h2>
                            <p className="text-xs text-[var(--elan-slate)] mt-0.5">
                                {upcomingMeetings.length} rendez-vous planifié
                                {upcomingMeetings.length > 1 ? "s" : ""}
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/client/portal/meetings"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2890F8] hover:text-[#1a75ce] transition-colors duration-200 group"
                    >
                        Voir tout{" "}
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                    </Link>
                </div>

                {upcomingMeetings.length === 0 ? (
                    <div className="text-center py-12 px-6">
                        <div className="w-14 h-14 rounded-2xl bg-[#e6f0fa] flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-6 h-6 text-[#2890F8]" />
                        </div>
                        <p className="text-sm font-medium text-[var(--elan-slate)]">
                            Aucun RDV à venir
                        </p>
                        <p className="text-xs text-[#899892] mt-1 max-w-xs mx-auto">
                            Les prochains RDV planifiés par votre équipe apparaîtront ici.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--elan-line)]">
                        {upcomingMeetings.map((m, idx) => {
                            const contactName = m.contact
                                ? [m.contact.firstName, m.contact.lastName].filter(Boolean).join(" ") ||
                                  "Contact"
                                : "Contact entreprise";
                            const companyName =
                                m.contact?.company?.name ?? m.company?.name ?? "Entreprise inconnue";
                            const d = m.callbackDate ? new Date(m.callbackDate) : null;
                            return (
                                <Link
                                    key={m.id}
                                    href="/client/portal/meetings"
                                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-gradient-to-r hover:from-[#e6f0fa]/40 hover:to-transparent transition-all duration-200 group relative"
                                    style={{
                                        animation: "dashFadeUp 0.35s ease both",
                                        animationDelay: `${140 + idx * 40}ms`,
                                    }}
                                >
                                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#2890F8] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                                    {/* Date pill */}
                                    <div className="w-[52px] shrink-0 flex flex-col items-center py-1.5 px-1 rounded-lg bg-[var(--elan-paper)] border border-[var(--elan-line)] group-hover:border-[#2890F8]/30 group-hover:bg-[#e6f0fa]/50 transition-all duration-200">
                                        {d ? (
                                            <>
                                                <span className="text-[17px] font-extrabold text-[var(--elan-ink)] leading-none">
                                                    {d.getDate()}
                                                </span>
                                                <span className="text-[9px] font-bold text-[#7f8e89] uppercase tracking-wide mt-0.5">
                                                    {formatShortMonth(m.callbackDate!)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[8px] font-bold text-[#7f8e89] uppercase tracking-wide text-center leading-tight">
                                                À confirmer
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13.5px] font-bold text-[var(--elan-ink)] truncate">
                                                {contactName}
                                            </span>
                                            <span className="text-[11px] text-[#7f8e89]">·</span>
                                            <span className="text-[12.5px] text-[#5C5E7E] font-medium truncate">
                                                {companyName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {m.callbackDate ? (
                                                <>
                                                    <span className="text-[11.5px] text-[#2890F8] font-semibold capitalize">
                                                        {formatMeetingDate(m.callbackDate)}
                                                    </span>
                                                    <span className="text-[10.5px] text-[#899892] font-medium">
                                                        {formatMeetingTime(m.callbackDate)}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-[11px] text-[#899892] italic">
                                                    Date à confirmer
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mission / SDR badge */}
                                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                                        <span className="inline-flex text-[10.5px] font-semibold text-[#2890F8] bg-[#e6f0fa] border border-[#2890F8]/20 px-2 py-[2px] rounded-full group-hover:bg-[#d4e8fc] transition-colors duration-200">
                                            {m.campaign?.mission?.name ?? "—"}
                                        </span>
                                        {m.interlocuteur && (
                                            <span className="inline-flex text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-[2px] rounded-full">
                                                {[m.interlocuteur.firstName, m.interlocuteur.lastName]
                                                    .filter(Boolean)
                                                    .join(" ") || "Commercial assigné"}
                                            </span>
                                        )}
                                    </div>

                                    {/* Arrow */}
                                    <div className="w-7 h-7 rounded-lg bg-[var(--elan-paper)] flex items-center justify-center shrink-0 group-hover:bg-[#2890F8] transition-all duration-200">
                                        <ArrowRight className="w-3.5 h-3.5 text-[#899892] group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200" />
                                    </div>
                                </Link>
                            );
                        })}

                        <div className="px-6 py-3">
                            <Link
                                href="/client/portal/meetings"
                                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#2890F8] hover:text-[#1a75ce] transition-colors duration-200 group"
                            >
                                Voir tous mes rendez-vous{" "}
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 3. PERFORMANCE / ENTONNOIR DE VALEUR ── */}
            <div
                className="premium-card p-6"
                style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "140ms" }}
            >
                <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-[#080808] flex items-center justify-center shadow-sm">
                        <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-[var(--elan-ink)] uppercase tracking-wider">
                            Conversion de la prospection
                        </h2>
                        <p className="text-xs text-[var(--elan-slate)] mt-0.5">
                            Du premier prospect contacté au rendez-vous confirmé
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Étape 1: Contactés */}
                    <div className="rounded-xl border border-[var(--elan-line)] bg-[var(--elan-paper)] p-4 flex flex-col justify-between">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--elan-slate)]">
                                1. Prospects contactés
                            </p>
                            <p className="text-2xl md:text-3xl font-black text-[var(--elan-ink)] mt-1.5 tabular-nums">
                                <AnimatedNumber value={funnelSummary.contacted} />
                            </p>
                        </div>
                        <p className="text-[11.5px] text-[var(--elan-slate)] mt-2">
                            Prospection ciblée sur votre marché
                        </p>
                    </div>

                    {/* Étape 2: Qualifiés */}
                    <div className="rounded-xl border border-[var(--elan-line)] bg-[var(--elan-paper)] p-4 flex flex-col justify-between relative">
                        <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 z-10">
                            <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-[var(--elan-line)] text-[#2890F8] shadow-sm">
                                {funnelSummary.contactToQualifiedRate}%
                            </span>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--elan-slate)]">
                                2. Leads qualifiés
                            </p>
                            <p className="text-2xl md:text-3xl font-black text-[var(--elan-ink)] mt-1.5 tabular-nums">
                                <AnimatedNumber value={funnelSummary.qualified} />
                            </p>
                        </div>
                        <p className="text-[11.5px] text-[var(--elan-slate)] mt-2">
                            Intérêt confirmé ou rappel programmé
                        </p>
                    </div>

                    {/* Étape 3: RDV */}
                    <div className="rounded-xl border border-[#2890F8]/25 bg-gradient-to-br from-[#e6f0fa]/80 to-[#d8eafc]/50 p-4 flex flex-col justify-between relative">
                        <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 z-10">
                            <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-[#2890F8]/30 text-[#2890F8] shadow-sm">
                                {funnelSummary.qualifiedToMeetingRate}%
                            </span>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2890F8]">
                                3. Rendez-vous obtenus
                            </p>
                            <p className="text-2xl md:text-3xl font-black text-[#0c3b38] mt-1.5 tabular-nums">
                                <AnimatedNumber value={funnelSummary.meetings} />
                            </p>
                        </div>
                        <p className="text-[11.5px] font-semibold text-[#2890F8] mt-2">
                            Transformation globale : {funnelSummary.overallRate}%
                        </p>
                    </div>
                </div>
            </div>

            {/* ── 4. RETOURS DES PROSPECTS (INTELLIGENCE DE MARCHÉ) ── */}
            <div
                className="premium-card p-6"
                style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "180ms" }}
            >
                <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--elan-paper-2)] border border-[var(--elan-line)] flex items-center justify-center text-[var(--elan-ink)] shrink-0">
                        <PhoneCall className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-[var(--elan-ink)] uppercase tracking-wider">
                            Retours des prospects
                        </h2>
                        <p className="text-xs text-[var(--elan-slate)] mt-0.5">
                            Ce que disent les prospects lors des échanges terrain
                        </p>
                    </div>
                </div>

                {/* Percentage distribution bars */}
                {prospectFeedbackInsight.topResults.length > 0 ? (
                    <div className="space-y-3">
                        {prospectFeedbackInsight.topResults.map((item) => (
                            <div key={item.result} className="flex items-center gap-3">
                                <span
                                    className="text-xs font-semibold text-[var(--elan-ink)] w-44 shrink-0 truncate"
                                    title={item.label}
                                >
                                    {item.label}
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-[var(--elan-paper-2)] overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[#2890F8]/80 transition-all duration-500"
                                        style={{ width: `${Math.min(100, Math.max(2, item.share))}%` }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-[var(--elan-ink)] tabular-nums w-14 text-right">
                                    {item.share}%
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--elan-slate)] py-4 text-center">
                        Aucune issue d&apos;échange enregistrée pour le moment.
                    </p>
                )}

                {/* 💡 Insight de marché */}
                <div className="mt-5 pt-4 border-t border-[var(--elan-line)] flex items-start gap-3 rounded-xl bg-[var(--elan-paper)] p-4 border border-[var(--elan-line)]">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[var(--elan-ink)] uppercase tracking-wide">
                            💡 Synthèse de marché
                        </p>
                        <p className="text-xs text-[var(--elan-ink-soft)] mt-1 leading-relaxed">
                            {prospectFeedbackInsight.insight}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── 5. SEGMENT LE PLUS PERFORMANT (BREAKDOWN CHARTS AVEC RECOMMANDATION) ── */}
            <BreakdownCharts />

            {/* ── 6. VOIR LE RAPPORT COMPLET (PASSERELLE DE CONSEIL) ── */}
            <div
                className="rounded-2xl border border-[var(--elan-line)] bg-gradient-to-br from-[var(--elan-surface)] to-[var(--elan-paper)] p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-sm"
                style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "220ms" }}
            >
                <div className="space-y-1.5 max-w-xl">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2890F8] bg-[#e6f0fa] border border-[#2890F8]/20 px-2.5 py-1 rounded-full">
                        <Sparkles className="w-3 h-3" />
                        Note de conseil stratégique
                    </div>
                    <h3 className="text-lg font-bold text-[var(--elan-ink)] tracking-tight">
                        Consulter le rapport d&apos;activité complet
                    </h3>
                    <p className="text-xs text-[var(--elan-slate)] leading-relaxed">
                        Retrouvez la synthèse détaillée rédigée par votre consultant : ce qui
                        fonctionne, points de vigilance, retours terrain complets et plan
                        d&apos;actions convenu.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Link
                        href="/client/portal/reporting"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#080808] hover:bg-[#202020] text-white text-xs font-bold transition-all shadow-md hover:shadow-lg"
                    >
                        Lire le rapport complet <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>

            {/* ── Optional: Call history & Database shortcuts (if configured in settings) ── */}
            {(portalSettings?.portalShowCallHistory || portalSettings?.portalShowDatabase) && (
                <div
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2"
                    style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "240ms" }}
                >
                    {portalSettings?.portalShowCallHistory && (
                        <Link
                            href="/client/portal/calls"
                            className="flex items-center gap-4 p-4 rounded-xl border border-[rgba(12,59,56,0.10)] bg-[var(--elan-surface)]/80 backdrop-blur-sm hover:border-[rgba(12,59,56,0.26)] hover:shadow-md transition-all duration-200 group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-[rgba(219,228,223,0.5)] flex items-center justify-center shrink-0 group-hover:bg-[rgba(219,228,223,0.8)] transition-colors">
                                <PhoneCall className="w-5 h-5 text-[#0c3b38]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[var(--elan-ink)]">
                                    Historique des appels
                                </p>
                                <p className="text-xs text-[var(--elan-slate)] mt-0.5">
                                    Consultez tous les appels passés par l&apos;équipe.
                                </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-[#7f8e89] group-hover:text-[#0c3b38] group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                    )}
                    {portalSettings?.portalShowDatabase && (
                        <Link
                            href="/client/portal/database"
                            className="flex items-center gap-4 p-4 rounded-xl border border-[rgba(12,59,56,0.10)] bg-[var(--elan-surface)]/80 backdrop-blur-sm hover:border-[rgba(12,59,56,0.26)] hover:shadow-md transition-all duration-200 group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center shrink-0 group-hover:from-emerald-500/20 group-hover:to-teal-500/20 transition-colors">
                                <Users className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[var(--elan-ink)]">
                                    Base de données
                                </p>
                                <p className="text-xs text-[var(--elan-slate)] mt-0.5">
                                    Vue des entreprises et contacts suivis par l&apos;équipe.
                                </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-[#899892] group-hover:text-[var(--elan-petrol)] group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                    )}
                </div>
            )}

            <style jsx global>{`
                @keyframes dashFadeUp {
                    from {
                        opacity: 0;
                        transform: translateY(12px);
                    }
                    to {
                        opacity: 1;
                        transform: none;
                    }
                }
            `}</style>
        </div>
    );
}
