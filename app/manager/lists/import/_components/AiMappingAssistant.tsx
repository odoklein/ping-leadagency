"use client";

import { useState } from "react";
import { Button, Badge, useToast } from "@/components/ui";
import {
    Sparkles,
    Bot,
    Wand2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Zap,
    ChevronDown,
    ChevronUp,
    Check,
} from "lucide-react";
import type { AiMappingSuggestion, AiMappingResponse } from "@/app/api/lists/import/ai-mapping/route";

interface AiMappingAssistantProps {
    headers: string[];
    sampleRows: Record<string, string>[];
    importType: "companies-only" | "companies-contacts";
    onApplySuggestions: (suggestions: AiMappingSuggestion[]) => void;
    onApplyActionSuggestions?: (actions: { statusColumn?: string; dateColumn?: string; noteColumn?: string }) => void;
}

export function AiMappingAssistant({
    headers,
    sampleRows,
    importType,
    onApplySuggestions,
    onApplyActionSuggestions,
}: AiMappingAssistantProps) {
    const { success, error: showError } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState<AiMappingResponse | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [applied, setApplied] = useState(false);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setApplied(false);

        try {
            const res = await fetch("/api/lists/import/ai-mapping", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    headers,
                    sampleRows,
                    importType,
                }),
            });

            const data = (await res.json()) as AiMappingResponse;
            if (!res.ok || !data.success) {
                showError("Erreur IA", "L'analyse IA n'a pas pu aboutir");
                return;
            }

            setAiResult(data);
            setIsExpanded(true);
            success("Analyse IA terminée", `${data.suggestions.filter((s) => s.targetField).length} colonnes mappées`);
        } catch (err) {
            console.error("AI mapping failed:", err);
            showError("Erreur", "Impossible de contacter l'assistant IA");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApplyAll = () => {
        if (!aiResult) return;
        onApplySuggestions(aiResult.suggestions);
        if (aiResult.actionSuggestions && onApplyActionSuggestions) {
            onApplyActionSuggestions(aiResult.actionSuggestions);
        }
        setApplied(true);
        success("Suggestions appliquées", "Le mapping recommandé par l'IA a été appliqué");
    };

    const highConfidenceCount = aiResult?.suggestions.filter((s) => s.targetField && s.confidence >= 80).length ?? 0;
    const customCount = aiResult?.suggestions.filter((s) => s.isCustomField).length ?? 0;

    return (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-pink-50/40 p-4 shadow-sm transition-all duration-300">
            {/* Ambient Background Glow Effect */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-400/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-purple-400/10 blur-2xl" />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md shadow-indigo-500/20">
                        {isAnalyzing ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Bot className="h-5 w-5 animate-pulse" />
                        )}
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75"></span>
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pink-500"></span>
                        </span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">Assistant IA de Mapping</h3>
                            <Badge variant="primary" className="bg-indigo-100 text-[10px] text-indigo-700 font-semibold border-indigo-200">
                                Ping AI
                            </Badge>
                            {aiResult && (
                                <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">
                                    {aiResult.provider.toUpperCase()}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-slate-600">
                            {aiResult
                                ? aiResult.overview
                                : "L'IA inspecte les noms de colonnes et le contenu réel pour recommander le mapping optimal."}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!aiResult ? (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="gap-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white shadow-md shadow-purple-500/20 transition-all duration-300 hover:scale-[1.02]"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Analyse en cours…</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    <span>Analyser avec l&apos;IA</span>
                                </>
                            )}
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="h-8 text-xs gap-1.5 bg-white/80 hover:bg-white"
                            >
                                <Wand2 className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Réanalyser</span>
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleApplyAll}
                                className={`h-8 text-xs gap-1.5 transition-all ${
                                    applied
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                }`}
                            >
                                {applied ? (
                                    <>
                                        <Check className="h-3.5 w-3.5" />
                                        <span>Appliqué !</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-3.5 w-3.5 text-amber-300" />
                                        <span>Appliquer les suggestions</span>
                                    </>
                                )}
                            </Button>
                            <button
                                type="button"
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
                            >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scanning radar animation while loading */}
            {isAnalyzing && (
                <div className="mt-4 overflow-hidden rounded-xl border border-indigo-100 bg-white/60 p-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Sparkles className="h-4 w-4 animate-spin text-indigo-500" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between text-xs font-medium text-indigo-900 mb-1">
                                <span>Inspection sémantique des colonnes & des valeurs…</span>
                                <span className="animate-pulse">En cours</span>
                            </div>
                            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-[shimmer_1.5s_infinite] -translate-x-full" style={{ animation: "shimmer 1.5s infinite" }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Expanded AI Recommendations Details */}
            {aiResult && isExpanded && !isAnalyzing && (
                <div className="mt-4 space-y-3 pt-3 border-t border-indigo-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-white/80 border border-slate-200/80 p-2.5 flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                {highConfidenceCount}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">Haute confiance</p>
                                <p className="text-[11px] text-slate-500">&gt;80% de certitude</p>
                            </div>
                        </div>
                        <div className="rounded-xl bg-white/80 border border-slate-200/80 p-2.5 flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                {customCount}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">Champs personnalisés</p>
                                <p className="text-[11px] text-slate-500">Détectés & enrichis</p>
                            </div>
                        </div>
                        <div className="rounded-xl bg-white/80 border border-slate-200/80 p-2.5 flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                🎯
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900 truncate">{aiResult.detectedType}</p>
                                <p className="text-[11px] text-slate-500">Modèle de données</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white/90 border border-slate-200/90 overflow-hidden shadow-xs">
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                            {aiResult.suggestions
                                .filter((s) => s.targetField)
                                .map((s) => (
                                    <div key={s.csvColumn} className="flex items-center justify-between p-2.5 hover:bg-slate-50/80 transition-colors">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-semibold text-slate-800 truncate">{s.csvColumn}</span>
                                            <span className="text-slate-400">→</span>
                                            <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                                                {s.targetField}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-[11px] text-slate-500 hidden md:inline truncate max-w-[200px]" title={s.reasoning}>
                                                {s.reasoning}
                                            </span>
                                            <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    s.confidence >= 85
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : s.confidence >= 65
                                                        ? "bg-indigo-100 text-indigo-800"
                                                        : "bg-amber-100 text-amber-800"
                                                }`}
                                            >
                                                {s.confidence}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
