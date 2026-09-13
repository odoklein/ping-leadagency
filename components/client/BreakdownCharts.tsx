"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Phone, CalendarCheck, TrendingUp, Sparkles, Building2, Users, Briefcase, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateBestSegmentInsight } from "@/lib/client/insight-engine";

type BreakdownItem = {
    label: string;
    calls: number;
    rdv: number;
    rate: number;
};

type BreakdownData = {
    totalCalls: number;
    totalRdv: number;
    byIndustry: BreakdownItem[];
    bySize: BreakdownItem[];
    byFunction: BreakdownItem[];
};

type Dimension = "byFunction" | "byIndustry" | "bySize";
type Period = "month" | "quarter" | "all";

const DIMENSIONS: { key: Dimension; label: string; icon: React.ReactNode }[] = [
    { key: "byFunction", label: "Fonction", icon: <Briefcase className="w-3 h-3" /> },
    { key: "byIndustry", label: "Secteur", icon: <Building2 className="w-3 h-3" /> },
    { key: "bySize", label: "Taille d'entreprise", icon: <Users className="w-3 h-3" /> },
];

const PERIODS: { key: Period; label: string }[] = [
    { key: "month", label: "Ce mois" },
    { key: "quarter", label: "3 mois" },
    { key: "all", label: "Tout" },
];

function getPeriodParams(period: Period): Record<string, string> {
    const now = new Date();
    if (period === "all") return {};
    if (period === "month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
        };
    }
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
        startDate: start.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
    };
}

function RateChip({ rate }: { rate: number }) {
    const color =
        rate >= 15
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : rate >= 8
            ? "bg-amber-50 text-amber-700 border-amber-100"
            : "bg-[#F4F5FA] text-[#8B8DAF] border-[#E8EBF0]";
    return (
        <span className={cn("inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full border", color)}>
            {rate}%
        </span>
    );
}

function SkeletonRows() {
    return (
        <div className="space-y-3 animate-pulse">
            {[85, 65, 50, 38, 25].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                    <div className="w-28 h-3 rounded-full bg-[#E8EBF0]" />
                    <div className="flex-1 h-7 rounded-lg bg-[#E8EBF0]" style={{ width: `${w}%` }} />
                    <div className="w-16 h-6 rounded-lg bg-[#E8EBF0]" />
                </div>
            ))}
        </div>
    );
}

