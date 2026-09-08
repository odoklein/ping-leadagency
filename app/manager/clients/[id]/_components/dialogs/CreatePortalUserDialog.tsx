"use client";

import { useState } from "react";
import { Modal, ModalFooter, Button, Input } from "@/components/ui";
import { User, Mail, Key, ShieldCheck, Copy, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatePortalUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    onCreateUser: (formData: { name: string; email: string; password?: string }) => Promise<{ email: string; password?: string } | void>;
}

export function CreatePortalUserDialog({
    isOpen,
    onClose,
    clientName,
    onCreateUser,
}: CreatePortalUserDialogProps) {
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password?: string } | null>(null);
    const [hasCopied, setHasCopied] = useState(false);

    const handleClose = () => {
        if (isSubmitting) return;
        setFormData({ name: "", email: "", password: "" });
        setCreatedCredentials(null);
        setHasCopied(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.email.trim()) return;

        setIsSubmitting(true);
        try {
            const result = await onCreateUser({
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password.trim() || undefined,
            });
            if (result) {
                setCreatedCredentials(result);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={createdCredentials ? "Identifiants générés" : "Créer un accès portail client"}
            description={
                createdCredentials
                    ? `Le compte d'accès pour ${clientName} a été activé avec succès.`
                    : `Permettez à vos interlocuteurs chez ${clientName} de suivre leurs missions et résultats.`
            }
            size="md"
        >
            {!createdCredentials ? (
                <form onSubmit={handleSubmit} className="space-y-4 py-1">
                    <Input
                        label="Nom et Prénom *"
                        placeholder="ex: Alexandre Vasseur"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        required
                        icon={<User className="w-4 h-4 text-slate-400" />}
                    />

                    <Input
                        label="Adresse email *"
                        type="email"
                        placeholder="alexandre@client.com"
                        value={formData.email}
                        onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                        required
                        icon={<Mail className="w-4 h-4 text-slate-400" />}
                    />

                    <div className="space-y-1">
                        <Input
                            label="Mot de passe temporaire (optionnel)"
                            type="password"
                            placeholder="Laisser vide pour auto-générer"
                            value={formData.password}
                            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                            icon={<Key className="w-4 h-4 text-slate-400" />}
                        />
                        <p className="text-[11px] text-slate-400 pl-1">
                            Si laissé vide, un mot de passe fort et sécurisé sera automatiquement généré.
                        </p>
                    </div>

                    <ModalFooter className="pt-4 border-t border-slate-100">
                        <Button variant="ghost" type="button" onClick={handleClose} disabled={isSubmitting}>
                            Annuler
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            isLoading={isSubmitting}
                            disabled={!formData.name.trim() || !formData.email.trim() || isSubmitting}
                            className="bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                        >
                            Créer le compte portail
                        </Button>
                    </ModalFooter>
                </form>
            ) : (
                <div className="space-y-4 py-1">
                    <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/70 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="text-xs text-emerald-900 leading-relaxed">
                            <p className="font-bold text-sm text-emerald-950 mb-0.5">Accès client activé</p>
                            Transmettez ces identifiants de connexion au client. Le mot de passe temporaire ne sera plus affiché après fermeture de cette fenêtre.
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Identifiant (Email)
                            </span>
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                                <span className="text-sm font-medium text-slate-900 select-all font-mono">
                                    {createdCredentials.email}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(createdCredentials.email)}
                                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
                                    title="Copier l'email"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Mot de passe temporaire
                            </span>
                            <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200/80 bg-blue-50/40">
                                <span className="text-sm font-bold text-[#2890F8] select-all font-mono tracking-wider">
                                    {createdCredentials.password || "Déjà configuré"}
                                </span>
                                {createdCredentials.password && (
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(createdCredentials.password!)}
                                        className="text-[#2890F8] hover:text-[#1a75ce] p-1 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold"
                                        title="Copier le mot de passe"
                                    >
                                        <Copy className="w-4 h-4" />
                                        {hasCopied ? "Copié !" : "Copier"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Le client sera invité à changer son mot de passe lors de sa première visite.</span>
                    </div>

                    <ModalFooter className="pt-3 border-t border-slate-100">
                        <Button
                            variant="primary"
                            onClick={handleClose}
                            className="w-full bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                        >
                            J'ai noté les identifiants
                        </Button>
                    </ModalFooter>
                </div>
            )}
        </Modal>
    );
}
