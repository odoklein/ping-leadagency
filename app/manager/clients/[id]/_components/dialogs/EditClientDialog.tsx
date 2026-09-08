"use client";

import { useState, useEffect } from "react";
import { Modal, ModalFooter, Button, Input } from "@/components/ui";
import { Building2, Mail, Phone, Calendar, Globe } from "lucide-react";
import type { Client } from "../../types";

interface EditClientDialogProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    onSaved: (updatedData: Partial<Client>) => Promise<void> | void;
}

export function EditClientDialog({
    isOpen,
    onClose,
    client,
    onSaved,
}: EditClientDialogProps) {
    const [formData, setFormData] = useState({
        name: "",
        industry: "",
        email: "",
        phone: "",
        bookingUrl: "",
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (client) {
            setFormData({
                name: client.name || "",
                industry: client.industry || "",
                email: client.email || "",
                phone: client.phone || "",
                bookingUrl: client.bookingUrl || "",
            });
        }
    }, [client, isOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.name.trim()) return;

        setIsSaving(true);
        try {
            await onSaved(formData);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !isSaving && onClose()}
            title="Modifier le client"
            description="Mettez à jour les informations essentielles de l'entreprise et ses coordonnées."
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4 py-1">
                <Input
                    label="Nom du compte client *"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="ex: Acme Corp"
                    required
                    icon={<Building2 className="w-4 h-4 text-slate-400" />}
                />

                <Input
                    label="Secteur d'activité"
                    value={formData.industry}
                    onChange={(e) => setFormData((p) => ({ ...p, industry: e.target.value }))}
                    placeholder="ex: SaaS B2B, Logistique, EdTech..."
                    icon={<Globe className="w-4 h-4 text-slate-400" />}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                        label="Email principal"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                        placeholder="contact@client.com"
                        icon={<Mail className="w-4 h-4 text-slate-400" />}
                    />
                    <Input
                        label="Téléphone principal"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="+33 1 23 45 67 89"
                        icon={<Phone className="w-4 h-4 text-slate-400" />}
                    />
                </div>

                <div className="space-y-1">
                    <Input
                        label="Lien de réservation général (Calendly / Cal.com / Hubspot)"
                        type="url"
                        value={formData.bookingUrl}
                        onChange={(e) => setFormData((p) => ({ ...p, bookingUrl: e.target.value }))}
                        placeholder="https://calendly.com/client-general"
                        icon={<Calendar className="w-4 h-4 text-slate-400" />}
                    />
                    <p className="text-[11px] text-slate-400 pl-1">
                        Utilisé comme lien par défaut pour les prises de rendez-vous si aucun commercial n'est assigné.
                    </p>
                </div>

                <ModalFooter className="pt-4 border-t border-slate-100">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isSaving}>
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        isLoading={isSaving}
                        disabled={!formData.name.trim() || isSaving}
                        className="bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                    >
                        Enregistrer
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
