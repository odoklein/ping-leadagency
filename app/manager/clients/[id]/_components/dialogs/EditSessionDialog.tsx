"use client";

import { useState, useEffect } from "react";
import { Modal, ModalFooter, Button } from "@/components/ui";
import { Eye, CheckCircle2, FileText, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import AITaskExtractor, { type ExtractedTask } from "@/components/sessions/AITaskExtractor";
import {
    ClientSession,
    SessionType,
    SESSION_MARKDOWN_CLASS,
} from "../../types";

interface EditSessionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    session: ClientSession | null;
    clientName: string;
    onSave: (payload: {
        type: SessionType;
        date: string;
        crMarkdown?: string;
        summaryEmail?: string;
        tasks?: ExtractedTask[];
    }) => Promise<void> | void;
}

export function EditSessionDialog({
    isOpen,
    onClose,
    session,
    clientName,
    onSave,
}: EditSessionDialogProps) {
    const [editingState, setEditingState] = useState<{
        type: SessionType;
        date: string;
        crMarkdown: string;
        summaryEmail: string;
    } | null>(null);

    const [editPreviewMode, setEditPreviewMode] = useState(false);
    const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (session) {
            setEditingState({
                type: session.type,
                date: session.date ? session.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
                crMarkdown: session.crMarkdown || "",
                summaryEmail: session.summaryEmail || "",
            });
            setExtractedTasks([]);
            setEditPreviewMode(false);
        }
    }, [session, isOpen]);

    if (!editingState) return null;

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await onSave({
                type: editingState.type,
                date: editingState.date,
                crMarkdown: editingState.crMarkdown,
                summaryEmail: editingState.summaryEmail,
                tasks: extractedTasks,
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !isSaving && onClose()}
            title="Modifier la session"
            description="Ajustez les métadonnées, le compte rendu markdown et le mail de synthèse."
            size="xl"
        >
            <div className="space-y-4 py-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                            Type de session
                        </label>
                        <select
                            value={editingState.type}
                            onChange={(e) =>
                                setEditingState((prev) =>
                                    prev ? { ...prev, type: e.target.value as SessionType } : prev
                                )
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                        >
                            {(["Kick-Off", "Onboarding", "Validation", "Reporting", "Suivi", "Autre"] as SessionType[]).map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                            Date de tenue
                        </label>
                        <input
                            type="date"
                            value={editingState.date}
                            onChange={(e) =>
                                setEditingState((prev) =>
                                    prev ? { ...prev, date: e.target.value } : prev
                                )
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                        />
                    </div>
                </div>

                {/* Markdown CR editor */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Compte rendu (markdown)
                        </label>
                        <button
                            type="button"
                            onClick={() => setEditPreviewMode(!editPreviewMode)}
                            className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all",
                                editPreviewMode
                                    ? "bg-blue-50 text-[#2890F8] border-blue-200"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            {editPreviewMode ? "Mode Éditeur" : "Aperçu rendu"}
                        </button>
                    </div>

                    {editPreviewMode ? (
                        <div
                            className={cn(
                                "border border-slate-200 rounded-xl p-4 bg-slate-50 min-h-[220px] max-h-80 overflow-y-auto",
                                SESSION_MARKDOWN_CLASS
                            )}
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {editingState.crMarkdown || "*Aucun compte rendu saisi.*"}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <textarea
                            rows={8}
                            value={editingState.crMarkdown}
                            onChange={(e) =>
                                setEditingState((prev) =>
                                    prev ? { ...prev, crMarkdown: e.target.value } : prev
                                )
                            }
                            className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] resize-y leading-relaxed font-mono"
                            placeholder="Rédigez ou collez le compte rendu en markdown..."
                        />
                    )}
                </div>

                {/* Summary Email */}
                <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Mail de synthèse dirigeants
                    </label>
                    <textarea
                        rows={4}
                        value={editingState.summaryEmail}
                        onChange={(e) =>
                            setEditingState((prev) =>
                                prev ? { ...prev, summaryEmail: e.target.value } : prev
                            )
                        }
                        className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] resize-y leading-relaxed"
                        placeholder="Points clés résumés pour le dirigeant..."
                    />
                </div>

                {/* Task extraction */}
                {editingState.crMarkdown && (
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <AITaskExtractor
                            content={editingState.crMarkdown}
                            clientName={clientName}
                            sessionType={editingState.type}
                            tasks={extractedTasks}
                            onTasksChange={setExtractedTasks}
                            compact
                        />
                    </div>
                )}

                <ModalFooter className="pt-3 border-t border-slate-100">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        isLoading={isSaving}
                        className="gap-1.5 bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Enregistrer les modifications
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
