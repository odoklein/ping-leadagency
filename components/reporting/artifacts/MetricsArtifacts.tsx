"use client";

import { useMemo } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Activity, BarChart3, Filter, Target, Sparkles } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import type { ClientDailyMetrics } from "@/lib/reporting/client-daily/types";
import { calculateProspectFeedbackInsight } from "@/lib/client/insight-engine";
import { ArtifactCard, DeltaPill, SectionTitle, formatPct } from "./primitives";

const CHANNEL_LABELS: Record<string, string> = {
    CALL: "Appels",
    EMAIL: "Emails",
    LINKEDIN: "LinkedIn",
};

function pctDelta(current: number, previous: number | null | undefined): number | null {
    if (previous == null || previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
}

// ============================================
// KPI row — the four figures the client checks first
// ============================================

export function KpiRow({ metrics, printMode }: { metrics: ClientDailyMetrics; printMode?: boolean }) {
    const { brief, month, funnel } = metrics;

    const tiles = [
        {
            label: `RDV · ${brief.label.toLowerCase()}`,
            value: brief.meetings,
            // A weekend is not a -100%: no comparison on a non-working window.
            delta: brief.businessDays === 0 ? null : pctDelta(brief.meetings, brief.previous?.meetings),
            hint:
                brief.businessDays === 0
                    ? "Période non ouvrée"
                    : brief.previous
                      ? `${brief.previous.meetings} sur la période précédente`
                      : brief.rangeLabel,
        },
        {
            label: `RDV · ${month.label}`,
            value: month.meetings,
            delta: pctDelta(month.meetings, month.previousMonth?.meetings),
            hint: `Objectif ${month.objective}`,
        },
        {
            label: "Prospects contactés · ce mois",
            value: month.contactsReached,
            delta: pctDelta(month.contactsReached, month.previousMonth?.contactsReached),
            hint: `${month.qualified} qualifié${month.qualified > 1 ? "s" : ""}`,
        },
        {
            label: "Transformation",
            value: funnel.reachToMeeting,
            suffix: " %",
            delta: null,
            hint: "Prospects contactés → RDV",
        },
    ];

    return (
        <div className={cn("grid grid-cols-2 gap-3 md:gap-4", printMode ? "lg:grid-cols-4" : "lg:grid-cols-4")}>
            {tiles.map((tile) => (
                <ArtifactCard key={tile.label} className="p-4 md:p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--elan-slate)] leading-tight">
                        {tile.label}
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                        <span className="text-3xl md:text-[2.1rem] leading-none font-bold text-[var(--elan-ink)] tabular-nums">
                            {printMode ? tile.value.toLocaleString("fr-FR") : <AnimatedNumber value={tile.value} />}
                            {tile.suffix}
                        </span>
                        <DeltaPill value={tile.delta} className="mb-1" />
                    </div>
                    <p className="mt-2 text-xs text-[var(--elan-slate)]">{tile.hint}</p>
                </ArtifactCard>
            ))}
        </div>
    );
}

// ============================================
// Objective gauge — where the month stands, honestly
// ============================================

export function ObjectiveGauge({ metrics }: { metrics: ClientDailyMetrics }) {
    const { month } = metrics;
    const reached = month.meetings >= month.objective;
    const remaining = Math.max(0, month.objective - month.meetings);
    const daysLeft = Math.max(0, month.businessDaysTotal - month.businessDaysElapsed);

    return (
        <ArtifactCard>
            <SectionTitle
                icon={<Target className="w-4 h-4" />}
                title="Objectif du mois"
                subtitle={`${month.label} · ${month.businessDaysElapsed} jour${month.businessDaysElapsed > 1 ? "s" : ""} ouvré${month.businessDaysElapsed > 1 ? "s" : ""} sur ${month.businessDaysTotal}`}
            />

            <div className="flex items-end justify-between gap-4 mb-3">
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-[var(--elan-ink)] tabular-nums">
                        {month.meetings}
                    </span>
                    <span className="text-sm text-[var(--elan-slate)]">/ {month.objective} RDV</span>
                </div>
                <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full border"
                    style={
                        reached
                            ? {
                                  color: "var(--elan-success)",
                                  borderColor: "rgba(35,125,99,0.28)",
                                  background: "rgba(35,125,99,0.08)",
                              }
                            : {
                                  color: "var(--elan-amber-deep)",
                                  borderColor: "rgba(40,144,248,0.28)",
                                  background: "rgba(40,144,248,0.08)",
                              }
                    }
                >
                    {month.objectiveProgressPct} %
                </span>
            </div>

            <ProgressBar value={month.meetings} max={month.objective} height="md" />

            <div className="mt-5 grid grid-cols-2 gap-4 pt-4 border-t border-[var(--elan-line)]">
                <div>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--elan-slate)] font-semibold">
                        Projection fin de mois
                    </p>
                    <p className="mt-1 text-lg font-bold text-[var(--elan-ink)] tabular-nums">
                        {month.projectedMeetings} RDV
                    </p>
                    <p className="text-xs text-[var(--elan-slate)]">Au rythme actuel</p>
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--elan-slate)] font-semibold">
                        {reached ? "Objectif atteint" : "Restant"}
                    </p>
                    <p className="mt-1 text-lg font-bold text-[var(--elan-ink)] tabular-nums">
                        {reached ? "✓" : `${remaining} RDV`}
                    </p>
                    <p className="text-xs text-[var(--elan-slate)]">
                        {daysLeft} jour{daysLeft > 1 ? "s" : ""} ouvré{daysLeft > 1 ? "s" : ""} restant
                        {daysLeft > 1 ? "s" : ""}
                    </p>
                </div>
            </div>
        </ArtifactCard>
    );
}

