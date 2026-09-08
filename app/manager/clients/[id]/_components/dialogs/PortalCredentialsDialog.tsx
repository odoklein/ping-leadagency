"use client";

import { useState } from "react";
import { Modal, ModalFooter, Button } from "@/components/ui";
import { ShieldCheck, Copy, CheckCircle2 } from "lucide-react";

interface PortalCredentialsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    credentials: {
        intId: string;
        email: string;
        password: string;
        name?: string;
    } | null;
}

export function PortalCredentialsDialog({
    isOpen,
    onClose,
    credentials,
}: PortalCredentialsDialogProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    if (!credentials) return null;

    const copyText = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Accès portail commercial activé"
            description="Le compte d'accès pour ce commercial a été généré avec succès."
            size="md"
        >
            <div className="space-y-4 py-1">
                <div className="p-3.5 rounded-xl bg-violet-50/80 border border-violet-100 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-violet-900 leading-relaxed">
                        Transmettez ces identifiants au commercial pour qu'il puisse accéder à ses rendez-vous et retours SDR.
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Email de connexion
                        </span>
                        <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50/70">
                            <span className="text-sm font-mono font-medium text-slate-900 select-all">
                                {credentials.email}
                            </span>
                            <button
                                type="button"
                                onClick={() => copyText(credentials.email, "email")}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Mot de passe temporaire
                        </span>
                        <div className="flex items-center justify-between p-3 border border-violet-200/80 bg-violet-50/50 rounded-xl">
                            <span className="text-sm font-mono font-bold text-violet-900 select-all tracking-wider">
                                {credentials.password}
                            </span>
                            <button
                                type="button"
                                onClick={() => copyText(credentials.password, "password")}
                                className="text-violet-600 hover:text-violet-800 p-1 rounded-md flex items-center gap-1 text-xs font-semibold"
                            >
                                <Copy className="w-4 h-4" />
                                {copiedField === "password" ? "Copié !" : "Copier"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 flex items-center gap-2 text-xs text-amber-800">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Ce mot de passe ne sera plus affiché après la fermeture de cette modale.</span>
                </div>

                <ModalFooter className="pt-3 border-t border-slate-100">
                    <Button
                        variant="primary"
                        onClick={onClose}
                        className="w-full bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                    >
                        J'ai bien copié les identifiants
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
