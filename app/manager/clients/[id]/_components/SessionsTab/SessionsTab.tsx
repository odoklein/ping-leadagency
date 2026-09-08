"use client";

import { useState } from "react";
import Link from "next/link";
import {
    FileText,
    Sparkles,
    Mic,
    Search,
    Loader2,
    Calendar,
    Briefcase,
    PenLine,
    Trash2,
    Copy,
    Eye,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    Download,
    Mail,
    Send,
} from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ClientSession, SessionType } from "../../types";
import {
    SESSION_TYPE_COLORS,
    ROLE_BADGE_COLORS,
    PRIORITY_INDICATOR,
} from "../../types";

interface SessionsTabProps {
    sessions: ClientSession[];
    isLoadingSessions: boolean;
    expandedSessionId: string | null;
    onToggleExpand: (sessionId: string) => void;
    onNewSession: () => void;
    onOpenReport: (session: ClientSession, tab?: "cr" | "email") => void;
    onEditSession: (session: ClientSession) => void;
    onDeleteSession: (session: ClientSession) => void;
    onToggleTask: (sessionId: string, taskId: string) => void;
    togglingTaskId: string | null;
    isDeletingSessionId: string | null;
    onDownloadCsv: (session: ClientSession) => void;
    showToast: {
        success: (title: string, message?: string) => void;
    };
}