// ============================================
// 90-day trend
// ============================================

export function TrendChart({ metrics, printMode }: { metrics: ClientDailyMetrics; printMode?: boolean }) {
    const data = useMemo(
        () => metrics.trend.map((point) => ({ name: point.label, RDV: point.meetings, Actions: point.actions })),
        [metrics.trend]
    );

    if (data.length === 0) return null;
    const hasActivity = data.some((point) => point.RDV > 0 || point.Actions > 0);
    if (!hasActivity) return null;

    return (
        <ArtifactCard>
            <SectionTitle
                icon={<Activity className="w-4 h-4" />}
                title="Tendance"
                subtitle="RDV décrochés par semaine, 90 derniers jours"
            />
            <div className="h-52 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="rdvTrend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--elan-amber)" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="var(--elan-amber)" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--elan-line)" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "var(--elan-slate)" }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            allowDecimals={false}
                            width={28}
                            tick={{ fontSize: 11, fill: "var(--elan-slate)" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ stroke: "var(--elan-line-strong)" }}
                            contentStyle={{
                                borderRadius: 12,
                                border: "1px solid var(--elan-line)",
                                background: "var(--elan-surface)",
                                fontSize: 12,
                                boxShadow: "var(--elan-shadow-sm)",
                            }}
                            labelStyle={{ color: "var(--elan-slate)" }}
                        />
                        <Area
                            type="monotone"
                            dataKey="RDV"
                            stroke="var(--elan-amber)"
                            strokeWidth={2}
                            fill="url(#rdvTrend)"
                            isAnimationActive={!printMode}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </ArtifactCard>
    );
}

// ============================================
// Funnel — month to date
// ============================================