export function BreakdownCharts() {
    const [data, setData] = useState<BreakdownData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dimension, setDimension] = useState<Dimension>("byFunction");
    const [period, setPeriod] = useState<Period>("month");
    const [animated, setAnimated] = useState(false);

    const fetchData = useCallback(async (p: Period) => {
        setIsLoading(true);
        setAnimated(false);
        const params = new URLSearchParams(getPeriodParams(p));
        try {
            const res = await fetch(`/api/client/analytics/breakdown?${params}`);
            const json = await res.json();
            if (json.success) setData(json.data);
        } finally {
            setIsLoading(false);
            // Small delay so bars animate after render
            setTimeout(() => setAnimated(true), 80);
        }
    }, []);

    useEffect(() => {
        fetchData(period);
    }, [fetchData, period]);

    const items = data?.[dimension] ?? [];
    const maxCalls = Math.max(...items.map((i) => i.calls), 1);

    const globalRate =
        data && data.totalCalls > 0
            ? Math.round((data.totalRdv / data.totalCalls) * 1000) / 10
            : 0;

    const bestSegmentInsight = calculateBestSegmentInsight({
        segments: items,
        campaignAverageRate: globalRate,
    });
    const bestSegment = bestSegmentInsight.segment;

    return (
        <div
            className="premium-card overflow-hidden"
            style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "200ms" }}
        >
            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#E8EBF0]">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#080808] flex items-center justify-center shadow-sm shadow-black/20">
                        <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[#080808] uppercase tracking-wider">
                            Analyse de la prospection
                        </h2>
                        <p className="text-[11px] text-[#8B8DAF] mt-0.5">
                            Appels &amp; RDV par segment
                        </p>
                    </div>
                </div>

                {/* Period selector */}
                <div className="flex items-center rounded-xl bg-[#F4F5FA] border border-[#E8EBF0] p-0.5 gap-0.5">
                    {PERIODS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setPeriod(key)}
                            className={cn(
                                "text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap",
                                period === key
                                    ? "bg-white text-[#2890F8] shadow-sm font-bold"
                                    : "text-[#8B8DAF] hover:text-[#4B4D7A]"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-6 pt-5 pb-6 space-y-5">
                {/* ── KPI summary row ── */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            icon: <Phone className="w-3.5 h-3.5" />,
                            value: data?.totalCalls,
                            label: "Prospection réalisée",
                            from: "from-[#2890F8]",
                            to: "to-[#1a75ce]",
                            bg: "from-[#e6f0fa] to-[#d8eafc]",
                            border: "border-[#2890F8]/20",
                            text: "text-[#2890F8]",
                        },
                        {
                            icon: <CalendarCheck className="w-3.5 h-3.5" />,
                            value: data?.totalRdv,
                            label: "RDV obtenus",
                            from: "from-[#1a75ce]",
                            to: "to-[#2890F8]",
                            bg: "from-[#e6f0fa] to-[#d8eafc]",
                            border: "border-[#2890F8]/25",
                            text: "text-[#2890F8]",
                        },
                        {
                            icon: <TrendingUp className="w-3.5 h-3.5" />,
                            value: data ? `${globalRate}%` : undefined,
                            label: "Taux de conversion",
                            from: "from-emerald-400",
                            to: "to-teal-500",
                            bg: "from-emerald-50 to-teal-50",
                            border: "border-emerald-100/60",
                            text: "text-emerald-600",
                        },
                    ].map(({ icon, value, label, bg, border, text }) => (
                        <div
                            key={label}
                            className={cn(
                                "rounded-xl bg-gradient-to-br border p-3.5 flex flex-col gap-1.5",
                                bg,
                                border
                            )}
                        >
                            <div className={cn("flex items-center gap-1.5 font-semibold", text)}>
                                {icon}
                                <span className="text-[10.5px] uppercase tracking-wide">{label}</span>
                            </div>
                            <div className="text-[22px] font-black text-[#12122A] leading-none">
                                {value !== undefined ? value : (
                                    <span className="inline-block w-10 h-5 rounded bg-white/60 animate-pulse" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Dimension pills ── */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#A0A3BD] uppercase tracking-wider mr-1">
                        Analyser par
                    </span>
                    {DIMENSIONS.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            onClick={() => {
                                setDimension(key);
                                setAnimated(false);
                                setTimeout(() => setAnimated(true), 80);
                            }}
                            className={cn(
                                "inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150",
                                dimension === key
                                    ? "bg-[#2890F8] text-white border-[#2890F8] shadow-sm shadow-[#2890F8]/25"
                                    : "bg-white text-[#6B7194] border-[#E8EBF0] hover:border-[#2890F8]/40 hover:text-[#2890F8]"
                            )}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── Chart ── */}
                {isLoading ? (
                    <SkeletonRows />
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F4F6F9] to-[#E8EBF0] flex items-center justify-center">
                            <BarChart3 className="w-6 h-6 text-[#C0C3D8]" />
                        </div>
                        <p className="text-sm font-semibold text-[#8B8DAF]">Aucune donnée disponible</p>
                        <p className="text-xs text-[#A0A3BD] text-center max-w-xs">
                            Les données de prospection apparaîtront ici une fois les appels enregistrés.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {/* Legend */}
                        <div className="flex items-center gap-5 mb-3 text-[11px] font-medium text-[#8B8DAF]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-2.5 rounded-sm bg-gradient-to-r from-[#a8bdb4] to-[#8d9b96] opacity-80" />
                                Appels
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-2.5 rounded-sm bg-gradient-to-r from-[#1a75ce] to-[#2890F8]" />
                                RDV décrochés
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="text-emerald-600 font-semibold">≥15%</span>
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-2" />
                                <span className="text-amber-600 font-semibold">≥8%</span>
                            </div>
                        </div>

                        {items.map((item, idx) => {
                            const barW = (item.calls / maxCalls) * 100;
                            const rdvPct = item.calls > 0 ? (item.rdv / item.calls) * 100 : 0;
                            const delay = `${idx * 55}ms`;

                            return (
                                <div
                                    key={item.label}
                                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#F8F7FF] transition-colors duration-150"
                                    style={{
                                        animation: animated
                                            ? `dashFadeUp 0.3s ease both ${delay}`
                                            : "none",
                                    }}
                                >
                                    {/* Label */}
                                    <div
                                        className="w-[106px] shrink-0 text-[12px] font-semibold text-[#3D3F6B] truncate"
                                        title={item.label}
                                    >
                                        {item.label}
                                    </div>

                                    {/* Combined bar */}
                                    <div className="flex-1 h-7 rounded-lg bg-[#eeeeee] overflow-hidden relative">
                                        <div
                                            className="h-full flex rounded-lg overflow-hidden transition-all ease-out duration-700"
                                            style={{
                                                width: animated ? `${barW}%` : "0%",
                                                transitionDelay: delay,
                                            }}
                                        >
                                            {item.rdv > 0 && (
                                                <div
                                                    className="h-full bg-gradient-to-r from-[#1a75ce] to-[#2890F8] flex items-center justify-center overflow-hidden shrink-0"
                                                    style={{ width: `${rdvPct}%` }}
                                                >
                                                    {rdvPct > 18 && (
                                                        <span className="text-[9px] font-black text-white/90 px-1">
                                                             {item.rdv}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="h-full flex-1 bg-gradient-to-r from-[#a8bdb4] to-[#8d9b96] opacity-70" />
                                        </div>

                                        {/* Inline calls count on bar if wide enough */}
                                        {barW > 30 && (
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-slate-500/70">
                                                {item.calls}
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div className="w-[68px] shrink-0 flex flex-col items-end gap-0.5">
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#12122A]">
                                            <span>{item.calls}</span>
                                            <span className="text-[#b8c2bd] font-normal">·</span>
                                            <span className="text-[#2890F8]">{item.rdv}</span>
                                        </div>
                                        <RateChip rate={item.rate} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Best segment insight ── */}
                {!isLoading && bestSegmentInsight.hasSignificantData && bestSegment && (
                    <div
                        className="rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-teal-50/70 p-4 flex items-start gap-3.5 shadow-sm"
                        style={{ animation: "dashFadeUp 0.4s ease both", animationDelay: "600ms" }}
                    >
                        <div className="w-8 h-8 rounded-lg bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                                    Segment le plus performant
                                </span>
                                <span className="text-sm font-extrabold text-emerald-950">
                                    {bestSegment.label}
                                </span>
                            </div>
                            <p className="text-xs text-emerald-800/90 mt-1">
                                <span className="font-bold">{bestSegment.rdv} RDV</span> sur {bestSegment.calls} contacts —{" "}
                                <span className="font-black text-emerald-900">{bestSegment.rate}% de conversion</span>
                            </p>
                            {bestSegmentInsight.recommendation && (
                                <p className="mt-2 text-xs font-semibold text-emerald-900 bg-white/75 border border-emerald-200/70 rounded-lg px-2.5 py-1.5 inline-block">
                                    → {bestSegmentInsight.recommendation}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {!isLoading && items.length > 0 && !bestSegmentInsight.hasSignificantData && bestSegmentInsight.notice && (
                    <div className="rounded-xl border border-[var(--elan-line)] bg-[var(--elan-paper)] p-3.5 flex items-center gap-2.5 text-xs text-[var(--elan-slate)]">
                        <Info className="w-4 h-4 shrink-0 text-[var(--elan-slate)]" />
                        <span>{bestSegmentInsight.notice}</span>
                    </div>
                )}

                {/* ── Footer legend ── */}
                <p className="text-[10.5px] text-[#B0B3C8] text-center">
                    La barre <span className="font-semibold text-[#2890F8]">bleue</span> représente les RDV décrochés,{" "}
                    <span className="font-semibold text-slate-400">grise</span> les appels sans conversion.
                </p>
            </div>
        </div>
    );
}
