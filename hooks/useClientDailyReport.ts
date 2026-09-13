"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientDailyReportPayload } from "@/lib/reporting/client-daily/types";

/**
 * Drives the client daily report.
 *
 * Generation is lazy: the first visit of the day triggers it. The metrics come
 * back immediately so the charts render at once, while the narrative is being
 * written; if another tab already claimed the generation we poll instead of
 * paying for a second one.
 */

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

export interface UseClientDailyReportOptions {
    /** Archived day (yyyy-MM-dd). Omit for today. */
    date?: string | null;
    /** Never trigger generation — used by read-only views. */
    readOnly?: boolean;
}

export interface UseClientDailyReportResult {
    payload: ClientDailyReportPayload | null;
    isLoading: boolean;
    isGenerating: boolean;
    error: string | null;
    /** Re-run today's report against the latest data. */
    refresh: () => Promise<void>;
    isRefreshing: boolean;
}

export function useClientDailyReport(
    options: UseClientDailyReportOptions = {}
): UseClientDailyReportResult {
    const { date = null, readOnly = false } = options;
    const [payload, setPayload] = useState<ClientDailyReportPayload | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cancelledRef = useRef(false);

    const fetchReport = useCallback(async (targetDate: string | null) => {
        const query = targetDate ? `?date=${encodeURIComponent(targetDate)}` : "";
        const res = await fetch(`/api/client/reporting/daily${query}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json?.error || "Impossible de charger le rapport");
        }
        return json.data as ClientDailyReportPayload;
    }, []);

    const generate = useCallback(async (force: boolean) => {
        const res = await fetch("/api/client/reporting/daily/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json?.error || "Impossible de générer le rapport");
        }
        return json.data as ClientDailyReportPayload & { inFlight?: boolean };
    }, []);

    /** Another tab is generating: poll until its report lands. */
    const pollUntilReady = useCallback(async () => {
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        while (!cancelledRef.current && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            if (cancelledRef.current) return;
            const next = await fetchReport(null).catch(() => null);
            if (next && (next.status === "completed" || next.status === "fallback")) {
                setPayload(next);
                return;
            }
        }
    }, [fetchReport]);

    useEffect(() => {
        cancelledRef.current = false;
        setIsLoading(true);
        setError(null);

        (async () => {
            try {
                const initial = await fetchReport(date);
                if (cancelledRef.current) return;
                setPayload(initial);
                setIsLoading(false);

                const needsGeneration =
                    !readOnly && !date && (initial.status === "absent" || initial.status === "pending");
                if (!needsGeneration) return;

                setIsGenerating(true);
                const generated = await generate(false);
                if (cancelledRef.current) return;

                if (generated.inFlight) {
                    await pollUntilReady();
                } else {
                    setPayload(generated);
                }
            } catch (caught) {
                if (cancelledRef.current) return;
                setError(caught instanceof Error ? caught.message : "Erreur inconnue");
                setIsLoading(false);
            } finally {
                if (!cancelledRef.current) setIsGenerating(false);
            }
        })();

        return () => {
            cancelledRef.current = true;
        };
    }, [date, readOnly, fetchReport, generate, pollUntilReady]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        setIsGenerating(true);
        setError(null);
        try {
            const refreshed = await generate(true);
            if (!cancelledRef.current) setPayload(refreshed);
        } catch (caught) {
            if (!cancelledRef.current) {
                setError(caught instanceof Error ? caught.message : "Erreur inconnue");
            }
        } finally {
            if (!cancelledRef.current) {
                setIsGenerating(false);
                setIsRefreshing(false);
            }
        }
    }, [generate]);

    return { payload, isLoading, isGenerating, error, refresh, isRefreshing };
}
