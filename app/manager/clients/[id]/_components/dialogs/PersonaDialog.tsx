"use client";

import { useState, useEffect } from "react";
import { Modal, ModalFooter, Button } from "@/components/ui";
import { Target, Sparkles } from "lucide-react";

interface PersonaDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialIcp: string;
    onSave: (icp: string) => Promise<void> | void;
}

export function PersonaDialog({
    isOpen,
    onClose,
    initialIcp,
    onSave,
}: PersonaDialogProps) {
    const [icp, setIcp] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIcp(initialIcp || "");
        }
    }, [isOpen, initialIcp]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(icp);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !isSaving && onClose()}
            title="Persona / Profil Cible (ICP)"
            description="Définissez les caractéristiques idéales des entreprises et décideurs ciblés pour ce client."
            size="lg"
        >
            <div className="space-y-4 py-1">
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-[#2890F8]/15 text-[#2890F8] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-900">Astuce ciblage :</span> Précisez les titres de postes cibles (DG, DRH, DAF, CTO...), la taille d'entreprise (50-250 employés), la zone géographique et les douleurs spécifiques résolues par l'offre.
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Description du profil cible (ICP)
                    </label>
                    <textarea
                        className="w-full min-h-[140px] p-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] transition-all resize-y leading-relaxed"
                        placeholder="Ex : Directeurs des Systèmes d'Information (DSI) et Responsables Sécurité (RSSI) en ETI et grandes entreprises (200 à 2000 salariés) en France, secteur banque, assurance et retail..."
                        value={icp}
                        onChange={(e) => setIcp(e.target.value)}
                        rows={5}
                    />
                    <p className="text-[11px] text-slate-400">
                        Ce persona alimente le score de readiness et guide la rédaction des messages et des scripts des SDRs.
                    </p>
                </div>

                <ModalFooter className="pt-4 border-t border-slate-100">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={isSaving}
                        className="bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                    >
                        Enregistrer le persona
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
