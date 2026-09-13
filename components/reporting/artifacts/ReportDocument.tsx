"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientDailyReportPayload } from "@/lib/reporting/client-daily/types";
import { ReportHero } from "./ReportHero";
import {
    ActivityBreakdown,
    FunnelArtifact,
    KpiRow,
    ObjectiveGauge,
    TrendChart,
} from "./MetricsArtifacts";
import {
    ExecutiveSummary,
    HighlightsGrid,
    NextStepsCard,
    WatchoutsList,
} from "./NarrativeArtifacts";
import { RdvTimeline, UpcomingMeetings } from "./RdvArtifacts";
import { SessionsRecap } from "./SessionsRecap";

interface ReportDocumentProps {
    payload: ClientDailyReportPayload;
    /** The narrative is still being written — text blocks shimmer. */
    isGenerating: boolean;
    printMode?: boolean;
    showSessions?: boolean;
}

/**
 * The report itself — one component rendered both on screen and in the print
 * view, so what the client downloads is exactly what they read.
 */
export function ReportDocument({
    payload,
    isGenerating,
    printMode,
    showSessions = true,
}: ReportDocumentProps) {
    const { metrics, narrative, status, generatedAt } = payload;

    if (metrics.missions.length === 0) {
        return (
            <div className="text-center py-16 rounded-2xl border border-[var(--elan-line)] bg-[var(--elan-surface)]">
                <div className="w-14 h-14 rounded-2xl bg-[var(--elan-paper-2)] flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-6 h-6 text-[var(--elan-slate)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--elan-ink)] mb-1">
                    Votre rapport arrive bientôt
                </h3>
                <p className="text-sm text-[var(--elan-slate)] max-w-sm mx-auto">
                    Dès que votre mission de prospection démarre, vous retrouverez ici un rapport
                    complet, mis à jour chaque jour.
                </p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-8", printMode && "space-y-7")}>
            <ReportHero
                metrics={metrics}
                narrative={narrative}
                isGenerating={isGenerating}
                isFallback={status === "fallback"}
                generatedAt={generatedAt}
                printMode={printMode}
            />

            <KpiRow metrics={metrics} printMode={printMode} />

            <ExecutiveSummary narrative={narrative} isGenerating={isGenerating} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ObjectiveGauge metrics={metrics} />
                <TrendChart metrics={metrics} printMode={printMode} />
            </div>

            <HighlightsGrid narrative={narrative} isGenerating={isGenerating} />

            <RdvTimeline metrics={metrics} narrative={narrative} isGenerating={isGenerating} />

            <WatchoutsList narrative={narrative} isGenerating={isGenerating} />

            <div className={cn("grid grid-cols-1 gap-4", !printMode && "lg:grid-cols-2")}>
                <FunnelArtifact metrics={metrics} />
                <ActivityBreakdown metrics={metrics} />
            </div>

            <NextStepsCard narrative={narrative} isGenerating={isGenerating} />

            <UpcomingMeetings metrics={metrics} />

            {showSessions && <SessionsRecap printMode={printMode} />}
        </div>
    );
}
