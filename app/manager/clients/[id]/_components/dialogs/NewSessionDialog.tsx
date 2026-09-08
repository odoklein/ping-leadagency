"use client";

import { useState } from "react";
import { Modal, ModalFooter, Button } from "@/components/ui";
import {
    Sparkles,
    Mic,
    FileText,
    RefreshCw,
    Loader2,
    Send,
    CheckCircle2,
    Copy,
    AlertCircle,
    Calendar,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import AITaskExtractor, { type ExtractedTask } from "@/components/sessions/AITaskExtractor";
import {
    Client,
    LeexiTranscription,
    SessionType,
    SESSION_TYPE_COLORS,
    SESSION_MARKDOWN_CLASS,
    buildCRPrompt,
} from "../../types";

interface NewSessionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    leexiTranscriptions: LeexiTranscription[];
    isLoadingLeexi: boolean;
    onRefreshLeexi: () => Promise<void>;
    onSaveSession: (payload: {
        type: SessionType;
        leexiId?: string;
        crMarkdown: string;
        summaryEmail: string;
        notifyByEmail: boolean;
        recordingUrl?: string;
        date: string;
        customTypeLabel?: string;
        tasks: Array<{
            label: string;
            assignee?: string;
            assigneeId?: string;
            assigneeRole?: "SDR" | "MANAGER" | "DEV" | "ALWAYS";
            priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
            dueDate?: string;
        }>;
    }) => Promise<void>;
    showToast: {
        success: (title: string, message?: string) => void;
        error: (title: string, message?: string) => void;
    };
}

