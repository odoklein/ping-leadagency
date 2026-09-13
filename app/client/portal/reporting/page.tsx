"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2, RefreshCw, Share2, Sparkles } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { ReportingSkeleton } from "@/components/client/skeletons";
import { ReportDocument } from "@/components/reporting/artifacts/ReportDocument";
import { useClientDailyReport } from "@/hooks/useClientDailyReport";
import { trackEvent, UMAMI_EVENTS } from "@/lib/analytics/umami";

interface HistoryEntry {
    reportDate: string;
    status: string;
    headline: string;
    generatedAt: string;
}

/** Today in Europe/Paris, yyyy-MM-dd — matches how reports are dated server-side. */
function parisToday(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function formatArchiveLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "long",
    });
}

export default function ClientPortalReportingPage() {
    const toast = useToast();
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const [todayReportDate] = useState(parisToday);

    const { payload, isLoading, isGenerating, error, refresh, isRefreshing } = useClientDailyReport({
        date: selectedDate,
    });

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/client/reporting/daily/history?limit=30");
                const json = await res.json();
                if (json.success) setHistory(json.data ?? []);
            } catch {
                // The archive rail is a convenience; its absence must not break the page.
            }
        })();
    }, [payload?.generatedAt]);

    const viewedReportDate = payload?.reportDate;
    useEffect(() => {
        if (viewedReportDate) trackEvent(UMAMI_EVENTS.REPORT_VIEWED, { reportDate: viewedReportDate });
    }, [viewedReportDate]);

    const handleDownload = useCallback(() => {
        if (!payload) return;
        const params = payload.isArchive ? `?date=${encodeURIComponent(payload.reportDate)}` : "";
        window.open(`/client/portal/reporting/print${params}`, "_blank", "noopener");
    }, [payload]);

    const handleRefresh = useCallback(async () => {
        await refresh();
        toast.success("Rapport actualisé", "Les chiffres et l'analyse viennent d'être recalculés.");
    }, [refresh, toast]);

    /** Shareable link on the current month — same backend as before the redesign. */
    const handleShare = useCallback(async () => {
        setIsSharing(true);
        try {
            const now = new Date();
            const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
            const res = await fetch("/api/client/reporting/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dateFrom, dateTo }),
            });
            const json = await res.json();
            if (!json.success || !json.data?.url) throw new Error(json.error || "Erreur");
            await navigator.clipboard.writeText(json.data.url);
            toast.success("Lien copié", "Valable 30 jours. Collez-le dans un email.");
        } catch {
            toast.error("Erreur", "Impossible de générer le lien de partage");
        } finally {
            setIsSharing(false);
        }
    }, [toast]);

    if (isLoading && !payload) return <ReportingSkeleton />;

    return (
        <div className="min-h-full bg-[var(--elan-paper)] p-4 md:p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--elan-ink)] tracking-tight">Rapports</h1>
                        <p className="text-sm text-[var(--elan-slate)] mt-1">
                            Votre activité de prospection, analysée et mise à jour chaque jour.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {history.length > 0 && (
                            <select
                                value={selectedDate ?? ""}
                                onChange={(event) => setSelectedDate(event.target.value || null)}
                                className="h-9 rounded-xl border border-[var(--elan-line)] bg-[var(--elan-surface)] px-3 text-sm text-[var(--elan-ink)] focus:outline-none focus:border-[var(--elan-amber)]"
                                aria-label="Choisir un rapport"
                            >
                                <option value="">Aujourd&apos;hui</option>
                                {history
                                    // Today already has its own option above.
                                    .filter((entry) => entry.reportDate !== todayReportDate)
                                    .map((entry) => (
                                        <option key={entry.reportDate} value={entry.reportDate}>
                                            {formatArchiveLabel(entry.reportDate)}
                                        </option>
                                    ))}
                            </select>
                        )}

                        {!selectedDate && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 rounded-xl"
                                onClick={handleRefresh}
                                disabled={isRefreshing || isGenerating}
                            >
                                {isRefreshing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                )}
                                Actualiser
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 rounded-xl"
                            onClick={handleShare}
                            disabled={isSharing}
                        >
                            {isSharing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Share2 className="w-3.5 h-3.5" />
                            )}
                            Partager
                        </Button>

                        <Button
                            size="sm"
                            className="gap-2 rounded-xl"
                            onClick={handleDownload}
                            disabled={!payload || isGenerating}
                        >
                            <FileDown className="w-3.5 h-3.5" />
                            Télécharger
                        </Button>
                    </div>
                </div>

                {/* Generation banner — the figures below are already live */}
                {isGenerating && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(40,144,248,0.25)] bg-[rgba(40,144,248,0.06)] px-4 py-3 text-sm text-[var(--elan-amber-deep)]">
                        <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
                        <span>
                            Rédaction de votre analyse en cours — vos chiffres sont déjà à jour ci-dessous.
                        </span>
                    </div>
                )}

                {error && !payload && (
                    <div className="rounded-2xl border border-[var(--elan-line)] bg-[var(--elan-surface)] p-6 text-center">
                        <p className="text-sm text-[var(--elan-ink)] font-medium">
                            Impossible de charger votre rapport
                        </p>
                        <p className="text-sm text-[var(--elan-slate)] mt-1">{error}</p>
                    </div>
                )}

                {payload && (
                    <div className="animate-fade-up" style={{ animationDelay: "40ms" }}>
                        <ReportDocument payload={payload} isGenerating={isGenerating} />
                    </div>
                )}
            </div>
        </div>
    );
}
