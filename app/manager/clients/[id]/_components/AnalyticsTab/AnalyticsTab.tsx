"use client";

import { useState } from "react";
import { Phone, CalendarCheck, TrendingUp, Clock, RefreshCw, Loader2, Zap, BarChart3 } from "lucide-react";
import { StatCard, Button } from "@/components/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface AnalyticsTabProps {
    statsDateRange: { from: string; to: string };
    onDateRangeChange: (range: { from: string; to: string }) => void;
    clientStats: any;
    clientPersona: any;
    isLoadingStats: boolean;
    isLoadingPersona: boolean;
    onRefresh: () => void;
}

export function AnalyticsTab({
    statsDateRange,
    onDateRangeChange,
    clientStats,
    clientPersona,
    isLoadingStats,
    isLoadingPersona,
    onRefresh,
}: AnalyticsTabProps) {
    const kpis = clientStats?.kpis;
    const totalCalls = kpis?.totalCalls || 0;
    const meetings = kpis?.meetings || 0;
    const conversionRate = kpis?.conversionRate || 0;
    const totalTalkTimeMinutes = Math.round((kpis?.totalTalkTime || 0) / 60);

    const hasPersonaData =
        (clientPersona?.byFunction && clientPersona.byFunction.length > 0) ||
        (clientPersona?.bySector && clientPersona.bySector.length > 0);

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
                <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        Indicateurs de Performance & Ciblage
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Statistiques de prospection et conversion par persona cible.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                        <input
                            type="date"
                            value={statsDateRange.from}
                            onChange={(e) =>
                                onDateRangeChange({ ...statsDateRange, from: e.target.value })
                            }
                            className="px-2 py-1 text-xs border-0 bg-transparent text-slate-800 font-bold focus:outline-none"
                        />
                        <span className="text-slate-400">→</span>
                        <input
                            type="date"
                            value={statsDateRange.to}
                            onChange={(e) =>
                                onDateRangeChange({ ...statsDateRange, to: e.target.value })
                            }
                            className="px-2 py-1 text-xs border-0 bg-transparent text-slate-800 font-bold focus:outline-none"
                        />
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        className="p-2 text-slate-600 hover:text-[#2890F8] hover:border-[#2890F8]"
                        title="Actualiser les analytics"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            {isLoadingStats ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2890F8]" />
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <StatCard
                        label="Appels passés"
                        value={totalCalls}
                        icon={Phone}
                        iconBg="bg-blue-50"
                        iconColor="text-[#2890F8]"
                        subtitle={<span className="text-[11px] text-slate-400">Volume total</span>}
                        className="rounded-2xl border-slate-200 shadow-xs"
                    />

                    <StatCard
                        label="RDVs Décrochés"
                        value={meetings}
                        icon={CalendarCheck}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                        subtitle={<span className="text-[11px] text-emerald-700 font-semibold">Rendez-vous qualifiés</span>}
                        className="rounded-2xl border-slate-200 shadow-xs"
                    />

                    <StatCard
                        label="Taux de conversion"
                        value={`${conversionRate}%`}
                        icon={TrendingUp}
                        iconBg="bg-amber-50"
                        iconColor="text-amber-600"
                        subtitle={<span className="text-[11px] text-slate-400">Ratio appels / RDV</span>}
                        className="rounded-2xl border-slate-200 shadow-xs"
                    />

                    <StatCard
                        label="Temps de parole"
                        value={`${totalTalkTimeMinutes} min`}
                        icon={Clock}
                        iconBg="bg-violet-50"
                        iconColor="text-violet-600"
                        subtitle={<span className="text-[11px] text-slate-400">Cumul SDR</span>}
                        className="rounded-2xl border-slate-200 shadow-xs"
                    />
                </div>
            )}

            {/* Persona Target Breakdowns */}
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2890F8] flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                            Performance par Cible & Persona
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Quels postes et secteurs répondent le mieux aux campagnes.
                        </p>
                    </div>
                </div>

                <div className="p-6">
                    {isLoadingPersona ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-[#2890F8]" />
                        </div>
                    ) : hasPersonaData ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* By Function */}
                            {clientPersona.byFunction && clientPersona.byFunction.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Par fonction / Poste
                                    </h4>
                                    <div className="space-y-2">
                                        {clientPersona.byFunction.slice(0, 8).map((r: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-colors"
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <span className="text-xs font-bold text-slate-900 truncate">
                                                        {r.value}
                                                    </span>
                                                    <div className="flex items-center gap-3 text-xs shrink-0">
                                                        <span className="text-slate-400 font-medium">
                                                            {r.calls} appels
                                                        </span>
                                                        <span className="font-bold text-emerald-700">
                                                            {r.meetings} RDV
                                                        </span>
                                                        <span className="font-extrabold text-[#2890F8]">
                                                            {r.conversionRate}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <ProgressBar
                                                    value={r.meetings}
                                                    max={Math.max(r.calls, 1)}
                                                    height="sm"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* By Sector */}
                            {clientPersona.bySector && clientPersona.bySector.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Par secteur d'activité
                                    </h4>
                                    <div className="space-y-2">
                                        {clientPersona.bySector.slice(0, 8).map((r: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-colors"
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <span className="text-xs font-bold text-slate-900 truncate">
                                                        {r.value}
                                                    </span>
                                                    <div className="flex items-center gap-3 text-xs shrink-0">
                                                        <span className="text-slate-400 font-medium">
                                                            {r.calls} appels
                                                        </span>
                                                        <span className="font-bold text-emerald-700">
                                                            {r.meetings} RDV
                                                        </span>
                                                        <span className="font-extrabold text-[#2890F8]">
                                                            {r.conversionRate}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <ProgressBar
                                                    value={r.meetings}
                                                    max={Math.max(r.calls, 1)}
                                                    height="sm"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 italic">
                                Pas encore assez de données d'appels pour établir la ventilation du persona.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
