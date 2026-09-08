"use client";

import { useState, useEffect } from "react";
import { Modal, ModalFooter, Button, Input } from "@/components/ui";
import {
    User,
    Mail,
    Phone,
    Calendar,
    Trash2,
    Plus,
    Building2,
    MapPin,
    Briefcase,
    FileText,
    CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientInterlocuteur, ContactEntry, IntBookingLink } from "../../types";

const DURATION_OPTIONS = [15, 30, 45, 60, 90];

const emptyContactEntry = (): ContactEntry => ({ value: "", label: "Pro", isPrimary: false });
const emptyBookingLink = (): IntBookingLink => ({ label: "", url: "", durationMinutes: 30 });

interface InterlocuteurDialogProps {
    isOpen: boolean;
    onClose: () => void;
    editing: ClientInterlocuteur | null;
    isSaving: boolean;
    onSave: (data: Partial<Omit<ClientInterlocuteur, "id" | "createdAt">>) => void;
}

export function InterlocuteurDialog({
    isOpen,
    onClose,
    editing,
    isSaving,
    onSave,
}: InterlocuteurDialogProps) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [title, setTitle] = useState("");
    const [department, setDepartment] = useState("");
    const [territory, setTerritory] = useState("");
    const [emails, setEmails] = useState<ContactEntry[]>([emptyContactEntry()]);
    const [phones, setPhones] = useState<ContactEntry[]>([emptyContactEntry()]);
    const [bookingLinks, setBookingLinks] = useState<IntBookingLink[]>([]);
    const [notes, setNotes] = useState("");
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        if (isOpen) {
            if (editing) {
                setFirstName(editing.firstName || "");
                setLastName(editing.lastName || "");
                setTitle(editing.title || "");
                setDepartment(editing.department || "");
                setTerritory(editing.territory || "");
                setEmails(editing.emails?.length ? [...editing.emails] : [{ value: "", label: "Pro", isPrimary: true }]);
                setPhones(editing.phones?.length ? [...editing.phones] : [{ value: "", label: "Pro", isPrimary: true }]);
                setBookingLinks(editing.bookingLinks?.length ? [...editing.bookingLinks] : []);
                setNotes(editing.notes || "");
                setIsActive(editing.isActive ?? true);
            } else {
                setFirstName("");
                setLastName("");
                setTitle("");
                setDepartment("");
                setTerritory("");
                setEmails([{ value: "", label: "Pro", isPrimary: true }]);
                setPhones([{ value: "", label: "Pro", isPrimary: true }]);
                setBookingLinks([]);
                setNotes("");
                setIsActive(true);
            }
        }
    }, [isOpen, editing]);

    // Emails
    const updateEmail = (index: number, patch: Partial<ContactEntry>) => {
        setEmails((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };
    const setPrimaryEmail = (index: number) => {
        setEmails((prev) => prev.map((e, i) => ({ ...e, isPrimary: i === index })));
    };
    const removeEmail = (index: number) => {
        if (emails.length <= 1) return;
        setEmails((prev) => {
            const next = prev.filter((_, i) => i !== index);
            if (!next.some((e) => e.isPrimary) && next.length > 0) next[0].isPrimary = true;
            return next;
        });
    };
    const addEmail = () => setEmails((prev) => [...prev, emptyContactEntry()]);

    // Phones
    const updatePhone = (index: number, patch: Partial<ContactEntry>) => {
        setPhones((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };
    const setPrimaryPhone = (index: number) => {
        setPhones((prev) => prev.map((p, i) => ({ ...p, isPrimary: i === index })));
    };
    const removePhone = (index: number) => {
        if (phones.length <= 1) return;
        setPhones((prev) => {
            const next = prev.filter((_, i) => i !== index);
            if (!next.some((p) => p.isPrimary) && next.length > 0) next[0].isPrimary = true;
            return next;
        });
    };
    const addPhone = () => setPhones((prev) => [...prev, emptyContactEntry()]);

    // Booking Links
    const updateBookingLink = (index: number, patch: Partial<IntBookingLink>) => {
        setBookingLinks((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...patch };
            return next;
        });
    };
    const removeBookingLink = (index: number) => {
        setBookingLinks((prev) => prev.filter((_, i) => i !== index));
    };
    const addBookingLink = () => setBookingLinks((prev) => [...prev, emptyBookingLink()]);

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!firstName.trim() || !lastName.trim()) return;

        const cleanEmails = emails.filter((e) => e.value.trim());
        const cleanPhones = phones.filter((p) => p.value.trim());
        const cleanLinks = bookingLinks.filter((bl) => bl.url.trim());

        onSave({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            title: title.trim() || undefined,
            department: department.trim() || undefined,
            territory: territory.trim() || undefined,
            emails: cleanEmails,
            phones: cleanPhones,
            bookingLinks: cleanLinks,
            notes: notes.trim() || undefined,
            isActive,
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editing ? "Modifier le commercial" : "Ajouter un commercial"}
            description={editing ? `${editing.firstName} ${editing.lastName}` : "Ajoutez un interlocuteur commercial ou dirigeant chez le client."}
            size="lg"
            className="max-h-[90vh]"
        >
            <form onSubmit={handleSubmit} className="space-y-5 py-1 max-h-[70vh] overflow-y-auto pr-1">
                {/* 1. Identité */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#2890F8]" />
                        Identité
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                            label="Prénom *"
                            placeholder="Jean"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />
                        <Input
                            label="Nom *"
                            placeholder="Dupont"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />
                    </div>
                    <Input
                        label="Titre / Poste"
                        placeholder="Directeur Commercial, Head of Sales..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        icon={<Briefcase className="w-4 h-4 text-slate-400" />}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                            label="Département"
                            placeholder="Ventes Entreprises, Pôle B2B..."
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            icon={<Building2 className="w-4 h-4 text-slate-400" />}
                        />
                        <Input
                            label="Territoire / Périmètre"
                            placeholder="France Nord, Île-de-France, EMEA..."
                            value={territory}
                            onChange={(e) => setTerritory(e.target.value)}
                            icon={<MapPin className="w-4 h-4 text-slate-400" />}
                        />
                    </div>
                </div>

                {/* 2. Emails */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#2890F8]" />
                            Adresses emails
                        </h3>
                        <button
                            type="button"
                            onClick={addEmail}
                            className="text-xs text-[#2890F8] font-bold hover:text-[#1a75ce] flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            Ajouter un email
                        </button>
                    </div>

                    <div className="space-y-2">
                        {emails.map((entry, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input
                                    type="email"
                                    placeholder="jean.dupont@client.com"
                                    value={entry.value}
                                    onChange={(e) => updateEmail(idx, { value: e.target.value })}
                                    className="flex-1 min-w-0 h-9 px-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                />
                                <input
                                    type="text"
                                    placeholder="Pro, Perso..."
                                    value={entry.label}
                                    onChange={(e) => updateEmail(idx, { label: e.target.value })}
                                    className="w-24 h-9 px-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setPrimaryEmail(idx)}
                                    className={cn(
                                        "shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors",
                                        entry.isPrimary
                                            ? "bg-blue-50 text-[#2890F8] border-blue-200"
                                            : "bg-white text-slate-400 border-slate-200 hover:text-slate-700"
                                    )}
                                >
                                    {entry.isPrimary ? "Principal" : "Définir"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeEmail(idx)}
                                    disabled={emails.length <= 1}
                                    className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-20"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Téléphones */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#2890F8]" />
                            Numéros de téléphone
                        </h3>
                        <button
                            type="button"
                            onClick={addPhone}
                            className="text-xs text-[#2890F8] font-bold hover:text-[#1a75ce] flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            Ajouter un numéro
                        </button>
                    </div>

                    <div className="space-y-2">
                        {phones.map((entry, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input
                                    type="tel"
                                    placeholder="+33 6 12 34 56 78"
                                    value={entry.value}
                                    onChange={(e) => updatePhone(idx, { value: e.target.value })}
                                    className="flex-1 min-w-0 h-9 px-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                />
                                <input
                                    type="text"
                                    placeholder="Mobile, Ligne directe..."
                                    value={entry.label}
                                    onChange={(e) => updatePhone(idx, { label: e.target.value })}
                                    className="w-24 h-9 px-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setPrimaryPhone(idx)}
                                    className={cn(
                                        "shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors",
                                        entry.isPrimary
                                            ? "bg-blue-50 text-[#2890F8] border-blue-200"
                                            : "bg-white text-slate-400 border-slate-200 hover:text-slate-700"
                                    )}
                                >
                                    {entry.isPrimary ? "Principal" : "Définir"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removePhone(idx)}
                                    disabled={phones.length <= 1}
                                    className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-20"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Booking Links */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#2890F8]" />
                            Liens de prise de RDV (Calendly, etc.)
                        </h3>
                        <button
                            type="button"
                            onClick={addBookingLink}
                            className="text-xs text-[#2890F8] font-bold hover:text-[#1a75ce] flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            Ajouter un lien
                        </button>
                    </div>

                    {bookingLinks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                            Aucun lien de réservation configuré pour ce commercial.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {bookingLinks.map((bl, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Découverte 30min"
                                        value={bl.label}
                                        onChange={(e) => updateBookingLink(idx, { label: e.target.value })}
                                        className="w-36 h-9 px-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                    />
                                    <input
                                        type="url"
                                        placeholder="https://calendly.com/jean-dupont/30min"
                                        value={bl.url}
                                        onChange={(e) => updateBookingLink(idx, { url: e.target.value })}
                                        className="flex-1 min-w-0 h-9 px-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                    />
                                    <select
                                        value={bl.durationMinutes}
                                        onChange={(e) => updateBookingLink(idx, { durationMinutes: Number(e.target.value) })}
                                        className="w-20 h-9 px-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8]"
                                    >
                                        {DURATION_OPTIONS.map((d) => (
                                            <option key={d} value={d}>
                                                {d} min
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => removeBookingLink(idx)}
                                        className="shrink-0 p-1.5 text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 5. Notes */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Notes & Préférences
                    </label>
                    <textarea
                        placeholder="Disponibilités habituelles, instructions pour les SDRs, particularités..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] resize-none"
                    />
                </div>

                {/* 6. Statut actif */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <div>
                        <p className="text-xs font-bold text-slate-900">Commercial actif</p>
                        <p className="text-[11px] text-slate-500">
                            {isActive ? "Visible pour l'attribution des RDVs" : "Masqué des attributions futures"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsActive(!isActive)}
                        className={cn(
                            "w-11 h-6 rounded-full relative transition-colors shrink-0",
                            isActive ? "bg-emerald-500" : "bg-slate-300"
                        )}
                    >
                        <span
                            className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                                isActive ? "translate-x-[22px]" : "translate-x-1"
                            )}
                        />
                    </button>
                </div>

                <ModalFooter className="pt-2 border-t border-slate-100">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={isSaving}>
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        isLoading={isSaving}
                        disabled={!firstName.trim() || !lastName.trim() || isSaving}
                        className="bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                    >
                        Enregistrer
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
