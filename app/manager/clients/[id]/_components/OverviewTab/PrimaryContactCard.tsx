"use client";

import { Mail, Phone, Calendar, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Client } from "../../types";

interface PrimaryContactCardProps {
    client: Client;
    onEdit: () => void;
    showToast: {
        success: (title: string, message?: string) => void;
    };
}

export function PrimaryContactCard({ client, onEdit, showToast }: PrimaryContactCardProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        showToast.success("Copié dans le presse-papier", text);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#2890F8]" />
                    Contact Principal
                </h3>
                <button
                    type="button"
                    onClick={onEdit}
                    className="text-xs text-[#2890F8] font-bold hover:text-[#1a75ce] transition-colors"
                >
                    Modifier
                </button>
            </div>

            <div className="p-4 space-y-3">
                {/* Email */}
                {client.email ? (
                    <div className="group flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2890F8] flex items-center justify-center shrink-0">
                                <Mail className="w-3.5 h-3.5" />
                            </div>
                            <a
                                href={`mailto:${client.email}`}
                                className="text-xs font-semibold text-slate-800 hover:text-[#2890F8] truncate"
                            >
                                {client.email}
                            </a>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleCopy(client.email!, "email")}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Copier l'email"
                        >
                            {copiedField === "email" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                                <Copy className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400 italic px-1">Aucun email configuré</p>
                )}

                {/* Phone */}
                {client.phone ? (
                    <div className="group flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <Phone className="w-3.5 h-3.5" />
                            </div>
                            <a
                                href={`tel:${client.phone}`}
                                className="text-xs font-semibold text-slate-800 hover:text-[#2890F8] truncate"
                            >
                                {client.phone}
                            </a>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleCopy(client.phone!, "phone")}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Copier le téléphone"
                        >
                            {copiedField === "phone" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                                <Copy className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>
                ) : (
                    <p className="text-xs text-slate-400 italic px-1">Aucun téléphone configuré</p>
                )}

                {/* Booking URL */}
                {client.bookingUrl && (
                    <div className="p-2 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#2890F8] text-white flex items-center justify-center shrink-0">
                                <Calendar className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-[#2890F8] truncate">
                                Calendly / Cal.com configuré
                            </span>
                        </div>
                        <a
                            href={client.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-[#2890F8] hover:text-[#1a75ce] flex items-center gap-1 shrink-0 p-1"
                            title="Ouvrir le lien de réservation"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
