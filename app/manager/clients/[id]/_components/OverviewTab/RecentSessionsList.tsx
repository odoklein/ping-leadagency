"use client";

import { FileText, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ClientSession } from "../../types";
import { SESSION_TYPE_COLORS } from "../../types";

interface RecentSessionsListProps {
    sessions: ClientSession[];
    onSelectSession: (sessionId: string) => void;
    onViewAll: () => void;
    onNewSession: () => void;
}

export function RecentSessionsList({
    sessions,
    onSelectSession,
    onViewAll,
    onNewSession,
}: RecentSessionsListProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#2890F8]" />
                    Sessions & CRs récents ({sessions.length})
                </h3>
                <button
                    type="button"
                    onClick={onViewAll}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2890F8] hover:text-[#1a75ce]"
                >
                    Tout voir <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
            </div>

            {sessions.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-xs">
                    {sessions.slice(0, 4).map((s) => {
                        const openTasks = s.tasks.filter((t) => !t.doneAt).length;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => onSelectSession(s.id)}
                                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors text-left group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Badge
                                        className={cn(
                                            "text-[10px] border font-bold shrink-0",
                                            SESSION_TYPE_COLORS[s.type]?.bg,
                                            SESSION_TYPE_COLORS[s.type]?.text,
                                            SESSION_TYPE_COLORS[s.type]?.border
                                        )}
                                    >
                                        {s.type}
                                    </Badge>
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                        Session du{" "}
                                        {new Date(s.date).toLocaleDateString("fr-FR", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                    {openTasks > 0 ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                            {openTasks} tâche{openTasks > 1 ? "s" : ""}
                                        </span>
                                    ) : s.tasks.length > 0 ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Fait
                                        </span>
                                    ) : null}

                                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2890F8] transition-colors" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">Aucune session enregistrée</p>
                    <button
                        type="button"
                        onClick={onNewSession}
                        className="mt-2 text-xs font-bold text-[#2890F8] hover:underline"
                    >
                        Générer un premier compte rendu →
                    </button>
                </div>
            )}
        </div>
    );
}
