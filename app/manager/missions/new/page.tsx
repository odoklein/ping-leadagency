"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast, Button } from "@/components/ui";
import { ArrowLeft, Rocket, Sparkles, Building2 } from "lucide-react";
import Link from "next/link";
import { WizardForm, WizardStep } from "@/components/common/WizardForm";
import { MissionDetails } from "./_components/MissionDetails";
import { ScriptBuilder } from "./_components/ScriptBuilder";
import { ReviewLaunch } from "./_components/ReviewLaunch";
import { CreateMissionInput, createMission } from "@/app/actions/mission-wizard";
import { Channel } from "@prisma/client";

// ============================================
// TYPES
// ============================================

interface Client {
    id: string;
    name: string;
}

// ============================================
// NEW MISSION WIZARD PAGE
// ============================================

export default function NewMissionPage() {
    const router = useRouter();
    const { success, error: showError } = useToast();

    // Data State (unified mission + campaign)
    const [missionData, setMissionData] = useState<CreateMissionInput & { channels?: Channel[] }>({
        name: "",
        objective: "",
        targetMeetings: "",
        channel: "CALL" as Channel,
        channels: ["CALL"],
        // Campaign fields
        clientId: "",
        startDate: "",
        endDate: "",
        icp: "",
        pitch: "",
        scriptIntro: "",
        scriptDiscovery: "",
        scriptObjection: "",
        scriptClosing: "",
    });

    // UI State
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ============================================
    // FETCH CLIENTS
    // ============================================

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoadingClients(true);
            try {
                const res = await fetch("/api/clients");
                const json = await res.json();
                if (json.success) {
                    setClients(json.data);
                    // Auto-select first client if only one
                    if (json.data.length === 1) {
                        setMissionData(prev => ({ ...prev, clientId: json.data[0].id }));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch clients:", err);
            } finally {
                setIsLoadingClients(false);
            }
        };
        fetchClients();
    }, []);

    // ============================================
    // VALIDATION LOGIC
    // ============================================

    // Step 1: Mission details + ICP/Pitch
    const step1Errors = (() => {
        const errs: Record<string, string> = {};
        if (!missionData.name.trim()) errs.name = "Le nom est requis";
        if (!missionData.clientId) errs.clientId = "Le client est requis";
        if (!(missionData.channels?.length ?? 0) && !missionData.channel) errs.channel = "Sélectionnez au moins un canal";
        if (!missionData.icp.trim()) errs.icp = "L'ICP est requis";
        if (!missionData.pitch.trim()) errs.pitch = "Le pitch est requis";

        if (missionData.startDate && missionData.endDate) {
            if (new Date(missionData.endDate) < new Date(missionData.startDate)) {
                errs.endDate = "La date de fin doit être après la date de début";
            }
        }
        return errs;
    })();

    const isStep1Valid = Object.keys(step1Errors).length === 0;

    // Step 2: Script (intro required)
    const step2Errors = (() => {
        const errs: Record<string, string> = {};
        if (!missionData.scriptIntro.trim()) errs.scriptIntro = "L'introduction est requise";
        return errs;
    })();

    const isStep2Valid = Object.keys(step2Errors).length === 0;

    // ============================================
    // SUBMIT
    // ============================================

    const handleComplete = async () => {
        setIsSubmitting(true);
        try {
            const res = await createMission(missionData);

            if (res.success) {
                success(
                    "Mission créée 🎉", 
                    res.message || "La mission a été créée avec succès."
                );
                router.push(`/manager/missions/${res.missionId}`);
            } else {
                showError("Erreur", res.error || "Impossible de créer la mission");
                setIsSubmitting(false);
            }
        } catch (err) {
            console.error(err);
            showError("Erreur", "Une erreur inattendue est survenue");
            setIsSubmitting(false);
        }
    };

    // ============================================
    // STEPS CONFIG
    // ============================================

    const steps: WizardStep[] = [
        {
            id: "details",
            label: "Mission & Stratégie",
            component: (
                <MissionDetails
                    data={missionData}
                    onChange={setMissionData}
                    clients={clients}
                    errors={step1Errors}
                />
            ),
            isValid: isStep1Valid,
            validationError: !isStep1Valid ? "Veuillez renseigner tous les champs obligatoires" : undefined
        },
        {
            id: "script",
            label: "Script Commercial IA",
            component: (
                <ScriptBuilder
                    data={missionData}
                    onChange={setMissionData}
                    clientName={clients.find(c => c.id === missionData.clientId)?.name}
                    errors={step2Errors}
                />
            ),
            isValid: isStep2Valid,
            validationError: !isStep2Valid ? "L'introduction du script est requise" : undefined
        },
        {
            id: "review",
            label: "Récapitulatif & Lancement",
            component: (
                <ReviewLaunch
                    data={missionData}
                    clientName={clients.find(c => c.id === missionData.clientId)?.name}
                />
            ),
            isValid: true
        }
    ];

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="w-full min-w-0 space-y-6 max-w-5xl mx-auto pb-16">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-slate-200/70">
                <Link
                    href="/manager/missions"
                    className="w-10 h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors shadow-2xs"
                >
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0B0F19] text-[#2890F8] flex items-center justify-center shadow-md shadow-black/20 border border-slate-800">
                        <Rocket className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Création d'une Nouvelle Mission
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Configurez la stratégie commerciale, l'ICP et les scripts d'appel en quelques minutes.
                        </p>
                    </div>
                </div>
            </div>

            {/* Wizard */}
            {isLoadingClients ? (
                <div className="p-16 text-center text-slate-400">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin mx-auto mb-3" />
                    <p className="text-xs font-bold">Chargement des comptes clients...</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-8">
                    <WizardForm
                        steps={steps}
                        onComplete={handleComplete}
                        isSubmitting={isSubmitting}
                    />
                </div>
            )}
        </div>
    );
}
