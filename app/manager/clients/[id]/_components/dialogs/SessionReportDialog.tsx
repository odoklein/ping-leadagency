"use client";

import { useState } from "react";
import { Modal, ModalFooter, Button, Badge } from "@/components/ui";
import { Download, Copy, Send, CheckCircle2, FileText, Mail, Calendar, Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
    ClientSession,
    SESSION_TYPE_COLORS,
    SESSION_MARKDOWN_CLASS,
} from "../../types";

interface SessionReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    session: ClientSession | null;
    initialTab?: "cr" | "email";
    clientEmail?: string;
    onDownloadCsv: (session: ClientSession) => void;
}

export function SessionReportDialog({
    isOpen,
    onClose,
    session,
    initialTab = "cr",
    clientEmail,
    onDownloadCsv,
}: SessionReportDialogProps) {
    const [activeTab, setActiveTab] = useState<"cr" | "email">(initialTab);
    const [hasCopied, setHasCopied] = useState(false);

    if (!session) return null;

    const sessionTypeLabel =
        session.type === "Autre" && session.customTypeLabel?.trim()
            ? session.customTypeLabel.trim()
            : session.type;

    const copyCurrentContent = () => {
        const text = activeTab === "cr" ? session.crMarkdown || "" : session.summaryEmail || "";
        navigator.clipboard.writeText(text);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Rapport de session — ${sessionTypeLabel}`}
            description={`Réunion tenue le ${new Date(session.date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
            })}`}
            size="xl"
            className="max-h-[90vh]"
        >
            <div className="space-y-4 py-1">
                {/* Meta header bar */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs border font-semibold", SESSION_TYPE_COLORS[session.type]?.border, SESSION_TYPE_COLORS[session.type]?.bg, SESSION_TYPE_COLORS[session.type]?.text)}>
                            {sessionTypeLabel}
                        </Badge>
                        <span className="text-xs text-slate-500 font-medium">
                            {session.tasks.length} tâche{session.tasks.length > 1 ? "s" : ""}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">
                            {session.emailSentAt
                                ? `Mail envoyé le ${new Date(session.emailSentAt).toLocaleDateString("fr-FR")}`
                                : "Mail non envoyé automatiquement"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDownloadCsv(session)}
                            className="gap-1.5 text-xs text-slate-700 bg-white hover:border-[#2890F8]"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            Export CSV
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={copyCurrentContent}
                            className="gap-1.5 text-xs text-slate-700 bg-white hover:border-[#2890F8]"
                        >
                            {hasCopied ? (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-bold">Copié !</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    Copier {activeTab === "cr" ? "le CR" : "le mail"}
                                </>
                            )}
                        </Button>

                        {activeTab === "email" && session.summaryEmail && clientEmail && (
                            <a
                                href={`mailto:${clientEmail}?subject=${encodeURIComponent(`Synthèse de notre session ${sessionTypeLabel}`)}&body=${encodeURIComponent(session.summaryEmail)}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[#2890F8] text-xs font-bold hover:bg-blue-100 transition-colors shadow-2xs"
                            >
                                <Send className="w-3 h-3" />
                                Envoyer par email
                            </a>
                        )}
                    </div>
                </div>

                {/* Segment tabs */}
                <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80 gap-1 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab("cr")}
                        className={cn(
                            "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                            activeTab === "cr"
                                ? "bg-white text-[#2890F8] shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Compte rendu complet
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("email")}
                        className={cn(
                            "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                            activeTab === "email"
                                ? "bg-white text-[#2890F8] shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        <Mail className="w-3.5 h-3.5" />
                        Mail de synthèse dirigeants
                    </button>
                </div>

                {/* Content Box */}
                <div className="border border-slate-200 rounded-2xl bg-white p-6 max-h-[55vh] overflow-y-auto">
                    {activeTab === "cr" ? (
                        session.crMarkdown ? (
                            <div className={SESSION_MARKDOWN_CLASS}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {session.crMarkdown}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 italic text-center py-8">
                                Aucun compte rendu n'a été enregistré pour cette session.
                            </p>
                        )
                    ) : session.summaryEmail ? (
                        <div className={SESSION_MARKDOWN_CLASS}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {session.summaryEmail}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic text-center py-8">
                            Aucun mail de synthèse n'a été enregistré pour cette session.
                        </p>
                    )}
                </div>

                <ModalFooter className="pt-2 border-t border-slate-100">
                    <Button variant="ghost" onClick={onClose}>
                        Fermer
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
