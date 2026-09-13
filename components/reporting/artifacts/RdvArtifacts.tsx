"use client";

import { CalendarCheck, CalendarClock } from "lucide-react";
import type { ClientDailyMetrics, ClientReportNarrative } from "@/lib/reporting/client-daily/types";
import { ArtifactCard, NarrativeSkeleton, SectionTitle, formatDateTime } from "./primitives";

const MEETING_TYPE_LABELS: Record<string, string> = {
    VISIO: "Visio",
    PHYSIQUE: "Sur place",
    TELEPHONIQUE: "Téléphone",
};

/**
 * The proof-of-work artifact: the meetings actually won over the period, each
 * with the one-line reading the model wrote for it (matched on `ref`).
 */
export function RdvTimeline({
    metrics,
    narrative,
    isGenerating,
}: {
    metrics: ClientDailyMetrics;
    narrative: ClientReportNarrative | null;
    isGenerating: boolean;
}) {
    if (metrics.meetingsWon.length === 0) return null;

    const spotlight = new Map(
        (narrative?.rdvSpotlight ?? []).map((entry) => [entry.ref, entry.note])
    );

    return (
        <div>
            <SectionTitle
                icon={<CalendarCheck className="w-4 h-4" />}
                title="Rendez-vous décrochés"
                subtitle={
                    metrics.meetingsWonScope === "brief"
                        ? metrics.brief.rangeLabel
                        : "Les plus récents · 30 derniers jours"
                }
            />
            <div className="space-y-3">
                {metrics.meetingsWon.map((meeting) => {
                    const note = spotlight.get(meeting.ref);
                    return (
                        <ArtifactCard key={meeting.ref} className="p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-[var(--elan-ink)] truncate">
                                        {meeting.company}
                                    </h3>
                                    <p className="text-xs text-[var(--elan-slate)] mt-0.5">
                                        {[meeting.contactName, meeting.contactTitle]
                                            .filter(Boolean)
                                            .join(" · ") || "Contact non renseigné"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {meeting.type && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-[var(--elan-line)] text-[var(--elan-slate)]">
                                            {MEETING_TYPE_LABELS[meeting.type] ?? meeting.type}
                                        </span>
                                    )}
                                    {meeting.scheduledAt && (
                                        <span className="text-xs font-semibold text-[var(--elan-amber-deep)] whitespace-nowrap">
                                            {formatDateTime(meeting.scheduledAt, true)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {isGenerating && !narrative ? (
                                <NarrativeSkeleton lines={1} className="mt-3" />
                            ) : note ? (
                                <p className="mt-3 pt-3 border-t border-[var(--elan-line)] text-sm text-[var(--elan-ink-soft)] leading-relaxed">
                                    {note}
                                </p>
                            ) : null}
                        </ArtifactCard>
                    );
                })}
            </div>
        </div>
    );
}

/** The week ahead — what the client should put in their calendar. */
export function UpcomingMeetings({ metrics }: { metrics: ClientDailyMetrics }) {
    if (metrics.meetingsUpcoming.length === 0) return null;

    return (
        <ArtifactCard>
            <SectionTitle
                icon={<CalendarClock className="w-4 h-4" />}
                title="À venir"
                subtitle="Vos rendez-vous des 7 prochains jours"
            />
            <ul className="divide-y divide-[var(--elan-line)]">
                {metrics.meetingsUpcoming.map((meeting) => (
                    <li key={meeting.ref} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--elan-ink)] truncate">
                                {meeting.company}
                            </p>
                            {meeting.contactName && (
                                <p className="text-xs text-[var(--elan-slate)]">{meeting.contactName}</p>
                            )}
                        </div>
                        <span className="text-xs font-semibold text-[var(--elan-ink)] whitespace-nowrap tabular-nums">
                            {formatDateTime(meeting.scheduledAt, true)}
                        </span>
                    </li>
                ))}
            </ul>
        </ArtifactCard>
    );
}
