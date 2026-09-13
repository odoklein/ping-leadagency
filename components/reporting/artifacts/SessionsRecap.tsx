"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, FileText, Loader2, Mic } from "lucide-react";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ArtifactCard, SectionTitle } from "./primitives";

/**
 * Sessions & comptes rendus — the read-only view of the working sessions held
 * with the client. Moved out of the reporting page so that page stays a thin
 * shell, and restyled on the --elan-* tokens.
 */

type SessionType = "Kick-Off" | "Onboarding" | "Validation" | "Reporting" | "Suivi" | "Autre";

interface SessionTask {
    id: string;
    label: string;
    assignee?: string;
    assigneeRole?: "SDR" | "MANAGER" | "DEV" | "ALWAYS";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    doneAt?: string | null;
}

interface ClientSession {
    id: string;
    type: SessionType;
    date: string;
    leexiId?: string;
    recordingUrl?: string;
    crMarkdown?: string;
    summaryEmail?: string;
    tasks: SessionTask[];
    createdAt: string;
}

const TYPE_COLOR: Record<string, string> = {
    "Kick-Off": "var(--elan-amber-deep)",
    Onboarding: "var(--elan-success)",
    Validation: "var(--elan-amber-deep)",
    Reporting: "var(--elan-ink)",
    Suivi: "var(--elan-slate)",
    Autre: "var(--elan-slate)",
};

const PRIORITY_COLOR: Record<string, string> = {
    URGENT: "var(--elan-danger)",
    HIGH: "var(--elan-amber-deep)",
    MEDIUM: "var(--elan-ink-soft)",
    LOW: "var(--elan-slate)",
};