export function FunnelArtifact({ metrics }: { metrics: ClientDailyMetrics }) {
    const { funnel, month } = metrics;
    const steps = [
        { label: "Prospection réalisée", value: funnel.actions },
        { label: "Prospects contactés", value: funnel.contactsReached },
        { label: "Contacts qualifiés", value: funnel.qualified },
        { label: "Rendez-vous", value: funnel.meetings },
        { label: "Opportunités", value: funnel.opportunities },
    ].filter((step, index) => index < 4 || step.value > 0);

    const max = Math.max(...steps.map((step) => step.value), 1);
    if (funnel.actions === 0) return null;

    return (
        <ArtifactCard>
            <SectionTitle
                icon={<Filter className="w-4 h-4" />}
                title="Conversion de la prospection"
                subtitle={`${month.label} · du premier contact au rendez-vous`}
            />
            <div className="space-y-3">
                {steps.map((step, index) => {
                    const previous = index > 0 ? steps[index - 1].value : null;
                    const conversion = previous && previous > 0 ? (step.value / previous) * 100 : null;
                    return (
                        <div key={step.label}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                                <span className="text-[var(--elan-ink)] font-medium">{step.label}</span>
                                <span className="flex items-center gap-2">
                                    {conversion != null && (
                                        <span className="text-xs text-[var(--elan-slate)] tabular-nums">
                                            {formatPct(conversion)}
                                        </span>
                                    )}
                                    <span className="font-bold text-[var(--elan-ink)] tabular-nums">
                                        {step.value.toLocaleString("fr-FR")}
                                    </span>
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--elan-paper-2)] overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${Math.max(2, (step.value / max) * 100)}%`,
                                        background:
                                            index === steps.length - 1
                                                ? "var(--elan-success)"
                                                : "var(--elan-amber)",
                                        opacity: 1 - index * 0.14,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </ArtifactCard>
    );
}

// ============================================
// Result breakdown + channel mix
// ============================================

export function ActivityBreakdown({ metrics }: { metrics: ClientDailyMetrics }) {
    const { resultBreakdown, channelMix, month } = metrics;
    if (resultBreakdown.length === 0) return null;
    const max = Math.max(...resultBreakdown.map((row) => row.count), 1);

    const feedbackInsight = calculateProspectFeedbackInsight({
        resultBreakdown,
        totalActions: month.actions,
    });

    return (
        <ArtifactCard>
            <SectionTitle
                icon={<BarChart3 className="w-4 h-4" />}
                title="Retours des prospects"
                subtitle={`Issues des ${month.actions.toLocaleString("fr-FR")} actions de prospection de ${month.label}`}
            />

            {channelMix.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                    {channelMix.map((entry) => (
                        <span
                            key={entry.channel}
                            className="text-xs font-medium px-2.5 py-1 rounded-full border border-[var(--elan-line)] bg-[var(--elan-paper)] text-[var(--elan-ink-soft)]"
                        >
                            {CHANNEL_LABELS[entry.channel] ?? entry.channel} ·{" "}
                            {entry.count.toLocaleString("fr-FR")}
                        </span>
                    ))}
                </div>
            )}

            <div className="space-y-2.5">
                {resultBreakdown.map((row) => (
                    <div key={row.result} className="flex items-center gap-3">
                        <span className="text-sm text-[var(--elan-ink)] w-44 shrink-0 truncate" title={row.label}>
                            {row.label}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--elan-paper-2)] overflow-hidden">
                            <div
                                className="h-full rounded-full bg-[var(--elan-ink-soft)]"
                                style={{ width: `${(row.count / max) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-[var(--elan-slate)] tabular-nums w-20 text-right">
                            {row.count.toLocaleString("fr-FR")} · {row.share} %
                        </span>
                    </div>
                ))}
            </div>

            {feedbackInsight.hasEnoughData && (
                <div className="mt-5 pt-4 border-t border-[var(--elan-line)] flex items-start gap-3 rounded-xl bg-[var(--elan-paper-2)]/60 p-3.5">
                    <div className="w-6 h-6 rounded-full bg-[var(--elan-amber)]/10 text-[var(--elan-amber-deep)] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--elan-ink)]">
                            Insight de marché
                        </p>
                        <p className="text-xs text-[var(--elan-ink-soft)] mt-0.5 leading-relaxed">
                            {feedbackInsight.insight}
                        </p>
                    </div>
                </div>
            )}
        </ArtifactCard>
    );
}
