"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, ListChecks, Quote } from "lucide-react";
import type { ClientReportNarrative } from "@/lib/reporting/client-daily/types";
import { ArtifactCard, NarrativeSkeleton, SectionTitle } from "./primitives";

interface NarrativeProps {
    narrative: ClientReportNarrative | null;
    isGenerating: boolean;
}

const SEVERITY_STYLE: Record<string, { color: string; background: string; border: string }> = {
    HIGH: {
        color: "var(--elan-danger)",
        background: "rgba(185,67,62,0.07)",
        border: "rgba(185,67,62,0.25)",
    },
    MEDIUM: {
        color: "var(--elan-amber-deep)",
        background: "rgba(40,144,248,0.07)",
        border: "rgba(40,144,248,0.25)",
    },
    LOW: {
        color: "var(--elan-slate)",
        background: "var(--elan-paper)",
        border: "var(--elan-line)",
    },
};

// ============================================
// Executive summary — the paragraph the client actually reads
// ============================================

export function ExecutiveSummary({ narrative, isGenerating }: NarrativeProps) {
    if (isGenerating && !narrative) {
        return (
            <ArtifactCard>
                <SectionTitle icon={<Quote className="w-4 h-4" />} title="Synthèse" />
                <NarrativeSkeleton lines={4} />
                <p className="mt-4 text-xs text-[var(--elan-slate)]">
                    Analyse de vos données en cours…
                </p>
            </ArtifactCard>
        );
    }
    if (!narrative?.executiveSummary) return null;

    return (
        <ArtifactCard>
            <SectionTitle icon={<Quote className="w-4 h-4" />} title="Synthèse" />
            <p className="text-[15px] leading-[1.7] text-[var(--elan-ink)] whitespace-pre-line">
                {narrative.executiveSummary}
            </p>
            {narrative.uncertainties.length > 0 && (
                <ul className="mt-4 pt-4 border-t border-[var(--elan-line)] space-y-1.5">
                    {narrative.uncertainties.map((item, index) => (
                        <li key={index} className="text-xs text-[var(--elan-slate)] leading-relaxed">
                            {item}
                        </li>
                    ))}
                </ul>
            )}
        </ArtifactCard>
    );
}

// ============================================
// Highlights & watchouts
// ============================================

export function HighlightsGrid({ narrative, isGenerating }: NarrativeProps) {
    if (isGenerating && !narrative) {
        return (
            <div>
                <SectionTitle icon={<CheckCircle2 className="w-4 h-4" />} title="Ce qui fonctionne" subtitle="Points forts et dynamiques positives de la prospection" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[0, 1].map((index) => (
                        <ArtifactCard key={index}>
                            <NarrativeSkeleton lines={2} />
                        </ArtifactCard>
                    ))}
                </div>
            </div>
        );
    }
    if (!narrative?.highlights.length) return null;

    return (
        <div>
            <SectionTitle icon={<CheckCircle2 className="w-4 h-4" />} title="Ce qui fonctionne" subtitle="Points forts et dynamiques positives de la prospection" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {narrative.highlights.map((highlight, index) => (
                    <ArtifactCard key={index} className="p-5">
                        <div
                            className="w-1 h-8 rounded-full mb-3"
                            style={{ background: "var(--elan-success)" }}
                        />
                        <h3 className="text-sm font-bold text-[var(--elan-ink)] mb-1.5">
                            {highlight.title}
                        </h3>
                        <p className="text-sm text-[var(--elan-ink-soft)] leading-relaxed">
                            {highlight.detail}
                        </p>
                    </ArtifactCard>
                ))}
            </div>
        </div>
    );
}

export function WatchoutsList({ narrative, isGenerating }: NarrativeProps) {
    if (isGenerating || !narrative?.watchouts.length) return null;

    return (
        <div>
            <SectionTitle icon={<AlertTriangle className="w-4 h-4" />} title="Ce qui bloque & Points de vigilance" subtitle="Freins identifiés et ajustements préconisés" />
            <div className="space-y-3">
                {narrative.watchouts.map((watchout, index) => {
                    const style = SEVERITY_STYLE[watchout.severity] ?? SEVERITY_STYLE.MEDIUM;
                    return (
                        <div
                            key={index}
                            className="rounded-2xl border p-5 break-inside-avoid"
                            style={{ background: style.background, borderColor: style.border }}
                        >
                            <h3 className="text-sm font-bold mb-1.5" style={{ color: style.color }}>
                                {watchout.title}
                            </h3>
                            <p className="text-sm text-[var(--elan-ink-soft)] leading-relaxed">
                                {watchout.detail}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================
// Next steps — who does what
// ============================================

export function NextStepsCard({ narrative, isGenerating }: NarrativeProps) {
    if (isGenerating || !narrative) return null;
    const agency = narrative.nextSteps.filter((step) => step.owner === "AGENCE");
    const client = narrative.nextSteps.filter((step) => step.owner === "CLIENT");
    if (agency.length === 0 && client.length === 0 && narrative.questionsForYou.length === 0) return null;

    return (
        <ArtifactCard>
            <SectionTitle icon={<ListChecks className="w-4 h-4" />} title="Notre recommandation & Prochaines étapes" subtitle="Plan d'action convenu entre notre équipe et la vôtre" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StepColumn title="Ce qu'on fait" steps={agency} accent="var(--elan-amber)" />
                <StepColumn title="Ce qu'on attend de vous" steps={client} accent="var(--elan-ink)" />
            </div>

            {narrative.questionsForYou.length > 0 && (
                <div className="mt-6 pt-5 border-t border-[var(--elan-line)]">
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--elan-slate)] mb-3">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Questions pour vous
                    </p>
                    <ul className="space-y-2">
                        {narrative.questionsForYou.map((question, index) => (
                            <li key={index} className="text-sm text-[var(--elan-ink)] leading-relaxed">
                                {question}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </ArtifactCard>
    );
}

function StepColumn({
    title,
    steps,
    accent,
}: {
    title: string;
    steps: ClientReportNarrative["nextSteps"];
    accent: string;
}) {
    return (
        <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--elan-slate)] mb-3">
                {title}
            </p>
            {steps.length === 0 ? (
                <p className="text-sm text-[var(--elan-slate)] italic">Rien de particulier.</p>
            ) : (
                <ul className="space-y-3">
                    {steps.map((step, index) => (
                        <li key={index} className="flex gap-3">
                            <span
                                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: accent }}
                            />
                            <span className="text-sm text-[var(--elan-ink)] leading-relaxed">
                                {step.action}
                                {step.horizon && (
                                    <span className="text-[var(--elan-slate)]"> · {step.horizon}</span>
                                )}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