export function NewSessionDialog({
    isOpen,
    onClose,
    client,
    leexiTranscriptions,
    isLoadingLeexi,
    onRefreshLeexi,
    onSaveSession,
    showToast,
}: NewSessionDialogProps) {
    const [sessionType, setSessionType] = useState<SessionType>("Kick-Off");
    const [customTypeLabel, setCustomTypeLabel] = useState("");
    const [selectedLeexiId, setSelectedLeexiId] = useState("");
    const [sessionDateInput, setSessionDateInput] = useState("");
    const [transcriptMode, setTranscriptMode] = useState<"leexi" | "text" | "cr">("leexi");
    const [manualTranscript, setManualTranscript] = useState("");
    const [manualCR, setManualCR] = useState("");
    const [manualSummaryEmail, setManualSummaryEmail] = useState("");
    const [notifyByEmail, setNotifyByEmail] = useState(false);

    // Generation state
    const [isGeneratingCR, setIsGeneratingCR] = useState(false);
    const [generatedCR, setGeneratedCR] = useState<{ cr: string; email: string } | null>(null);
    const [showCRTab, setShowCRTab] = useState<"cr" | "email">("cr");
    const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const resetState = () => {
        setSessionType("Kick-Off");
        setCustomTypeLabel("");
        setSelectedLeexiId("");
        setSessionDateInput("");
        setTranscriptMode("leexi");
        setManualTranscript("");
        setManualCR("");
        setManualSummaryEmail("");
        setNotifyByEmail(false);
        setGeneratedCR(null);
        setExtractedTasks([]);
    };

    const handleClose = () => {
        if (isGeneratingCR || isSaving) return;
        resetState();
        onClose();
    };

    const handleGenerate = async () => {
        if (!client) {
            showToast.error("Erreur", "Client introuvable");
            return;
        }

        if (transcriptMode === "leexi" && !selectedLeexiId) {
            showToast.error("Erreur", "Veuillez sélectionner un enregistrement Leexi");
            return;
        }

        if (transcriptMode === "text" && (!manualTranscript.trim() || manualTranscript.trim().length < 20)) {
            showToast.error("Erreur", "La transcription doit contenir au moins 20 caractères");
            return;
        }

        if (transcriptMode === "cr") {
            const cr = manualCR.trim();
            const email = manualSummaryEmail.trim();
            if (!cr) {
                showToast.error("Erreur", "Veuillez renseigner au moins le compte rendu.");
                return;
            }
            setGeneratedCR({ cr, email });
            return;
        }

        setIsGeneratingCR(true);
        setGeneratedCR(null);

        try {
            let transcriptText = "";
            const selectedLeexi = leexiTranscriptions.find((t) => t.id === selectedLeexiId);

            const effectiveDateIso = sessionDateInput
                ? new Date(sessionDateInput).toISOString()
                : (selectedLeexi?.date || new Date().toISOString());
            const sessionDate = new Date(effectiveDateIso).toLocaleDateString("fr-FR");

            if (transcriptMode === "leexi") {
                const transcriptRes = await fetch(`/api/leexi/transcript/${selectedLeexiId}`);
                const transcriptJson = await transcriptRes.json();
                if (!transcriptJson.success) throw new Error(transcriptJson.error || "Impossible de récupérer la transcription Leexi");
                transcriptText = transcriptJson.data.transcript;
            } else {
                transcriptText = manualTranscript.trim();
            }

            const sessionLabel =
                sessionType === "Autre" && customTypeLabel.trim().length > 0
                    ? customTypeLabel.trim()
                    : sessionType;

            const prompt = buildCRPrompt({
                clientName: client.name,
                sessionType: sessionLabel,
                sessionDate,
                transcript: transcriptText,
                crPublicUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/client/sessions/[SESSION_ID]`,
                notifyByEmail,
            });

            const aiRes = await fetch("/api/ai/generate-cr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });
            const aiJson = await aiRes.json();
            if (!aiJson.success) throw new Error(aiJson.error || "Échec de la génération par l'IA");

            const fullText: string = aiJson.data.text;
            const splitIndex = fullText.indexOf("---EMAIL_START---");
            if (splitIndex === -1) {
                setGeneratedCR({ cr: fullText, email: "" });
            } else {
                setGeneratedCR({
                    cr: fullText.slice(0, splitIndex).trim(),
                    email: fullText.slice(splitIndex + "---EMAIL_START---".length).trim(),
                });
            }
        } catch (err: any) {
            showToast.error("Erreur", err.message || "Impossible de générer le CR");
        } finally {
            setIsGeneratingCR(false);
        }
    };

    const handleSave = async () => {
        if (!client || !generatedCR) return;
        setIsSaving(true);
        try {
            const selectedLeexi = leexiTranscriptions.find((t) => t.id === selectedLeexiId);
            const effectiveDateIso = sessionDateInput
                ? new Date(sessionDateInput).toISOString()
                : (selectedLeexi?.date || new Date().toISOString());

            await onSaveSession({
                type: sessionType,
                leexiId: selectedLeexiId || undefined,
                crMarkdown: generatedCR.cr,
                summaryEmail: generatedCR.email,
                notifyByEmail,
                recordingUrl: selectedLeexi?.recordingUrl,
                date: effectiveDateIso,
                customTypeLabel: sessionType === "Autre" && customTypeLabel.trim() ? customTypeLabel.trim() : undefined,
                tasks: extractedTasks.filter((t) => t.label.trim().length > 0).map((t) => ({
                    label: t.label.trim(),
                    assignee: t.assignee || undefined,
                    assigneeId: t.assigneeId || undefined,
                    assigneeRole: t.assigneeRole,
                    priority: t.priority,
                    dueDate: t.dueDate || undefined,
                })),
            });
            handleClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={generatedCR ? "Validation du compte rendu & tâches" : "Nouvelle session client"}
            description={
                generatedCR
                    ? "Vérifiez le compte rendu, le mail de synthèse et les tâches extraites par l'IA avant enregistrement."
                    : "Importez un enregistrement Leexi ou collez des notes pour générer un CR complet et un email exécutif."
            }
            size="xl"
            className="max-h-[90vh]"
        >
            {!generatedCR ? (
                <div className="space-y-5 py-1">
                    {/* Session Type Selectors */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                            Type de réunion
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(["Kick-Off", "Onboarding", "Validation", "Reporting", "Suivi", "Autre"] as SessionType[]).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        setSessionType(t);
                                        if (t !== "Autre") setCustomTypeLabel("");
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                                        sessionType === t
                                            ? `${SESSION_TYPE_COLORS[t].bg} ${SESSION_TYPE_COLORS[t].text} ${SESSION_TYPE_COLORS[t].border} ring-1 ring-current shadow-xs`
                                            : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {sessionType === "Autre" && (
                            <div className="mt-2.5">
                                <input
                                    type="text"
                                    value={customTypeLabel}
                                    onChange={(e) => setCustomTypeLabel(e.target.value)}
                                    placeholder='Titre de la session (ex: "Atelier Pitch", "Point Bilan T1"...)'
                                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                />
                            </div>
                        )}
                    </div>

                    {/* Session date */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                            Date de la session
                        </label>
                        <input
                            type="date"
                            value={sessionDateInput}
                            onChange={(e) => setSessionDateInput(e.target.value)}
                            className="w-full sm:w-64 px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                        />
                        <p className="text-[11px] text-slate-400 pl-1">
                            Par défaut : date de l'enregistrement Leexi ou date du jour.
                        </p>
                    </div>

                    {/* Source mode selector */}
                    <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Source des données
                            </label>
                            {transcriptMode === "leexi" && (
                                <button
                                    type="button"
                                    onClick={onRefreshLeexi}
                                    className="text-xs text-[#2890F8] hover:text-[#1a75ce] flex items-center gap-1 font-semibold"
                                >
                                    <RefreshCw className={cn("w-3 h-3", isLoadingLeexi && "animate-spin")} />
                                    Actualiser Leexi
                                </button>
                            )}
                        </div>

                        <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1 border border-slate-200/70 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setTranscriptMode("leexi")}
                                className={cn(
                                    "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                                    transcriptMode === "leexi"
                                        ? "bg-white text-[#2890F8] shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                <Mic className="w-3 h-3" />
                                Enregistrement Leexi
                            </button>
                            <button
                                type="button"
                                onClick={() => setTranscriptMode("text")}
                                className={cn(
                                    "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                                    transcriptMode === "text"
                                        ? "bg-white text-[#2890F8] shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                <FileText className="w-3 h-3" />
                                Coller transcription
                            </button>
                            <button
                                type="button"
                                onClick={() => setTranscriptMode("cr")}
                                className={cn(
                                    "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                                    transcriptMode === "cr"
                                        ? "bg-white text-[#2890F8] shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                )}
                            >
                                <FileText className="w-3 h-3" />
                                CR déjà rédigé
                            </button>
                        </div>

                        {/* Mode 1: Leexi Picker */}
                        {transcriptMode === "leexi" && (
                            <div>
                                {isLoadingLeexi ? (
                                    <div className="flex items-center justify-center py-10 border border-slate-200 rounded-2xl bg-slate-50">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#2890F8]" />
                                    </div>
                                ) : leexiTranscriptions.length === 0 ? (
                                    <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                        <Mic className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm font-semibold text-slate-700">Aucun enregistrement trouvé</p>
                                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                            Vérifiez que vos enregistrements Leexi sont bien rattachés à ce client, ou passez en mode « Coller transcription ».
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        {leexiTranscriptions.map((t) => {
                                            const isSelected = selectedLeexiId === t.id;
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedLeexiId(t.id);
                                                        if (t.date) setSessionDateInput(t.date.slice(0, 10));
                                                    }}
                                                    className={cn(
                                                        "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3",
                                                        isSelected
                                                            ? "border-[#2890F8] bg-blue-50/60 shadow-xs"
                                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                            isSelected ? "bg-[#2890F8] text-white" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            <Mic className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={cn("text-xs font-bold truncate", isSelected ? "text-[#2890F8]" : "text-slate-900")}>
                                                                {t.title}
                                                            </p>
                                                            {t.participants?.length > 0 && (
                                                                <p className="text-[11px] text-slate-500 truncate">
                                                                    {t.participants.join(", ")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0 text-xs">
                                                        <p className="font-semibold text-slate-700">
                                                            {new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400">
                                                            {Math.round(t.duration / 60)} min
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mode 2: Paste text */}
                        {transcriptMode === "text" && (
                            <div className="space-y-1.5">
                                <textarea
                                    value={manualTranscript}
                                    onChange={(e) => setManualTranscript(e.target.value)}
                                    rows={7}
                                    placeholder="Collez ici la transcription brute de la réunion, un compte rendu audio ou vos notes détaillées..."
                                    className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] resize-y leading-relaxed font-mono"
                                />
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span>{manualTranscript.length} caractères</span>
                                    {manualTranscript.length > 0 && manualTranscript.length < 20 && (
                                        <span className="text-amber-600 font-semibold">Minimum 20 caractères requis</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Mode 3: Ready-made CR */}
                        {transcriptMode === "cr" && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                        Compte rendu final (markdown) *
                                    </label>
                                    <textarea
                                        value={manualCR}
                                        onChange={(e) => setManualCR(e.target.value)}
                                        rows={6}
                                        placeholder="Collez ici le compte rendu complet rédigé en markdown..."
                                        className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] resize-y font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                        Mail de synthèse (optionnel)
                                    </label>
                                    <textarea
                                        value={manualSummaryEmail}
                                        onChange={(e) => setManualSummaryEmail(e.target.value)}
                                        rows={4}
                                        placeholder="Collez ici le mail de synthèse dirigeants si disponible..."
                                        className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] resize-y"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Auto-email notification toggle */}
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (client?.email) setNotifyByEmail(!notifyByEmail);
                            }}
                            disabled={!client?.email}
                            className={cn(
                                "w-10 h-6 rounded-full relative transition-colors shrink-0 mt-0.5",
                                !client?.email
                                    ? "bg-slate-200 cursor-not-allowed opacity-60"
                                    : notifyByEmail
                                        ? "bg-[#2890F8]"
                                        : "bg-slate-300"
                            )}
                        >
                            <span
                                className={cn(
                                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                                    notifyByEmail ? "translate-x-5" : "translate-x-1"
                                )}
                            />
                        </button>
                        <div>
                            <p className="text-xs font-bold text-slate-900">
                                Envoyer automatiquement le mail de synthèse au client
                            </p>
                            {client?.email ? (
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {notifyByEmail
                                        ? `Le mail sera envoyé à ${client.email} dès la validation.`
                                        : "Le mail ne sera pas envoyé automatiquement. Vous pourrez le copier manuellement."}
                                </p>
                            ) : (
                                <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Aucun email configuré sur la fiche client.
                                </p>
                            )}
                        </div>
                    </div>

                    <ModalFooter className="pt-2 border-t border-slate-100">
                        <Button variant="ghost" onClick={handleClose} disabled={isGeneratingCR}>
                            Annuler
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleGenerate}
                            isLoading={isGeneratingCR}
                            disabled={
                                isGeneratingCR ||
                                (transcriptMode === "leexi"
                                    ? !selectedLeexiId
                                    : transcriptMode === "text"
                                        ? manualTranscript.trim().length < 20
                                        : manualCR.trim().length === 0)
                            }
                            className="gap-2 bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                        >
                            <Sparkles className="w-4 h-4" />
                            {transcriptMode === "cr" ? "Passer à la validation" : "Générer avec l'IA"}
                        </Button>
                    </ModalFooter>
                </div>
            ) : (
                /* Generated Preview & Task Extraction Step */
                <div className="space-y-4 py-1">
                    {/* View Switcher Tabs */}
                    <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80 gap-1 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setShowCRTab("cr")}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                                showCRTab === "cr"
                                    ? "bg-white text-[#2890F8] shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Compte rendu complet
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCRTab("email")}
                            className={cn(
                                "flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                                showCRTab === "email"
                                    ? "bg-white text-[#2890F8] shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            Mail de synthèse dirigeants
                        </button>
                    </div>

                    {/* Markdown Preview */}
                    <div className="border border-slate-200 rounded-2xl p-5 max-h-72 overflow-y-auto bg-slate-50/60">
                        <div className={SESSION_MARKDOWN_CLASS}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {showCRTab === "cr" ? generatedCR.cr : generatedCR.email || "*Aucun mail rédigé.*"}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Tasks Extractor */}
                    <div className="border border-slate-200 rounded-2xl p-4 bg-white">
                        <AITaskExtractor
                            content={generatedCR.cr}
                            clientName={client?.name}
                            sessionType={sessionType}
                            tasks={extractedTasks}
                            onTasksChange={setExtractedTasks}
                        />
                    </div>

                    <ModalFooter className="pt-2 border-t border-slate-100">
                        <Button
                            variant="ghost"
                            onClick={() => setGeneratedCR(null)}
                            disabled={isSaving}
                        >
                            ← Modifier la source
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            isLoading={isSaving}
                            className="gap-2 bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Enregistrer la session
                        </Button>
                    </ModalFooter>
                </div>
            )}
        </Modal>
    );
}
