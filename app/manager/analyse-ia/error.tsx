"use client";

import { useEffect } from "react";
import { XCircle, RotateCcw } from "lucide-react";

// Segment-level error boundary — catches render-time crashes on this page
// (e.g. an unexpected shape slipping through from a past analysis) without
// tearing down the surrounding manager layout/sidebar the way the root
// global-error.tsx would.
export default function AnalyseIAError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Analyse IA — erreur de rendu:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] px-6">
            <div className="w-full max-w-md bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
                <XCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-rose-700 mb-1">
                    L&apos;affichage de l&apos;analyse a rencontré un problème
                </p>
                <p className="text-xs text-rose-500">
                    {error.message || "Erreur inattendue lors de l'affichage."}
                </p>
                <button
                    onClick={reset}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Réessayer
                </button>
            </div>
        </div>
    );
}
