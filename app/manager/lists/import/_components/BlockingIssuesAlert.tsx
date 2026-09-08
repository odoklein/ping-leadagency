"use client";

import { AlertCircle, AlertTriangle, ArrowRight, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";

export interface BlockingIssue {
    id: string;
    title: string;
    description: string;
    resolution?: string;
    actionLabel?: string;
    onAction?: () => void;
}

interface BlockingIssuesAlertProps {
    title?: string;
    errors: string[] | BlockingIssue[];
    warnings?: string[];
    onFixAi?: () => void;
    className?: string;
}

export function BlockingIssuesAlert({
    title = "Impossible de continuer : éléments bloquants détectés",
    errors,
    warnings = [],
    onFixAi,
    className = "",
}: BlockingIssuesAlertProps) {
    if (errors.length === 0 && warnings.length === 0) return null;

    const normalizedErrors: BlockingIssue[] = errors.map((err, idx) => {
        if (typeof err === "string") {
            let resolution = "Complétez le champ manquant pour valider cette étape.";
            if (err.toLowerCase().includes("nom de société") || err.toLowerCase().includes("company.name")) {
                resolution = "Associez la colonne contenant la raison sociale de l'entreprise au champ 'Nom de société'.";
            } else if (err.toLowerCase().includes("fichier")) {
                resolution = "Déposez un fichier CSV valide comportant au moins une colonne et une ligne de données.";
            } else if (err.toLowerCase().includes("mission")) {
                resolution = "Sélectionnez une mission commerciale dans le menu déroulant.";
            } else if (err.toLowerCase().includes("liste")) {
                resolution = "Indiquez le nom de la liste ou choisissez une liste existante.";
            } else if (err.toLowerCase().includes("sdr")) {
                resolution = "Choisissez un SDR responsable de l'historique d'actions.";
            } else if (err.toLowerCase().includes("statut")) {
                resolution = "Mappez chaque statut CSV de vos actions avec un statut d'appel CRM.";
            }

            return {
                id: `err-${idx}`,
                title: err,
                description: err,
                resolution,
            };
        }
        return err;
    });

    return (
        <div className={`rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm space-y-3 transition-all animate-in fade-in-50 duration-300 ${className}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm flex-shrink-0">
                        <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-rose-900">{title}</h3>
                        <p className="text-xs text-rose-700">
                            {normalizedErrors.length > 0
                                ? `${normalizedErrors.length} point${normalizedErrors.length > 1 ? "s" : ""} bloquant${normalizedErrors.length > 1 ? "s" : ""} à corriger pour passer à l'étape suivante.`
                                : "Avertissements à vérifier avant validation."}
                        </p>
                    </div>
                </div>

                {onFixAi && (
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={onFixAi}
                        className="text-xs gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xs"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Résoudre avec l&apos;IA</span>
                    </Button>
                )}
            </div>

            {/* List of Blocking Errors */}
            {normalizedErrors.length > 0 && (
                <div className="space-y-2">
                    {normalizedErrors.map((issue) => (
                        <div
                            key={issue.id}
                            className="rounded-xl border border-rose-200/80 bg-white p-3 shadow-2xs space-y-1 text-xs"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 font-semibold text-rose-800">
                                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                    <span>{issue.title}</span>
                                </div>
                                {issue.onAction && issue.actionLabel && (
                                    <button
                                        type="button"
                                        onClick={issue.onAction}
                                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                                    >
                                        <span>{issue.actionLabel}</span>
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            {issue.resolution && (
                                <p className="text-slate-600 text-[11px] pl-6">
                                    💡 <strong>Solution :</strong> {issue.resolution}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Non-Blocking Warnings */}
            {warnings.length > 0 && (
                <div className="pt-2 border-t border-rose-200/60">
                    <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Avertissements non bloquants ({warnings.length})</span>
                    </p>
                    <ul className="space-y-1 text-xs text-amber-900/90 pl-5 list-disc">
                        {warnings.map((w, idx) => (
                            <li key={`warn-${idx}`} className="text-[11px]">
                                {w}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
