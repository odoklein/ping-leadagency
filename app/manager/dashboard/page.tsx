"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Phone, RefreshCw, TrendingUp, ArrowUpRight, Flame, Trophy,
    Clock, ArrowRight, AlertTriangle, Calendar, ChevronDown, Target,
    Activity, Users, Star, CheckCircle2, Zap, BarChart3, Radio,
    Sparkles, ShieldCheck, Check,
} from "lucide-react";
import Link from "next/link";
import {
    DateRangeFilter, getPresetRange, toISO,
    type DateRangeValue, type DateRangePreset,
} from "@/components/dashboard/DateRangeFilter";
import {
    AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface DashboardStats {
    period: string;
    totalActions: number;
    meetingsBooked: number;
    opportunities: number;
    activeMissions: number;
    conversionRate: number;
    resultBreakdown: {
        NO_RESPONSE: number; BAD_CONTACT: number; INTERESTED: number;
        CALLBACK_REQUESTED: number; MEETING_BOOKED: number; DISQUALIFIED: number;
    };
    leaderboard: { id: string; name: string; calls: number; connectedCalls: number; actions: number }[];
    rdvLeaderboard: { id: string; name: string; rdv: number; actions: number }[];
    /** Whether Allo call metrics (calls/connectedCalls in the leaderboard) are actually wired up. */
    alloConfigured: boolean;
    /** Real cumulative RDV count per day of the current week (Monday-first, 7 values). */
    weeklyTrajectory: number[];
}
interface MissionSummaryItem {
    id: string; name: string; isActive: boolean;
    client: { id: string; name: string };
    sdrCount: number; actionsThisPeriod: number;
    meetingsThisPeriod: number; meetingsGoal: number; lastActionAt: string | null;
}
interface RecentActivityItem {
    id: string; user: string; userId: string; action: string; time: string;
    type: "call" | "meeting" | "schedule"; createdAt: string;
    result?: string; contactOrCompanyName?: string; campaignName?: string;
}

/* ─── Constants ─── */
const PRESET_LABELS: Record<DateRangePreset, string> = {
    last7: "7 derniers jours", last4weeks: "4 dernières semaines",
    lastMonth: "Mois dernier", last6months: "6 derniers mois",
    last12months: "12 derniers mois", monthToDate: "Mois en cours",
    quarterToDate: "Trimestre en cours", yearToDate: "Année en cours",
    allTime: "Tout",
};
const RDV_WEEKLY_GOAL = 30;
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const EMPTY_MISSIONS: MissionSummaryItem[] = [];
const EMPTY_RECENT_ACTIVITY: RecentActivityItem[] = [];

/* ─── Helpers ─── */
function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
function buildWeeklyGoalData(weeklyTrajectory: number[] | undefined) {
    return DAYS.map((jour, i) => ({
        jour: jour.slice(0, 2),
        jourComplet: jour,
        objectif: Math.round((RDV_WEEKLY_GOAL / 7) * (i + 1) * 10) / 10,
        cumul: weeklyTrajectory?.[i] ?? 0,
    }));
}

/* ─── Custom Tooltip ─── */
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; payload?: { jourComplet?: string } }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    const fullDay = payload[0]?.payload?.jourComplet || label;
    return (
        <div className="bg-[#0B0F19] text-white border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs min-w-[150px] backdrop-blur-md">
            <p className="text-slate-400 mb-2 font-semibold border-b border-slate-800 pb-1.5">{fullDay}</p>
            <div className="space-y-1.5">
                {payload.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                            <span className="text-slate-300 font-medium">{p.name} :</span>
                        </div>
                        <span className="font-bold tabular-nums text-white">{p.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════
   DASHBOARD DATA FETCH
════════════════════════════════════════════════════════ */
interface DashboardData {
    stats: DashboardStats | null;
    missions: MissionSummaryItem[];
    recentActivity: RecentActivityItem[];
}
async function fetchDashboardData(
    start: string,
    end: string,
    missionId: string
): Promise<DashboardData> {
    const missionQueryParam = missionId ? `&missionId=${missionId}` : "";
    const statsUrl = `/api/stats?startDate=${start}&endDate=${end}${missionQueryParam}`;
    const [statsRes, missionsRes, recentRes] = await Promise.all([
        fetch(statsUrl),
        fetch(`/api/stats/missions-summary?startDate=${start}&endDate=${end}&limit=10${missionQueryParam}`),
        fetch("/api/actions/recent?limit=20"),
    ]);
    const [statsJson, missionsJson, recentJson] = await Promise.all([
        statsRes.json(), missionsRes.json(), recentRes.json(),
    ]);
    if (!statsRes.ok || !statsJson.success) {
        throw new Error(statsJson.error || "Impossible de charger le tableau de bord");
    }
    return {
        stats: statsJson.data,
        missions: missionsJson.success ? missionsJson.data?.missions ?? [] : [],
        recentActivity: recentJson.success ? recentJson.data ?? [] : [],
    };
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════ */
export default function ManagerDashboard() {
    const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
        const { start, end } = getPresetRange("lastMonth");
        return { preset: "lastMonth", startDate: toISO(start), endDate: toISO(end) };
    });
    const [dateFilterOpen, setDateFilterOpen] = useState(false);
    const dateFilterRef = useRef<HTMLDivElement>(null);
    const [missionFilter, setMissionFilter] = useState("");

    const start = dateRange.startDate && dateRange.endDate
        ? dateRange.startDate
        : toISO(getPresetRange((dateRange.preset as DateRangePreset) || "lastMonth").start);
    const end = dateRange.startDate && dateRange.endDate
        ? dateRange.endDate
        : toISO(getPresetRange((dateRange.preset as DateRangePreset) || "lastMonth").end);

    const { data, error, isError, isLoading, isFetching, refetch } = useQuery({
        queryKey: ["manager", "dashboard", start, end, missionFilter],
        queryFn: () => fetchDashboardData(start, end, missionFilter),
        refetchInterval: 60_000,
    });
    const stats = data?.stats ?? null;
    const missions = data?.missions ?? EMPTY_MISSIONS;
    const recentActivity = data?.recentActivity ?? EMPTY_RECENT_ACTIVITY;

    // This week's real cumulative RDV count (last day of weeklyTrajectory), not the
    // selected-period total — the card below is explicitly a weekly goal indicator.
    const thisWeekRdv = stats?.weeklyTrajectory?.[6] ?? 0;
    const rdvGoalPct = Math.min((thisWeekRdv / RDV_WEEKLY_GOAL) * 100, 100);
    const hotLeads = stats ? (stats.resultBreakdown.INTERESTED + stats.resultBreakdown.CALLBACK_REQUESTED) : 0;
    const callbackCount = stats?.resultBreakdown?.CALLBACK_REQUESTED ?? 0;
    const interestedCount = stats?.resultBreakdown?.INTERESTED ?? 0;

    const missionsNearGoal = useMemo(() => missions.filter((m) => m.isActive && m.meetingsThisPeriod > 0).sort((a, b) => b.meetingsThisPeriod - a.meetingsThisPeriod).slice(0, 5), [missions]);
    const weeklyGoalData = useMemo(() => buildWeeklyGoalData(stats?.weeklyTrajectory), [stats?.weeklyTrajectory]);

    const setQuickPreset = (preset: DateRangePreset) => {
        const range = getPresetRange(preset);
        setDateRange({ preset, startDate: toISO(range.start), endDate: toISO(range.end) });
    };

    if (isLoading && !stats) {
        return (
            <div className="space-y-6 max-w-[1600px] mx-auto w-full min-h-[70vh]">
                <div className="flex justify-between items-center">
                    <div className="h-10 w-72 bg-slate-200/70 animate-pulse rounded-2xl" />
                    <div className="h-10 w-48 bg-slate-200/70 animate-pulse rounded-2xl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-44 bg-slate-200/60 animate-pulse rounded-3xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-7 h-96 bg-slate-200/60 animate-pulse rounded-3xl" />
                    <div className="xl:col-span-5 h-96 bg-slate-200/60 animate-pulse rounded-3xl" />
                </div>
            </div>
        );
    }

    if (isError && !data) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-6">
                <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl shadow-red-500/5">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Tableau de bord indisponible</h1>
                    <p className="mt-2 text-xs text-slate-500 leading-relaxed">{error instanceof Error ? error.message : "Une erreur inattendue est survenue."}</p>
                    <button
                        onClick={() => refetch()}
                        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#2890F8] px-6 text-sm font-bold text-white hover:bg-[#1a75ce] shadow-md shadow-blue-500/20 active:translate-y-px transition-all"
                    >
                        <RefreshCw className="h-4 w-4" /> Réessayer
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto w-full pb-8">
            {/* ── Top Command Bar & Live Status ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/70">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#0B0F19] text-[#2890F8] flex items-center justify-center shadow-md shadow-black/20 border border-slate-800">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                    Command Center Manager
                                </h1>
                                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    En direct
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-2 pl-1">
                        <span>Période : <strong className="text-slate-700">{dateRange.preset ? PRESET_LABELS[dateRange.preset] : "Personnalisée"}</strong></span>
                        <span>•</span>
                        <span>Missions : <strong className="text-slate-700">{missionFilter ? "Filtrée" : "Toutes les missions"}</strong></span>
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Quick Preset Buttons */}
                    <div className="hidden sm:flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                        {(["last7", "lastMonth", "monthToDate"] as DateRangePreset[]).map((preset) => {
                            const isSelected = dateRange.preset === preset;
                            return (
                                <button
                                    key={preset}
                                    onClick={() => setQuickPreset(preset)}
                                    className={cn(
                                        "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all",
                                        isSelected
                                            ? "bg-[#0B0F19] text-white shadow-xs"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    )}
                                >
                                    {preset === "last7" ? "7j" : preset === "lastMonth" ? "30j" : "Mois"}
                                </button>
                            );
                        })}
                    </div>

                    {/* Date filter dropdown */}
                    <div className="relative" ref={dateFilterRef}>
                        <button
                            onClick={() => setDateFilterOpen((o) => !o)}
                            aria-expanded={dateFilterOpen}
                            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-[#2890F8] hover:shadow-xs transition-all shadow-2xs"
                        >
                            <Calendar className="w-3.5 h-3.5 text-[#2890F8]" />
                            <span>{dateRange.preset ? PRESET_LABELS[dateRange.preset] : "Plage"}</span>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", dateFilterOpen && "rotate-180")} />
                        </button>
                        {dateFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setDateFilterOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 z-50 max-w-[calc(100vw-2rem)]">
                                    <DateRangeFilter value={dateRange} onChange={(v) => setDateRange(v)} onClose={() => setDateFilterOpen(false)} isOpen />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Mission filter */}
                    <select
                        value={missionFilter}
                        onChange={(e) => setMissionFilter(e.target.value)}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] shadow-2xs"
                    >
                        <option value="">Toutes les missions</option>
                        {missions.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        title="Actualiser les données"
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#2890F8] hover:border-blue-300 transition-all shadow-2xs disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin text-[#2890F8]")} />
                    </button>

                    {/* New mission CTA */}
                    <Link
                        href="/manager/missions/new"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#2890F8] to-[#156cd4] hover:from-[#1e7fd8] hover:to-[#0f5ab5] shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all"
                    >
                        <span className="text-base leading-none">+</span>
                        <span>Nouvelle mission</span>
                    </Link>
                </div>
            </div>

            {/* ── High-Contrast Luxury KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* 1. Appels Réalisés — Midnight Sapphire Dark Luxury Card */}
                <Link
                    href="/manager/prospection"
                    className="group relative p-5 rounded-3xl bg-gradient-to-br from-[#0A1224] via-[#0B152A] to-[#050B16] border border-blue-900/70 text-white shadow-xl shadow-black/20 hover:border-blue-400/60 hover:shadow-2xl hover:shadow-blue-500/15 transition-all duration-300 text-left flex flex-col justify-between overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#2890F8]/15 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                    <div className="flex items-center justify-between z-10">
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-[#2890F8] group-hover:scale-105 transition-transform backdrop-blur-xs">
                            <Phone className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[10px] font-bold tracking-wide backdrop-blur-xs">
                            Volume Global
                        </span>
                    </div>

                    <div className="my-4 z-10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Appels & Actions</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-3xl sm:text-4xl font-black text-white tracking-tight tabular-nums">
                                {stats?.totalActions ?? 0}
                            </p>
                            <span className="text-xs text-slate-400 font-medium">actions</span>
                        </div>
                    </div>

                    {/* Telemetry meter */}
                    <div className="space-y-1.5 z-10 pt-2 border-t border-white/10">
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#2890F8] via-[#38BDF8] to-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: stats?.totalActions ? "100%" : "20%" }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                            <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Activité active
                            </span>
                            <span className="text-blue-300 font-bold">{stats?.totalActions ?? 0} menées</span>
                        </div>
                    </div>
                </Link>

                {/* 2. RDV Obtenus — Obsidian Dark Luxury Card */}
                <Link
                    href="/manager/rdv"
                    className="group relative p-5 rounded-3xl bg-gradient-to-br from-[#0B0F19] via-[#0D121F] to-[#04060A] border border-slate-800 text-white shadow-xl shadow-black/20 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 text-left flex flex-col justify-between overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                    <div className="flex items-center justify-between z-10">
                        <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#2890F8] group-hover:scale-105 transition-transform">
                            <Trophy className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[10px] font-bold">
                            {Math.round(rdvGoalPct)}% Objectif
                        </span>
                    </div>

                    <div className="my-4 z-10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">RDV Confirmés</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-3xl sm:text-4xl font-black text-white tracking-tight tabular-nums">
                                {thisWeekRdv}
                            </p>
                            <span className="text-xs text-slate-400 font-medium">/ {RDV_WEEKLY_GOAL} visés</span>
                        </div>
                    </div>

                    {/* Progress bar towards goal */}
                    <div className="space-y-1.5 z-10 pt-2 border-t border-white/10">
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#2890F8] to-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${rdvGoalPct}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                            <span>Objectif hebdo (semaine en cours)</span>
                            <span className="text-amber-300 font-bold">{thisWeekRdv} signés</span>
                        </div>
                    </div>
                </Link>

                {/* 3. Leads Chauds & Rappels — Solar Amber Soft Luxury Theme */}
                <Link
                    href="/manager/prospection"
                    className="group relative p-5 rounded-3xl bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 border border-amber-200/80 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 text-left flex flex-col justify-between overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-28 h-28 bg-amber-400/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />

                    <div className="flex items-center justify-between z-10">
                        <div className="w-11 h-11 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform shadow-2xs">
                            <Flame className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100/80 border border-amber-200/80 text-amber-800 text-[10px] font-bold tracking-wide">
                            Haute Intention
                        </span>
                    </div>

                    <div className="my-4 z-10">
                        <p className="text-xs font-bold text-amber-900/60 uppercase tracking-wider">Leads Chauds & Rappels</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-3xl sm:text-4xl font-black text-amber-950 tracking-tight tabular-nums">
                                {hotLeads}
                            </p>
                            <span className="text-xs text-amber-700/70 font-medium">contacts qualifiés</span>
                        </div>
                    </div>

                    {/* Progress / Signal bar */}
                    <div className="space-y-1.5 z-10 pt-2 border-t border-amber-200/60">
                        <div className="h-1.5 w-full bg-amber-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-500"
                                style={{ width: hotLeads > 0 ? "75%" : "15%" }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-amber-800">
                            <span className="font-semibold">
                                {callbackCount} rappels à exécuter
                            </span>
                            <ArrowUpRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </Link>

                {/* 4. Taux de Transformation — Mint Emerald Soft Luxury Theme */}
                <Link
                    href="/manager/analytics"
                    className="group relative p-5 rounded-3xl bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 border border-emerald-200/80 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 text-left flex flex-col justify-between overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-400/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />

                    <div className="flex items-center justify-between z-10">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shadow-2xs">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100/80 border border-emerald-200/80 text-emerald-800 text-[10px] font-bold tracking-wide">
                            Conversion
                        </span>
                    </div>

                    <div className="my-4 z-10">
                        <p className="text-xs font-bold text-emerald-900/60 uppercase tracking-wider">Taux de Conversion</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-3xl sm:text-4xl font-black text-emerald-950 tracking-tight tabular-nums">
                                {Math.round((stats?.conversionRate ?? 0) * 10) / 10}%
                            </p>
                            <span className="text-xs text-emerald-700/70 font-medium">global</span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5 z-10 pt-2 border-t border-emerald-200/60">
                        <div className="h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(Math.round((stats?.conversionRate ?? 0) * 5), 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-emerald-800">
                            <span className="font-semibold flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Performance équipe
                            </span>
                            <ArrowUpRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </Link>
            </div>

            {/* ── Main Interactive Dashboard Grid ── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* ── ZONE 1: Performance Graph (7 Cols) ── */}
                <section className="xl:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2890F8]">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Performance & Trajectoire RDV</h2>
                                <p className="text-xs text-slate-500">Progression cumulée vs objectif hebdomadaire</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-semibold">
                            <span className="inline-flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#0B0F19]" />
                                Réalisé
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#2890F8]" />
                                Objectif
                            </span>
                        </div>
                    </div>

                    <div className="my-6 h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyGoalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="manager-perf-gradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2890F8" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#2890F8" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="jour"
                                    tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
                                    axisLine={{ stroke: "#e2e8f0" }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="objectif"
                                    stroke="#2890F8"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Objectif visé"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cumul"
                                    stroke="#0B0F19"
                                    strokeWidth={3}
                                    fill="url(#manager-perf-gradient)"
                                    name="RDV Réalisés"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Summary Row */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 bg-slate-50/60 -mx-6 -mb-6 p-4 rounded-b-3xl">
                        <div className="text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Actions</p>
                            <p className="text-base font-black text-slate-900 tabular-nums">{stats?.totalActions ?? 0}</p>
                        </div>
                        <div className="text-center border-x border-slate-200">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">RDV Confirmés</p>
                            <p className="text-base font-black text-[#2890F8] tabular-nums">{stats?.meetingsBooked ?? 0}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taux de Succès</p>
                            <p className="text-base font-black text-emerald-600 tabular-nums">{Math.round((stats?.conversionRate ?? 0) * 10) / 10}%</p>
                        </div>
                    </div>
                </section>

                {/* ── ZONE 2: Priorities & Actions Center (5 Cols) ── */}
                <section className="xl:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Priorités Commerciales</h2>
                                <p className="text-xs text-slate-500">Actions à fort impact pour l&apos;équipe</p>
                            </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                            {callbackCount + interestedCount} signaux
                        </span>
                    </div>

                    <div className="space-y-3 my-4">
                        {[
                            {
                                href: "/manager/prospection",
                                icon: Clock,
                                label: "Rappels planifiés",
                                help: "Prospects en attente d'un second contact",
                                value: callbackCount,
                                badge: "Urgent",
                                badgeCls: "bg-amber-100 text-amber-800",
                                iconBg: "bg-amber-50 text-amber-600 border border-amber-200",
                            },
                            {
                                href: "/manager/prospection",
                                icon: Star,
                                label: "Prospects Intéressés",
                                help: "Intérêt manifesté à transformer en RDV",
                                value: interestedCount,
                                badge: "Chaud",
                                badgeCls: "bg-emerald-100 text-emerald-800",
                                iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200",
                            },
                            {
                                href: "/manager/rdv",
                                icon: CheckCircle2,
                                label: "RDV à Préparer & Briefer",
                                help: "Rendez-vous récents pris par vos SDRs",
                                value: stats?.meetingsBooked ?? 0,
                                badge: "Gagné",
                                badgeCls: "bg-blue-100 text-[#1a75ce]",
                                iconBg: "bg-blue-50 text-[#2890F8] border border-blue-200",
                            },
                        ].map((row) => {
                            const Icon = row.icon;
                            return (
                                <Link
                                    key={row.label}
                                    href={row.href}
                                    className="group flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:border-[#2890F8] hover:bg-white hover:shadow-md transition-all"
                                >
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform", row.iconBg)}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 truncate">{row.label}</span>
                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.2 rounded", row.badgeCls)}>
                                                {row.badge}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{row.help}</p>
                                    </div>
                                    <span className="text-xl font-black tabular-nums text-slate-900 px-2">{row.value}</span>
                                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2890F8] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                </Link>
                            );
                        })}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Traitez vos relances dès 9h00 pour maximiser le taux de réponse.</span>
                    </div>
                </section>

                {/* ── ZONE 3: Missions Progress (7 Cols) ── */}
                <section className="xl:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                                <Target className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Progression des Missions Actives</h2>
                                <p className="text-xs text-slate-500">Classement par volume de rendez-vous générés</p>
                            </div>
                        </div>
                        <Link href="/manager/missions" className="text-xs font-bold text-[#2890F8] hover:text-[#1a75ce] flex items-center gap-1">
                            <span>Voir toutes</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {missionsNearGoal.length === 0 ? (
                        <div className="py-12 text-center">
                            <Target className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-2 text-sm text-slate-600 font-medium">Aucune mission active sur cette période.</p>
                            <Link href="/manager/missions/new" className="mt-3 inline-flex text-xs font-bold text-[#2890F8]">
                                + Créer une première mission
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 mt-2">
                            {missionsNearGoal.map((m) => {
                                const goal = m.meetingsGoal;
                                const pct = Math.min(100, Math.round((m.meetingsThisPeriod / goal) * 100));
                                return (
                                    <Link
                                        key={m.id}
                                        href={`/manager/missions/${m.id}`}
                                        className="group block py-4 first:pt-3 last:pb-0 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-slate-900 group-hover:text-[#2890F8] transition-colors truncate">
                                                        {m.name}
                                                    </p>
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                                        {m.client.name}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {m.sdrCount} SDR assigné{m.sdrCount > 1 ? "s" : ""} · {m.actionsThisPeriod} actions menées
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black tabular-nums text-slate-800">
                                                    {m.meetingsThisPeriod} <span className="text-slate-400 font-normal">/ {goal} RDV</span>
                                                </span>
                                                <span className={cn(
                                                    "text-[11px] font-bold px-2 py-0.5 rounded-full",
                                                    pct >= 80 ? "bg-emerald-100 text-emerald-800" : pct >= 40 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                                                )}>
                                                    {pct}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-500",
                                                    pct >= 80 ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-[#2890F8] to-[#156cd4]"
                                                )}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ── ZONE 4: SDR Leaderboard (5 Cols) ── */}
                <section className="xl:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                                <Trophy className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Podium & Performance SDR</h2>
                                <p className="text-xs text-slate-500">Classement des conversions individuelles</p>
                            </div>
                        </div>
                    </div>

                    {stats?.rdvLeaderboard?.length ? (
                        <div className="mt-4 space-y-2">
                            {stats.rdvLeaderboard.slice(0, 5).map((person, i) => {
                                const callStats = stats.leaderboard.find((entry) => entry.id === person.id);
                                const maxRdv = stats.rdvLeaderboard[0]?.rdv || 1;
                                const rankBadge = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;

                                return (
                                    <div
                                        key={person.id}
                                        className={cn(
                                            "flex items-center gap-3.5 p-3 rounded-2xl border transition-all",
                                            i === 0
                                                ? "bg-gradient-to-r from-amber-50/60 to-white border-amber-200/80 shadow-xs"
                                                : "bg-slate-50/50 border-slate-200/60 hover:bg-white hover:border-slate-300"
                                        )}
                                    >
                                        <span className="w-6 text-center text-sm font-black">{rankBadge}</span>

                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-2xs",
                                            i === 0 ? "bg-[#0B0F19] text-white ring-2 ring-amber-400" : "bg-white text-slate-700 border border-slate-200"
                                        )}>
                                            {getInitials(person.name)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-900 truncate">{person.name}</span>
                                                <span className="text-xs font-black text-slate-900 tabular-nums">{person.rdv} RDV</span>
                                            </div>

                                            <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden mt-1.5">
                                                <div
                                                    className="h-full bg-gradient-to-r from-[#2890F8] to-[#156cd4] rounded-full"
                                                    style={{ width: `${Math.round((person.rdv / maxRdv) * 100)}%` }}
                                                />
                                            </div>

                                            <p className="text-[10px] text-slate-400 mt-1">
                                                {stats.alloConfigured ? (
                                                    <>{callStats?.calls ?? 0} appels passés · {person.actions} actions</>
                                                ) : (
                                                    <span title="Intégration Allo non configurée — nombre d'appels indisponible">
                                                        Appels — <span className="italic">non configuré</span> · {person.actions} actions
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <Users className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-2 text-sm text-slate-500">Aucun appel enregistré sur cette période.</p>
                        </div>
                    )}
                </section>

                {/* ── ZONE 5: Live Activity Stream (12 Cols) ── */}
                <section className="xl:col-span-12 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2890F8]">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Activité & Flux d&apos;Événements en Direct</h2>
                                <p className="text-xs text-slate-500">Dernières interactions commerciales enregistrées</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold text-slate-400">{recentActivity.length} événements</span>
                    </div>

                    {recentActivity.length === 0 ? (
                        <div className="py-12 text-center">
                            <Activity className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-2 text-sm text-slate-500">Aucune activité récente.</p>
                        </div>
                    ) : (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {recentActivity.slice(0, 10).map((item) => {
                                const isMeeting = item.type === "meeting";
                                const isCall = item.type === "call";

                                return (
                                    <div
                                        key={item.id}
                                        className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50/60 border border-slate-200/70 hover:bg-white hover:shadow-xs transition-all"
                                    >
                                        <div
                                            className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                                                isMeeting
                                                    ? "bg-blue-100 text-[#2890F8]"
                                                    : isCall
                                                        ? "bg-slate-200 text-slate-700"
                                                        : "bg-amber-100 text-amber-700"
                                            )}
                                        >
                                            {isMeeting ? <CheckCircle2 className="w-4 h-4" /> : isCall ? <Phone className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-700 leading-relaxed">
                                                <strong className="text-slate-900 font-bold">{item.user}</strong> {item.action}
                                                {item.contactOrCompanyName ? (
                                                    <> avec <span className="font-bold text-[#2890F8]">{item.contactOrCompanyName}</span></>
                                                ) : null}
                                            </p>
                                            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                                                <span>{item.campaignName ?? "Prospection générale"}</span>
                                                <span>•</span>
                                                <span>{item.time}</span>
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
