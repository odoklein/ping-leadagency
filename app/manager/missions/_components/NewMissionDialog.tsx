"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { createMission, CreateMissionInput } from "@/app/actions/mission-wizard";
import { trackMissionCreated } from "@/lib/analytics/umami";
import { Channel } from "@prisma/client";
import type { MissionStatusValue } from "@/lib/constants/missionStatus";
import {
    X,
    Target,
    MessageSquare,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    Phone,
    Mail,
    Linkedin,
    Calendar,
    Loader2,
    Wand2,
    Sparkles,
    Building2,
    FileText,
    Rocket,
    ArrowRight,
    Check,
    Flame,
    Zap,
    BarChart3,
    Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
    id: string;
    name: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: () => void;
}

const CHANNEL_OPTIONS = [
    {
        value: "CALL",
        label: "Appel téléphonique",
        icon: Phone,
        description: "Prospection directe & qualification",
        gradient: "from-blue-600 to-indigo-700",
        border: "border-blue-200",
        text: "text-blue-700",
        selected: "border-[#2890F8] bg-blue-50/70 ring-2 ring-[#2890F8]/20 shadow-md shadow-blue-500/10",
    },
    {
        value: "EMAIL",
        label: "Campagne Email",
        icon: Mail,
        description: "Séquences multicanales personnalisées",
        gradient: "from-violet-600 to-purple-700",
        border: "border-violet-200",
        text: "text-violet-700",
        selected: "border-violet-500 bg-violet-50/70 ring-2 ring-violet-500/20 shadow-md shadow-violet-500/10",
    },
    {
        value: "LINKEDIN",
        label: "LinkedIn Social Selling",
        icon: Linkedin,
        description: "InMails & connexions directes",
        gradient: "from-sky-600 to-blue-700",
        border: "border-sky-200",
        text: "text-sky-700",
        selected: "border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 shadow-md shadow-sky-500/10",
    },
];

const STEPS = [
    { id: 1, label: "Mission & Client", icon: Building2, description: "Cadrage général" },
    { id: 2, label: "Stratégie & Cible", icon: Target, description: "ICP & Pitch commercial" },
    { id: 3, label: "Argumentaire IA", icon: MessageSquare, description: "Script de prospection" },
    { id: 4, label: "Lancement", icon: Rocket, description: "Validation & Déploiement" },
];