export function SessionsRecap({ printMode }: { printMode?: boolean }) {
    const toast = useToast();
    const [sessions, setSessions] = useState<ClientSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [tab, setTab] = useState<"cr" | "email">("cr");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/client/sessions");
                const json = await res.json();
                if (!cancelled && json.success) setSessions(json.data ?? []);
            } catch (error) {
                console.error("Failed to load sessions:", error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (isLoading) {
        return (
            <div>
                <SectionTitle icon={<FileText className="w-4 h-4" />} title="Sessions & comptes rendus" />
                <ArtifactCard className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--elan-amber)]" />
                </ArtifactCard>
            </div>
        );
    }

    if (sessions.length === 0) return null;

    // Print keeps it short: the last three sessions, no interaction.
    const visible = printMode ? sessions.slice(0, 3) : sessions;

    return (
        <div>
            <SectionTitle
                icon={<FileText className="w-4 h-4" />}
                title="Sessions & comptes rendus"
                subtitle="Les points de suivi tenus avec votre équipe"
            />
            <div className="space-y-3">
                {visible.map((session) => {
                    const isExpanded = !printMode && expandedId === session.id;
                    const openTasks = session.tasks.filter((task) => !task.doneAt);
                    const typeColor = TYPE_COLOR[session.type] ?? TYPE_COLOR.Autre;
                    const preview = session.crMarkdown
                        ?.split("\n")
                        .find((line) => line && !line.startsWith("#"))
                        ?.slice(0, 110);

                    return (
                        <div
                            key={session.id}
                            className="rounded-2xl border border-[var(--elan-line)] bg-[var(--elan-surface)] shadow-[var(--elan-shadow-sm)] overflow-hidden break-inside-avoid"
                        >
                            <button
                                type="button"
                                disabled={printMode}
                                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                                className={cn(
                                    "w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors",
                                    !printMode && "hover:bg-[var(--elan-paper)]"
                                )}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[var(--elan-line)] bg-[var(--elan-paper)] shrink-0"
                                        style={{ color: typeColor }}
                                    >
                                        {session.type}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-[var(--elan-ink)] text-sm">
                                            Session du{" "}
                                            {new Date(session.date).toLocaleDateString("fr-FR", {
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </p>
                                        {preview && (
                                            <p className="text-xs text-[var(--elan-slate)] mt-0.5 truncate">
                                                {preview}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {session.recordingUrl && (
                                        <a
                                            href={session.recordingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(event) => event.stopPropagation()}
                                            className="flex items-center gap-1 text-xs font-medium text-[var(--elan-amber-deep)] hover:underline"
                                        >
                                            <Mic className="w-3.5 h-3.5" /> Enregistrement
                                        </a>
                                    )}
                                    {openTasks.length > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-[var(--elan-line)] text-[var(--elan-amber-deep)]">
                                            {openTasks.length} tâche{openTasks.length > 1 ? "s" : ""}
                                        </span>
                                    )}
                                    {!printMode &&
                                        (isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-[var(--elan-slate)]" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-[var(--elan-slate)]" />
                                        ))}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-t border-[var(--elan-line)]">
                                    <div className="flex border-b border-[var(--elan-line)]">
                                        {(["cr", "email"] as const).map((key) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setTab(key)}
                                                className={cn(
                                                    "px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
                                                    tab === key
                                                        ? "border-[var(--elan-amber)] text-[var(--elan-amber-deep)]"
                                                        : "border-transparent text-[var(--elan-slate)] hover:text-[var(--elan-ink)]"
                                                )}
                                            >
                                                {key === "cr" ? "Compte rendu" : "Mail de synthèse"}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-5">
                                        {tab === "cr" &&
                                            (session.crMarkdown ? (
                                                <pre className="whitespace-pre-wrap text-sm text-[var(--elan-ink)] font-sans leading-relaxed">
                                                    {session.crMarkdown}
                                                </pre>
                                            ) : (
                                                <p className="text-sm text-[var(--elan-slate)] italic">
                                                    Pas de compte rendu disponible.
                                                </p>
                                            ))}

                                        {tab === "email" &&
                                            (session.summaryEmail ? (
                                                <div className="space-y-3">
                                                    <div className="bg-[var(--elan-paper)] border border-[var(--elan-line)] rounded-xl p-4">
                                                        <pre className="whitespace-pre-wrap text-sm text-[var(--elan-ink)] font-sans leading-relaxed">
                                                            {session.summaryEmail}
                                                        </pre>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(session.summaryEmail!);
                                                            toast.success("Copié", "Mail copié dans le presse-papier");
                                                        }}
                                                        className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--elan-line)] text-[var(--elan-ink)] hover:border-[var(--elan-line-strong)] transition-colors"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                        Copier le mail
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-[var(--elan-slate)] italic">
                                                    Pas de mail de synthèse disponible.
                                                </p>
                                            ))}

                                        {session.tasks.length > 0 && (
                                            <div className="mt-5 pt-5 border-t border-[var(--elan-line)]">
                                                <h4 className="text-[11px] font-bold text-[var(--elan-slate)] uppercase tracking-wider mb-3">
                                                    Tâches d&apos;équipe
                                                </h4>
                                                <div className="space-y-2">
                                                    {session.tasks.map((task) => (
                                                        <div key={task.id} className="flex items-center gap-3">
                                                            <span
                                                                className={cn(
                                                                    "w-3.5 h-3.5 rounded-full border-2 shrink-0",
                                                                    task.doneAt
                                                                        ? "border-transparent"
                                                                        : "border-[var(--elan-line-strong)]"
                                                                )}
                                                                style={
                                                                    task.doneAt
                                                                        ? { background: "var(--elan-success)" }
                                                                        : undefined
                                                                }
                                                            />
                                                            <span
                                                                className={cn(
                                                                    "text-sm flex-1",
                                                                    task.doneAt
                                                                        ? "line-through text-[var(--elan-slate)]"
                                                                        : "text-[var(--elan-ink)]"
                                                                )}
                                                            >
                                                                {task.label}
                                                            </span>
                                                            <span
                                                                className="text-[10px] font-bold uppercase tracking-wider"
                                                                style={{
                                                                    color:
                                                                        PRIORITY_COLOR[task.priority || "MEDIUM"] ??
                                                                        PRIORITY_COLOR.MEDIUM,
                                                                }}
                                                            >
                                                                {task.priority ?? "MEDIUM"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