export function SessionsTab({
    sessions,
    isLoadingSessions,
    expandedSessionId,
    onToggleExpand,
    onNewSession,
    onOpenReport,
    onEditSession,
    onDeleteSession,
    onToggleTask,
    togglingTaskId,
    isDeletingSessionId,
    onDownloadCsv,
    showToast,
}: SessionsTabProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<SessionType | "all">("all");

    const sessionTypes: SessionType[] = [
        "Kick-Off",
        "Onboarding",
        "Validation",
        "Reporting",
        "Suivi",
        "Autre",
    ];

    const filteredSessions = sessions.filter((s) => {
        if (typeFilter !== "all" && s.type !== typeFilter) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (
                s.type.toLowerCase().includes(q) ||
                s.customTypeLabel?.toLowerCase().includes(q) ||
                s.crMarkdown?.toLowerCase().includes(q) ||
                s.summaryEmail?.toLowerCase().includes(q) ||
                s.tasks.some((t) => t.label.toLowerCase().includes(q))
            );
        }
        return true;
    });

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Sessions & Comptes Rendus ({sessions.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Historique des ateliers, transcriptions Leexi et plans d'actions extraits par IA.
                    </p>
                </div>

                <Button
                    variant="primary"
                    size="sm"
                    onClick={onNewSession}
                    className="gap-2 text-xs font-bold bg-[#2890F8] hover:bg-[#1a75ce] text-white shadow-sm shadow-blue-500/20"
                >
                    <Sparkles className="w-4 h-4" />
                    Nouvelle session
                </Button>
            </div>

            {/* Cadence Timeline Dots Mini-View */}
            {sessions.length > 1 && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-white overflow-x-auto shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                        Chronologie des sessions
                    </span>
                    <div className="flex items-center justify-between gap-4 relative min-w-[500px] px-3">
                        <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-slate-100" />
                        {sessions
                            .slice()
                            .reverse()
                            .slice(0, 8)
                            .map((s) => {
                                const isSelected = expandedSessionId === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => onToggleExpand(s.id)}
                                        className="flex flex-col items-center gap-1.5 relative z-10 group"
                                    >
                                        <div
                                            className={cn(
                                                "w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all",
                                                isSelected
                                                    ? "border-[#2890F8] bg-[#2890F8] text-white scale-110 shadow-md shadow-blue-500/25"
                                                    : "border-slate-300 bg-white text-slate-600 hover:border-[#2890F8] hover:scale-105"
                                            )}
                                        >
                                            {s.type.charAt(0)}
                                        </div>
                                        <span
                                            className={cn(
                                                "text-[10px] font-bold whitespace-nowrap transition-colors",
                                                isSelected
                                                    ? "text-[#2890F8]"
                                                    : "text-slate-400 group-hover:text-slate-700"
                                            )}
                                        >
                                            {new Date(s.date).toLocaleDateString("fr-FR", {
                                                day: "numeric",
                                                month: "short",
                                            })}
                                        </span>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Filter Bar & Search */}
            {sessions.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Rechercher par mot-clé, tâche ou sujet..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => setTypeFilter("all")}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap",
                                typeFilter === "all"
                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            Toutes
                        </button>
                        {sessionTypes.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap",
                                    typeFilter === t
                                        ? `${SESSION_TYPE_COLORS[t].bg} ${SESSION_TYPE_COLORS[t].text} ${SESSION_TYPE_COLORS[t].border} ring-1 ring-current shadow-xs`
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content List */}
            {isLoadingSessions ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2890F8]" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="p-16 text-center rounded-3xl border border-slate-200 bg-white shadow-xs">
                    <Mic className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900">Aucune session enregistrée</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                        Synchronisez vos enregistrements Leexi ou collez une transcription pour générer automatiquement le compte rendu et les tâches d'équipe.
                    </p>
                    <Button
                        variant="primary"
                        onClick={onNewSession}
                        className="gap-2 bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                    >
                        <Sparkles className="w-4 h-4" />
                        Générer la première session
                    </Button>
                </div>
            ) : filteredSessions.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white">
                    <p className="text-xs text-slate-500">Aucune session ne correspond à vos filtres.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredSessions.map((session) => {
                        const isExpanded = expandedSessionId === session.id;
                        const openTasks = session.tasks.filter((t) => !t.doneAt);
                        const isDeleting = isDeletingSessionId === session.id;

                        const sessionLabel =
                            session.type === "Autre" && session.customTypeLabel?.trim()
                                ? session.customTypeLabel.trim()
                                : session.type;

                        return (
                            <div
                                key={session.id}
                                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all"
                            >
                                {/* Session Header Row */}
                                <div
                                    onClick={() => onToggleExpand(session.id)}
                                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <Badge
                                            className={cn(
                                                "text-xs font-bold border shrink-0 py-1 px-3 rounded-lg",
                                                SESSION_TYPE_COLORS[session.type]?.bg,
                                                SESSION_TYPE_COLORS[session.type]?.text,
                                                SESSION_TYPE_COLORS[session.type]?.border
                                            )}
                                        >
                                            {sessionLabel}
                                        </Badge>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">
                                                Session du{" "}
                                                {new Date(session.date).toLocaleDateString("fr-FR", {
                                                    day: "numeric",
                                                    month: "long",
                                                    year: "numeric",
                                                })}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                                                {session.recordingUrl && (
                                                    <span className="text-[#2890F8] font-semibold flex items-center gap-1">
                                                        <Mic className="w-3 h-3" /> Audio disponible
                                                    </span>
                                                )}
                                                {session.projectId && (
                                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                                        <Briefcase className="w-3 h-3" /> Projet rattaché
                                                    </span>
                                                )}
                                                {openTasks.length > 0 && (
                                                    <span className="text-amber-600 font-bold">
                                                        · {openTasks.length} tâche{openTasks.length > 1 ? "s" : ""} en attente
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-2 flex-wrap self-end lg:self-auto shrink-0"
                                    >
                                        {(session.crMarkdown || session.summaryEmail) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onOpenReport(session, "cr")}
                                                className="gap-1.5 text-xs font-bold text-slate-700 bg-white hover:border-[#2890F8]"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-[#2890F8]" />
                                                Voir le rapport
                                            </Button>
                                        )}

                                        {session.summaryEmail && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(session.summaryEmail!);
                                                    showToast.success("Copié", "Mail de synthèse copié");
                                                }}
                                                className="gap-1.5 text-xs font-bold text-slate-700 bg-white hover:border-[#2890F8]"
                                            >
                                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                                Copier mail
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEditSession(session)}
                                            className="p-2 text-slate-500 hover:text-[#2890F8]"
                                            title="Modifier la session"
                                        >
                                            <PenLine className="w-3.5 h-3.5" />
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDeleteSession(session)}
                                            isLoading={isDeleting}
                                            className="p-2 text-slate-400 hover:text-red-600"
                                            title="Supprimer la session"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>

                                        <button
                                            type="button"
                                            onClick={() => onToggleExpand(session.id)}
                                            className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
                                        >
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Area (Tasks & Actions) */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-4">
                                        {/* Task checklist */}
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                                                <span>Plan d'action & Tâches ({session.tasks.length})</span>
                                                <span className="text-[11px] font-normal text-slate-400">
                                                    Cochez une tâche pour la marquer terminée
                                                </span>
                                            </h4>

                                            {session.tasks.length > 0 ? (
                                                <div className="space-y-2">
                                                    {session.tasks.map((task) => {
                                                        const isToggling = togglingTaskId === task.id;
                                                        const isDone = !!task.doneAt;
                                                        const role = ROLE_BADGE_COLORS[task.assigneeRole || "ALWAYS"];
                                                        const priority = PRIORITY_INDICATOR[task.priority || "MEDIUM"];

                                                        return (
                                                            <div
                                                                key={task.id}
                                                                className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleTask(session.id, task.id)}
                                                                    disabled={isToggling}
                                                                    className={cn(
                                                                        "w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all",
                                                                        isDone
                                                                            ? "bg-emerald-500 border-emerald-500 text-white"
                                                                            : "border-slate-300 hover:border-[#2890F8] bg-white"
                                                                    )}
                                                                >
                                                                    {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                                    {isToggling && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                                                </button>

                                                                <span
                                                                    className={cn(
                                                                        "text-xs font-medium flex-1 truncate",
                                                                        isDone ? "line-through text-slate-400" : "text-slate-800"
                                                                    )}
                                                                >
                                                                    {task.label}
                                                                </span>

                                                                {/* Badges */}
                                                                <span
                                                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                                                                    style={{ color: role.color, background: role.bg }}
                                                                >
                                                                    {role.label}
                                                                </span>

                                                                <span
                                                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
                                                                    style={{ color: priority.color, background: priority.bg }}
                                                                >
                                                                    {priority.label}
                                                                </span>

                                                                {task.dueDate && (
                                                                    <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3 text-slate-400" />
                                                                        {new Date(task.dueDate).toLocaleDateString("fr-FR", {
                                                                            day: "numeric",
                                                                            month: "short",
                                                                        })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic py-1">
                                                    Aucune tâche spécifique extraite pour cette session.
                                                </p>
                                            )}
                                        </div>

                                        {/* Bottom Action strip */}
                                        <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-200/70 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                {session.recordingUrl && (
                                                    <a
                                                        href={session.recordingUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-[#2890F8] hover:underline font-bold"
                                                    >
                                                        <Mic className="w-3.5 h-3.5" /> Écouter sur Leexi
                                                    </a>
                                                )}
                                                {session.projectId && (
                                                    <Link
                                                        href={`/manager/projects/${session.projectId}`}
                                                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-bold ml-2"
                                                    >
                                                        <Briefcase className="w-3.5 h-3.5 text-slate-400" /> Ouvrir le projet
                                                    </Link>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onDownloadCsv(session)}
                                                    className="gap-1.5 text-xs text-slate-700 bg-white hover:border-[#2890F8]"
                                                >
                                                    <Download className="w-3.5 h-3.5 text-slate-400" />
                                                    Export CSV
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onOpenReport(session, "cr")}
                                                    className="gap-1.5 text-xs font-bold text-[#2890F8] border-blue-200 bg-white hover:bg-blue-50"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                    Ouvrir le compte rendu
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