const SCRIPT_SECTIONS = [
    { key: "scriptIntro", label: "Accroche / Introduction", placeholder: "Comment vous présentez-vous et captez l'attention en 15 secondes ?", step: "Étape 1", required: true },
    { key: "scriptDiscovery", label: "Questions de qualification", placeholder: "Quelles questions posez-vous pour identifier les besoins et le budget ?", step: "Étape 2", required: false },
    { key: "scriptObjection", label: "Traitement des objections", placeholder: "Arguments face au manque de temps, budget ou concurrent en place...", step: "Étape 3", required: false },
    { key: "scriptClosing", label: "Closing / Proposition de RDV", placeholder: "Comment proposez-vous le rendez-vous qualifié ?", step: "Étape 4", required: false },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function NewMissionDialog({ isOpen, onClose, onCreated }: Props) {
    const router = useRouter();
    const { success, error: showError } = useToast();

    const [step, setStep] = useState(1);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingSection, setGeneratingSection] = useState<string | null>(null);

    const [form, setForm] = useState<CreateMissionInput & { channels?: Channel[] }>({
        name: "",
        objective: "",
        channel: "CALL" as Channel,
        channels: ["CALL"],
        clientId: "",
        startDate: "",
        endDate: "",
        icp: "",
        pitch: "",
        scriptIntro: "",
        scriptDiscovery: "",
        scriptObjection: "",
        scriptClosing: "",
        status: "ACTIVE" as MissionStatusValue,
    });

    useEffect(() => {
        if (!isOpen) return;
        setStep(1);
        setForm({
            name: "", objective: "", channel: "CALL" as Channel, channels: ["CALL"],
            clientId: "", startDate: "", endDate: "",
            icp: "", pitch: "",
            scriptIntro: "", scriptDiscovery: "", scriptObjection: "", scriptClosing: "",
            status: "ACTIVE" as MissionStatusValue,
        });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setIsLoadingClients(true);
        fetch("/api/clients")
            .then(r => r.json())
            .then(json => {
                if (json.success) {
                    setClients(json.data);
                    if (json.data.length === 1) {
                        setForm(prev => ({ ...prev, clientId: json.data[0].id }));
                    }
                }
            })
            .catch(() => { })
            .finally(() => setIsLoadingClients(false));
    }, [isOpen]);

    // ─── Validation ───────────────────────────────────────────────────────────

    const step1Valid = !!form.name.trim() && !!form.clientId && (form.channels?.length ?? 0) > 0;
    const step2Valid = !!form.icp.trim() && !!form.pitch.trim();
    const step3Valid = !!form.scriptIntro.trim();

    const stepValid = (s: number) => {
        if (s === 1) return step1Valid;
        if (s === 2) return step2Valid;
        if (s === 3) return step3Valid;
        return true;
    };

    // ─── Navigation ───────────────────────────────────────────────────────────

    const goNext = () => {
        if (!stepValid(step)) return;
        setStep(s => Math.min(4, s + 1));
    };

    const goBack = () => {
        setStep(s => Math.max(1, s - 1));
    };

    // ─── AI Generation ───────────────────────────────────────────────────────

    const generateSection = async (section: string) => {
        if (!form.icp.trim() || !form.pitch.trim()) {
            showError("Erreur", "Renseignez d'abord l'ICP et le pitch commercial (étape 2)");
            return;
        }
        setIsGenerating(true);
        setGeneratingSection(section);
        try {
            const res = await fetch("/api/ai/mistral/script", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel: form.channel,
                    clientName: clients.find(c => c.id === form.clientId)?.name || "Client",
                    missionName: form.name || "Mission",
                    campaignName: form.name || "Mission",
                    campaignDescription: form.objective,
                    icp: form.icp,
                    pitch: form.pitch,
                    section,
                    suggestionsCount: 1,
                }),
            });
            const json = await res.json();
            if (json.success) {
                const script = json.data?.script || {};
                const suggestions = json.data?.suggestions || {};

                // Helper: get best string value from script (string) or suggestions (string[])
                const getText = (key: string): string =>
                    (typeof script[key] === 'string' && script[key]) ||
                    (Array.isArray(suggestions[key]) && suggestions[key][0]) ||
                    '';

                if (section === "all") {
                    setForm(prev => ({
                        ...prev,
                        scriptIntro: getText('intro') || prev.scriptIntro,
                        scriptDiscovery: getText('discovery') || prev.scriptDiscovery,
                        scriptObjection: getText('objection') || prev.scriptObjection,
                        scriptClosing: getText('closing') || prev.scriptClosing,
                    }));
                    success("IA Suzalink", "Script complet généré avec succès !");
                } else {
                    const val = getText(section);
                    if (val) {
                        const fieldMap: Record<string, keyof CreateMissionInput> = {
                            intro: "scriptIntro",
                            discovery: "scriptDiscovery",
                            objection: "scriptObjection",
                            closing: "scriptClosing",
                        };
                        setForm(prev => ({ ...prev, [fieldMap[section]]: val }));
                        success("IA Suzalink", "Section argumentaire mise à jour !");
                    }
                }
            } else {
                showError("Erreur IA", json.error || "Génération impossible");
            }
        } catch {
            showError("Erreur", "Connexion IA indisponible");
        } finally {
            setIsGenerating(false);
            setGeneratingSection(null);
        }
    };

    // ─── Submit ───────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await createMission(form);
            if (res.success) {
                trackMissionCreated({ channel: form.channel, clientCount: 1 });
                success("Mission lancée 🎉", res.message || "Votre mission est configurée !");
                onClose();
                onCreated?.();
                if (res.missionId) router.push(`/manager/missions/${res.missionId}`);
            } else {
                showError("Erreur", res.error || "Impossible de créer la mission");
            }
        } catch {
            showError("Erreur", "Une erreur inattendue est survenue");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const clientName = clients.find(c => c.id === form.clientId)?.name;
    const channelOption = CHANNEL_OPTIONS.find(c => c.value === form.channel);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop - Soft focus without darkening the entire screen */}
            <div
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] transition-opacity"
                onClick={onClose}
            />

            {/* Dialog Container with #FCFAFF soft background */}
            <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#FCFAFF] rounded-3xl shadow-2xl shadow-slate-900/10 overflow-hidden border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#0B0F19] via-[#0D1527] to-[#04060A] px-6 sm:px-8 py-6 border-b border-slate-800 flex-shrink-0">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-8 left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2890F8] to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                    <Rocket className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                                            Nouvelle Mission Commerciale
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-[#2890F8] border border-blue-500/30">
                                            Étape {step} / 4
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {step === 1 && "Nommez la mission et sélectionnez le client et les canaux"}
                                        {step === 2 && "Définissez le profil client idéal (ICP) et le pitch d'accroche"}
                                        {step === 3 && "Générez et peaufinez le script d'appel avec l'IA"}
                                        {step === 4 && "Contrôlez les paramètres finaux et déployez la mission"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Step indicator */}
                        <div className="flex items-center gap-1 pt-3 border-t border-slate-800/80">
                            {STEPS.map((s, i) => {
                                const done = step > s.id;
                                const active = step === s.id;
                                const StepIcon = s.icon;
                                return (
                                    <div key={s.id} className="flex items-center flex-1 last:flex-none">
                                        <button
                                            type="button"
                                            onClick={() => done ? setStep(s.id) : undefined}
                                            disabled={!done && !active}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                                active
                                                    ? "bg-[#2890F8] text-white shadow-md shadow-blue-500/30 scale-105"
                                                    : done
                                                        ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                                                        : "bg-white/5 text-slate-500 cursor-not-allowed"
                                            )}
                                        >
                                            {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <StepIcon className="w-3.5 h-3.5" />}
                                            <span className="hidden sm:inline">{s.label}</span>
                                        </button>
                                        {i < STEPS.length - 1 && (
                                            <div className={cn(
                                                "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                                                step > s.id ? "bg-emerald-500/50" : "bg-slate-800"
                                            )} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Body (Soft #FCFAFF surface) ─────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#FCFAFF]">

                    {/* ── STEP 1: Mission basics ── */}
                    {step === 1 && (
                        <div className="space-y-6">

                            {/* Client & Name */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Compte Client <span className="text-red-500">*</span>
                                    </label>
                                    {isLoadingClients ? (
                                        <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                                    ) : (
                                        <select
                                            value={form.clientId}
                                            onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                                            className="w-full h-11 px-3.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all cursor-pointer shadow-2xs"
                                        >
                                            <option value="">Sélectionner un compte client...</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Nom de la mission <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Ex: Prospection SaaS B2B Q1 2026"
                                        className="w-full h-11 px-3.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all placeholder:text-slate-400 shadow-2xs"
                                    />
                                </div>
                            </div>

                            {/* Objective */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Objectif de la mission</label>
                                <textarea
                                    value={form.objective}
                                    onChange={e => setForm(p => ({ ...p, objective: e.target.value }))}
                                    placeholder="Ex: Générer 30 rendez-vous qualifiés par mois auprès des directeurs commerciaux..."
                                    rows={2}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all placeholder:text-slate-400 resize-none shadow-2xs"
                                />
                            </div>

                            {/* Channels (multi-select) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Canaux d'acquisition <span className="text-red-500">*</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mb-3">Sélectionnez les canaux activés pour cette mission (combinables librement).</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                    {CHANNEL_OPTIONS.map(opt => {
                                        const Icon = opt.icon;
                                        const isSelected = form.channels?.includes(opt.value as Channel) ?? form.channel === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    const current = form.channels ?? [form.channel];
                                                    const next = isSelected
                                                        ? current.filter(c => c !== opt.value)
                                                        : [...current, opt.value as Channel];
                                                    if (next.length === 0) return;
                                                    setForm(p => ({
                                                        ...p,
                                                        channels: next,
                                                        channel: next[0],
                                                    }));
                                                }}
                                                className={cn(
                                                    "group relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200 text-center",
                                                    isSelected
                                                        ? opt.selected
                                                        : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md text-white group-hover:scale-105 transition-transform",
                                                    opt.gradient,
                                                    isSelected && "scale-110"
                                                )}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className={cn("text-xs font-bold", isSelected ? opt.text : "text-slate-800")}>{opt.label}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{opt.description}</p>
                                                </div>
                                                {isSelected && (
                                                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#2890F8] text-white flex items-center justify-center shadow-xs">
                                                        <Check className="w-2.5 h-2.5" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dates & Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Date début</label>
                                        <input
                                            type="date"
                                            value={form.startDate}
                                            onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-none focus:border-[#2890F8] shadow-2xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Date fin</label>
                                        <input
                                            type="date"
                                            value={form.endDate}
                                            onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-none focus:border-[#2890F8] shadow-2xs"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Statut initial</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, status: "ACTIVE" as MissionStatusValue }))}
                                            className={cn(
                                                "h-10 px-3 rounded-xl border text-xs font-bold transition-all",
                                                form.status === "ACTIVE"
                                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs"
                                                    : "border-slate-200 bg-white text-slate-600 shadow-2xs"
                                            )}
                                        >
                                            Active immédiate
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setForm((p) => ({ ...p, status: "DRAFT" as MissionStatusValue }))}
                                            className={cn(
                                                "h-10 px-3 rounded-xl border text-xs font-bold transition-all",
                                                form.status === "DRAFT"
                                                    ? "border-slate-400 bg-slate-100 text-slate-800 shadow-2xs"
                                                    : "border-slate-200 bg-white text-slate-600 shadow-2xs"
                                            )}
                                        >
                                            Brouillon
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Strategy ── */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="p-4 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 border border-blue-200/80 rounded-2xl flex items-start gap-3 shadow-2xs">
                                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                                    <Target className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-blue-950">Pourquoi ce cadrage est clé ?</p>
                                    <p className="text-[11px] text-blue-800/80 mt-0.5">
                                        L'ICP et le pitch permettent à l'IA de générer automatiquement un argumentaire téléphonique percutant et personnalisé.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    ICP — Profil Client Idéal <span className="text-red-500">*</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mb-2">Secteur, taille d'entreprise, fonctions décisionnaires, problématiques clés...</p>
                                <textarea
                                    value={form.icp}
                                    onChange={e => setForm(p => ({ ...p, icp: e.target.value }))}
                                    placeholder="Ex: CEOs et Directeurs Commerciaux de PME B2B (20 à 250 employés) en France dans les secteurs SaaS / Services, qui cherchent à accélérer leur prospection sortante."
                                    rows={4}
                                    className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all placeholder:text-slate-400 resize-none shadow-2xs"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Pitch Commercial &amp; Proposition de Valeur <span className="text-red-500">*</span>
                                </label>
                                <p className="text-[11px] text-slate-400 mb-2">En 2-3 phrases, quelle est la promesse principale et le bénéfice différenciant ?</p>
                                <textarea
                                    value={form.pitch}
                                    onChange={e => setForm(p => ({ ...p, pitch: e.target.value }))}
                                    placeholder="Ex: Suzalink met à disposition des SDRs experts et une plateforme IA pour tripler votre volume de rendez-vous qualifiés sans recruter en interne."
                                    rows={4}
                                    className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all placeholder:text-slate-400 resize-none shadow-2xs"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: Script ── */}
                    {step === 3 && (
                        <div className="space-y-5">
                            {/* AI generate all button */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50/90 via-indigo-50/70 to-blue-50/80 border border-violet-200 rounded-2xl shadow-2xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-violet-950 uppercase tracking-wider">Assistant IA Mistral</p>
                                        <p className="text-[11px] text-violet-800">Générez tout l'argumentaire à partir de l'ICP et du Pitch</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => generateSection("all")}
                                    disabled={isGenerating || !form.icp || !form.pitch}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-violet-500/30"
                                >
                                    {isGenerating && generatingSection === "all" ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Wand2 className="w-3.5 h-3.5" />
                                    )}
                                    Générer tout le script
                                </button>
                            </div>

                            {SCRIPT_SECTIONS.map(sec => (
                                <div key={sec.key} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-bold text-slate-800">
                                                {sec.label}
                                                {sec.required && <span className="text-red-500 ml-1">*</span>}
                                            </label>
                                            <span className={cn(
                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                                sec.required ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {sec.step}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => generateSection(sec.key.replace("script", "").toLowerCase())}
                                            disabled={isGenerating || !form.icp || !form.pitch}
                                            className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 disabled:text-slate-400 transition-colors"
                                        >
                                            {isGenerating && generatingSection === sec.key.replace("script", "").toLowerCase() ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Wand2 className="w-3 h-3" />
                                            )}
                                            Générer
                                        </button>
                                    </div>
                                    <textarea
                                        value={(form as any)[sec.key]}
                                        onChange={e => setForm(p => ({ ...p, [sec.key]: e.target.value }))}
                                        placeholder={sec.placeholder}
                                        rows={3}
                                        className={cn(
                                            "w-full p-3.5 border rounded-2xl text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#2890F8] transition-all placeholder:text-slate-400 resize-none shadow-2xs",
                                            sec.required && !(form as any)[sec.key] ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── STEP 4: Review ── */}
                    {step === 4 && (
                        <div className="space-y-5">
                            {/* Mission Executive Card */}
                            <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#0A1224] via-[#08101E] to-[#050B16] border border-slate-800 shadow-xl shadow-black/20 text-white">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-2xl bg-[#2890F8]/20 border border-[#2890F8]/30 flex items-center justify-center text-lg font-black text-[#2890F8]">
                                            {clientName?.[0] || "M"}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black tracking-tight">{form.name}</h3>
                                            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                <Building2 className="w-3.5 h-3.5 text-[#2890F8]" />
                                                {clientName}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                                        {form.status === "ACTIVE" ? "Prêt au lancement" : "Brouillon"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
                                    <div className="p-3 bg-white/5 rounded-2xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Canaux activés</p>
                                        <p className="text-xs font-bold text-white mt-1">
                                            {form.channels?.join(" • ") || form.channel}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white/5 rounded-2xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Période</p>
                                        <p className="text-xs font-bold text-white mt-1">
                                            {form.startDate ? `${form.startDate} → ${form.endDate || "Ouvert"}` : "Illimitée"}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white/5 rounded-2xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Script d'appel</p>
                                        <p className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                                            <Check className="w-3.5 h-3.5" /> Prêt &amp; validé
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Accordion */}
                            <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-3 shadow-2xs">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Profil Client Idéal (ICP)</p>
                                    <p className="text-xs text-slate-800 mt-0.5 leading-relaxed">{form.icp || "—"}</p>
                                </div>
                                <div className="pt-2 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Pitch Commercial</p>
                                    <p className="text-xs text-slate-800 mt-0.5 leading-relaxed">{form.pitch || "—"}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <div className="flex-shrink-0 border-t border-slate-200/80 bg-[#FCFAFF] px-6 sm:px-8 py-4 flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={step === 1 ? onClose : goBack}
                        className="flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all shadow-2xs"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {step === 1 ? "Annuler" : "Retour"}
                    </button>

                    <div className="flex items-center gap-2">
                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={goNext}
                                disabled={!stepValid(step)}
                                className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#0B0F19] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-black/10"
                            >
                                Continuer
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Déploiement en cours...</>
                                ) : (
                                    <><Rocket className="w-4 h-4" /> Lancer la mission</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
