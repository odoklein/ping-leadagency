"use client";

import { Clock, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientDailyMetrics, ClientReportNarrative } from "@/lib/reporting/client-daily/types";
import { AiBadge, NarrativeSkeleton, formatTime } from "./primitives";

const MOMENTUM_ICON = {
    UP: TrendingUp,
    DOWN: TrendingDown,
    STABLE: Minus,
} as const;

interface ReportHeroProps {
    metrics: ClientDailyMetrics;
    narrative: ClientReportNarrative | null;
    /** True while the narrative is still being written. */
    isGenerating: boolean;
    /** Deterministic summary (no model) — badge says so. */
    isFallback: boolean;
    generatedAt: string | null;
    printMode?: boolean;
}

export function ReportHero({
    metrics,
    narrative,
    isGenerating,
    isFallback,
    generatedAt,
    printMode,
}: ReportHeroProps) {
    const MomentumIcon = MOMENTUM_ICON[narrative?.momentum.direction ?? "STABLE"];

    return (
        <section
            className={cn(
                "relative overflow-hidden break-inside-avoid",
                printMode
                    ? "border-b border-[var(--elan-ink)] pb-6"
                    : "rounded-2xl border border-[var(--elan-line)] shadow-[var(--elan-shadow-sm)]"
            )}
            style={printMode ? undefined : { background: "var(--elan-petrol)" }}
        >
            {!printMode && (
                <div
                    className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full"
                    style={{ background: "radial-gradient(circle, rgba(40,144,248,0.28) 0%, transparent 70%)" }}
                />
            )}

            <div className={cn("relative", printMode ? "" : "px-6 md:px-8 py-7 md:py-9")}>
                <div className="flex flex-wrap items-center gap-2.5 mb-4">
                    <span
                        className={cn(
                            "text-[11px] font-bold uppercase tracking-[0.14em]",
                            printMode ? "text-[var(--elan-slate)]" : "text-white/55"
                        )}
                    >
                        Rapport du {metrics.reportDateLabel}
                    </span>
                    {!isGenerating && (isFallback ? <FallbackBadge printMode={printMode} /> : <AiBadge />)}
                </div>

                {isGenerating && !narrative ? (
                    <NarrativeSkeleton lines={2} className="max-w-2xl" />
                ) : (
                    <h1
                        className={cn(
                            "font-display text-2xl md:text-[2rem] leading-[1.15] font-bold tracking-tight max-w-3xl",
                            printMode ? "text-[var(--elan-ink)]" : "text-white"
                        )}
                    >
                        {narrative?.headline || `Activité de prospection — ${metrics.client.name}`}
                    </h1>
                )}

                {narrative?.momentum.comment && (
                    <p
                        className={cn(
                            "mt-3 inline-flex items-center gap-2 text-sm",
                            printMode ? "text-[var(--elan-slate)]" : "text-white/70"
                        )}
                    >
                        <MomentumIcon className="w-4 h-4 shrink-0" />
                        {narrative.momentum.comment}
                    </p>
                )}

                <div
                    className={cn(
                        "mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs",
                        printMode ? "text-[var(--elan-slate)]" : "text-white/50"
                    )}
                >
                    <span>{metrics.client.name}</span>
                    <span>{metrics.brief.label} · {metrics.brief.rangeLabel}</span>
                    {generatedAt && (
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            Mis à jour à {formatTime(generatedAt)}
                        </span>
                    )}
                </div>
            </div>
        </section>
    );
}

function FallbackBadge({ printMode }: { printMode?: boolean }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
                printMode
                    ? "border-[var(--elan-line-strong)] text-[var(--elan-slate)]"
                    : "border-white/20 text-white/70"
            )}
        >
            Synthèse automatique
        </span>
    );
}
