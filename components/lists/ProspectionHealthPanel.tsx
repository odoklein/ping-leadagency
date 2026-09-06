"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Zap,
    Target, CheckCircle2,
    ChevronDown, ChevronUp, Loader2,
    Flame,
} from "lucide-react";
import type { ListHealthMetrics } from "@/lib/types/health";
import {
    ProspectionHealthBadge,
    VelocityTrendBadge,
    ConfidenceBadge,
    ActivityScoreBar,
} from "./ProspectionHealthBadge";

// ============================================
// DATA FETCHING
// ============================================

async function fetchListHealth(listId: string, sdrIds?: string[]): Promise<ListHealthMetrics> {
    const params = new URLSearchParams();
    if (sdrIds?.length) sdrIds.forEach((id) => params.append("sdrIds[]", id));
    const res = await fetch(`/api/lists/${listId}/health?${params}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Erreur de chargement");
    return json.data as ListHealthMetrics;
}

// ============================================
// TYPES & PROPS
// ============================================

export type QuickFilterKey = "virgin" | "prospected" | "callbacks" | "bad_contacts" | "all";

export interface ProspectionHealthPanelProps {
    listId: string;
    listName?: string;
    sdrIds?: string[];
    collapsible?: boolean;
    defaultExpanded?: boolean;
    onQuickFilter?: (filterKey: QuickFilterKey) => void;
    activeQuickFilter?: string;
}

export function ProspectionHealthPanel({
    listId,
    sdrIds,
    collapsible = true,
    defaultExpanded = false,
    onQuickFilter,
    activeQuickFilter,
}: ProspectionHealthPanelProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const toggleExpanded = collapsible ? () => setExpanded(!expanded) : undefined;

    const { data: health, isLoading, error } = useQuery({
        queryKey: ["list-health", listId, sdrIds],
        queryFn: () => fetchListHealth(listId, sdrIds),
        staleTime: 2 * 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-slate-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span className="text-xs font-medium">Calcul de la santé de prospection…</span>
            </div>
        );
    }

    if (error || !health) {
        return (
            <div className="text-xs text-slate-400 py-1">
                Santé de prospection indisponible pour le moment.
            </div>
        );
    }

    const { eta, velocity } = health;
    const coveragePct = health.coverageRate ?? 0;

    const topHint =
        health.hints.find((h) => h.type === "CRITICAL") ??
        health.hints.find((h) => h.type === "WARNING") ??
        health.hints[0] ??
        null;

    return (
        <div className="space-y-3">
            {/* ── Header Pulse Bar ── */}
            <div
                className={`flex flex-wrap items-center justify-between gap-3 ${
                    collapsible ? "cursor-pointer select-none" : ""
                }`}
                onClick={toggleExpanded}
                role={collapsible ? "button" : undefined}
                tabIndex={collapsible ? 0 : undefined}
                aria-expanded={collapsible ? expanded : undefined}
                onKeyDown={
                    collapsible
                        ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleExpanded?.();
                              }
                          }
                        : undefined
                }
            >
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <ProspectionHealthBadge
                        status={health.status}
                        statusLabel={health.statusLabel}
                        statusExplanation={health.statusExplanation}
                    />

                    <div className="hidden sm:flex items-center gap-2">
                        <ActivityScoreBar
                            score={health.activityScore}
                            explanation={health.activityScoreExplanation}
                            size="md"
                        />
                    </div>

                    {/* Compact Runout metric in header */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">
                            {coveragePct.toFixed(0)}% couvert
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 font-medium">
                            {eta.etaDays !== null
                                ? eta.etaDays === 0
                                    ? "Prospection terminée"
                                    : `~${eta.etaDays}j restants (${velocity.actionsPerDay7d.toFixed(1)} act/j)`
                                : `${velocity.actionsPerDay7d.toFixed(1)} act/j`}
                        </span>
                    </div>

                    {collapsible && !expanded && topHint && (
                        <span className="hidden xl:inline text-xs text-slate-500 truncate max-w-sm">
                            · {topHint.message}
                        </span>
                    )}
                </div>

                {collapsible && (
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                        <span>{expanded ? "Réduire le cockpit" : "Cockpit détaillé"}</span>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                )}
            </div>

            {/* ── Expanded Cockpit: 3 Actionable Columns ── */}
            {(!collapsible || expanded) && (
                <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-in fade-in duration-200">
                    {/* 1. Jauge de prospection & Runout */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-emerald-600" />
                                    Jauge & Épuisement
                                </span>
                                <ConfidenceBadge
                                    confidence={eta.confidence}
                                    explanation={eta.confidenceExplanation}
                                />
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-slate-700">
                                        {health.contactedTargets} / {health.totalTargets} contactés
                                    </span>
                                    <span className="text-emerald-700">{coveragePct.toFixed(1)}%</span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                                        style={{ width: `${Math.max(coveragePct > 0 ? 2 : 0, coveragePct)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Runout estimation & cadence */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Échéance estimée</p>
                                <p className="font-bold text-slate-900 mt-0.5">
                                    {eta.etaDays !== null
                                        ? eta.etaDays === 0
                                            ? "Terminée ✓"
                                            : `~${eta.etaDays} jours`
                                        : "Cadence à initier"}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Vélocité 7j</p>
                                <div className="flex items-center gap-1 justify-end mt-0.5">
                                    <span className="font-bold text-slate-900">
                                        {velocity.actionsPerDay7d.toFixed(1)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">act/j</span>
                                    <VelocityTrendBadge
                                        trend={velocity.trend}
                                        explanation={velocity.trendExplanation}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Smart Action Queue (Filtres directs connectés à la table) */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                                    Accès Directs Table
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                    Filtrer en 1 clic
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Virgin Leads */}
                                <button
                                    type="button"
                                    onClick={() => onQuickFilter?.(activeQuickFilter === "virgin" ? "all" : "virgin")}
                                    className={`p-2 rounded-xl border text-left transition-all ${
                                        activeQuickFilter === "virgin"
                                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                                            : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <p className="text-[10px] font-semibold text-slate-500">🎯 Jamais contactés</p>
                                    <p className="text-base font-black text-slate-900 mt-0.5">
                                        {eta.remainingContacts}
                                    </p>
                                </button>

                                {/* Already Prospected */}
                                <button
                                    type="button"
                                    onClick={() => onQuickFilter?.(activeQuickFilter === "prospected" ? "all" : "prospected")}
                                    className={`p-2 rounded-xl border text-left transition-all ${
                                        activeQuickFilter === "prospected"
                                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                                            : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <p className="text-[10px] font-semibold text-slate-500">📞 Déjà appelés</p>
                                    <p className="text-base font-black text-slate-900 mt-0.5">
                                        {health.contactedTargets}
                                    </p>
                                </button>

                                {/* Callbacks / Interested */}
                                <button
                                    type="button"
                                    onClick={() => onQuickFilter?.(activeQuickFilter === "callbacks" ? "all" : "callbacks")}
                                    className={`p-2 rounded-xl border text-left transition-all ${
                                        activeQuickFilter === "callbacks"
                                            ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20"
                                            : "border-slate-200 hover:border-sky-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <p className="text-[10px] font-semibold text-slate-500">📅 Intéressés & Rappels</p>
                                    <p className="text-base font-black text-sky-700 mt-0.5">
                                        {health.resultBreakdown.positive}
                                    </p>
                                </button>

                                {/* Bad Contacts */}
                                <button
                                    type="button"
                                    onClick={() => onQuickFilter?.(activeQuickFilter === "bad_contacts" ? "all" : "bad_contacts")}
                                    className={`p-2 rounded-xl border text-left transition-all ${
                                        activeQuickFilter === "bad_contacts"
                                            ? "border-rose-500 bg-rose-50 ring-2 ring-rose-500/20"
                                            : "border-slate-200 hover:border-rose-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <p className="text-[10px] font-semibold text-slate-500">⚠️ Numéros KO / Invalides</p>
                                    <p className="text-base font-black text-rose-600 mt-0.5">
                                        {health.resultBreakdown.badContact}
                                    </p>
                                </button>
                            </div>
                        </div>

                        {topHint && (
                            <p className="text-[10px] text-slate-500 leading-tight pt-1 border-t border-slate-100 truncate">
                                💡 <strong className="text-slate-700">Conseil :</strong> {topHint.message}
                            </p>
                        )}
                    </div>

                    {/* 3. Performance SDR & Transformation */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                                    Résultats & SDRs
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {health.resultBreakdown.meetings} RDV
                                </span>
                            </div>

                            {/* Top SDRs roster */}
                            {health.topSdrs.length > 0 ? (
                                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                                    {health.topSdrs.slice(0, 3).map((sdr, i) => (
                                        <div
                                            key={sdr.sdrId}
                                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50/80 border border-slate-100"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {i + 1}
                                                </span>
                                                <span className="font-semibold text-slate-800 truncate">
                                                    {sdr.sdrName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 text-[11px] font-medium text-slate-500">
                                                <span>{sdr.actionCount} act.</span>
                                                {sdr.meetingsBooked > 0 && (
                                                    <span className="font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded">
                                                        {sdr.meetingsBooked} RDV
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic py-2">
                                    Aucune action enregistrée pour le moment.
                                </p>
                            )}
                        </div>

                        {/* Conversion mini stats */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">
                                Taux RDV :{" "}
                                <strong className="text-slate-800">
                                    {health.meetingRate !== null ? `${health.meetingRate.toFixed(1)}%` : "0%"}
                                </strong>
                            </span>
                            <span className="text-slate-500">
                                Intérêt :{" "}
                                <strong className="text-emerald-700">
                                    {health.positiveRate !== null ? `${health.positiveRate.toFixed(1)}%` : "0%"}
                                </strong>
                            </span>
                            <span className="text-slate-400 text-[10px]">
                                {health.totalActions} actions totales
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
