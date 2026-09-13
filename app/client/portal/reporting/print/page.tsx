"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { ReportDocument } from "@/components/reporting/artifacts/ReportDocument";
import { useClientDailyReport } from "@/hooks/useClientDailyReport";

/**
 * Print sheet for the daily report.
 * URL: /client/portal/reporting/print?date=YYYY-MM-DD (omit date for today)
 *
 * Renders the exact same artifacts as the portal in printMode, then opens the
 * browser print dialog: what the client saves as PDF is what they read on
 * screen — which is the whole point of dropping the hand-drawn pdfkit layout.
 */
function PrintContent() {
    const searchParams = useSearchParams();
    const date = searchParams.get("date");
    const { payload, isLoading, isGenerating, error } = useClientDailyReport({ date });
    const hasPrinted = useRef(false);

    useEffect(() => {
        if (hasPrinted.current) return;
        if (isLoading || isGenerating || !payload) return;
        hasPrinted.current = true;
        // Let fonts, charts and images settle before handing over to the dialog.
        const timer = setTimeout(() => window.print(), 900);
        return () => clearTimeout(timer);
    }, [isLoading, isGenerating, payload]);

    if (error && !payload) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-8">
                <p className="text-sm text-[var(--elan-slate)]">{error}</p>
            </div>
        );
    }

    if (!payload) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white p-8">
                <Loader2 className="w-7 h-7 animate-spin text-[var(--elan-amber)]" />
                <p className="text-sm text-[var(--elan-slate)]">
                    {isGenerating ? "Rédaction de votre analyse…" : "Préparation du rapport…"}
                </p>
            </div>
        );
    }

    const { metrics } = payload;

    return (
        <div className="report-print-shell min-h-screen bg-white p-6 md:p-10">
            <div className="max-w-3xl mx-auto">
                {/* Cover band */}
                <header className="flex items-start justify-between gap-6 pb-6 mb-8 border-b border-[var(--elan-line-strong)] break-inside-avoid">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--elan-slate)]">
                            Rapport d&apos;activité
                        </p>
                        <h1 className="font-display text-xl font-bold text-[var(--elan-ink)] mt-1">
                            {metrics.client.name}
                        </h1>
                        <p className="text-xs text-[var(--elan-slate)] mt-1">
                            {metrics.reportDateLabel} · {metrics.brief.rangeLabel}
                        </p>
                    </div>
                    {metrics.client.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={metrics.client.logo}
                            alt={metrics.client.name}
                            className="h-10 w-auto object-contain shrink-0"
                        />
                    )}
                </header>

                <ReportDocument payload={payload} isGenerating={false} printMode />

                <footer className="mt-10 pt-5 border-t border-[var(--elan-line)] text-[11px] text-[var(--elan-slate)] flex justify-between">
                    <span>{metrics.client.name} — rapport du {metrics.reportDateLabel}</span>
                    <span>
                        {payload.status === "fallback"
                            ? "Synthèse automatique"
                            : "Analyse générée par IA sur vos données"}
                    </span>
                </footer>

                <div className="mt-8 flex justify-center">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--elan-line)] bg-[var(--elan-surface)] px-4 py-2 text-sm font-semibold text-[var(--elan-ink)] hover:border-[var(--elan-line-strong)] transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimer / Enregistrer en PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ReportPrintPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <Loader2 className="w-7 h-7 animate-spin text-[var(--elan-amber)]" />
                </div>
            }
        >
            <PrintContent />
        </Suspense>
    );
}
