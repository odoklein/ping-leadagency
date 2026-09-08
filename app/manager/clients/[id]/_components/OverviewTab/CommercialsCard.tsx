"use client";

import { useState } from "react";
import { Users, Plus, ChevronUp, ChevronDown, Edit, Trash2, Calendar, Copy, ShieldCheck, Key, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ClientInterlocuteur } from "../../types";

interface CommercialsCardProps {
    interlocuteurs: ClientInterlocuteur[];
    onAdd: () => void;
    onEdit: (interlocuteur: ClientInterlocuteur) => void;
    onDelete: (id: string) => void;
    onActivatePortal: (interlocuteur: ClientInterlocuteur) => void;
    onDeactivatePortal: (interlocuteur: ClientInterlocuteur) => void;
    activatingPortalFor: string | null;
    deletingIntId: string | null;
    showToast: {
        success: (title: string, message?: string) => void;
    };
}

export function CommercialsCard({
    interlocuteurs,
    onAdd,
    onEdit,
    onDelete,
    onActivatePortal,
    onDeactivatePortal,
    activatingPortalFor,
    deletingIntId,
    showToast,
}: CommercialsCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Card Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-left"
                >
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#2890F8]" />
                        Commerciaux ({interlocuteurs.length})
                    </h3>
                    {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={onAdd}
                    className="text-xs text-[#2890F8] font-bold hover:text-[#1a75ce] flex items-center gap-1"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter
                </button>
            </div>

            {/* List */}
            {isExpanded && (
                <div className="p-3">
                    {interlocuteurs.length > 0 ? (
                        <div className="space-y-2.5">
                            {interlocuteurs.map((interl) => {
                                const primaryEmail = interl.emails?.find((e) => e.isPrimary) || interl.emails?.[0];
                                const isActivating = activatingPortalFor === interl.id;
                                const isDeleting = deletingIntId === interl.id;

                                return (
                                    <div
                                        key={interl.id}
                                        className={cn(
                                            "group p-3 rounded-xl border transition-all",
                                            interl.isActive
                                                ? "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                                                : "border-slate-200/70 bg-slate-50/70 opacity-70"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2890F8] flex items-center justify-center text-xs font-bold shrink-0">
                                                    {interl.firstName?.[0]}
                                                    {interl.lastName?.[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={cn("text-xs font-bold text-slate-900 truncate", !interl.isActive && "line-through text-slate-400")}>
                                                        {interl.firstName} {interl.lastName}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                                                        {interl.title && <span className="text-slate-600 font-medium">{interl.title}</span>}
                                                        {primaryEmail && <span>· {primaryEmail.value}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons on hover */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(interl)}
                                                    className="p-1 text-slate-400 hover:text-[#2890F8] rounded transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(interl.id)}
                                                    disabled={isDeleting}
                                                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                                    title="Supprimer"
                                                >
                                                    {isDeleting ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Booking links */}
                                        {interl.bookingLinks && interl.bookingLinks.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2.5 pl-10">
                                                {interl.bookingLinks.map((bl, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(bl.url);
                                                            showToast.success("Lien copié", bl.label);
                                                        }}
                                                        className="inline-flex items-center gap-1 bg-blue-50/70 text-[#2890F8] border border-blue-200/80 rounded-lg px-2 py-0.5 text-[10px] font-bold hover:bg-blue-100 transition-colors shadow-2xs"
                                                    >
                                                        <Calendar className="w-2.5 h-2.5" />
                                                        {bl.label} · {bl.durationMinutes}m
                                                        <Copy className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Portal status strip */}
                                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs pl-10">
                                            {interl.portalUser ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                                    Portail actif
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => onActivatePortal(interl)}
                                                    disabled={isActivating || !interl.isActive}
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2890F8] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full transition-colors disabled:opacity-40"
                                                >
                                                    {isActivating ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Key className="w-3 h-3" />
                                                    )}
                                                    Activer portail commercial
                                                </button>
                                            )}

                                            {interl.portalUser && (
                                                <button
                                                    type="button"
                                                    onClick={() => onDeactivatePortal(interl)}
                                                    disabled={isActivating}
                                                    className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                                                >
                                                    Révoquer
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <Users className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-400 italic mb-2">
                                Aucun commercial rattaché à ce client.
                            </p>
                            <button
                                type="button"
                                onClick={onAdd}
                                className="text-xs font-bold text-[#2890F8] hover:underline"
                            >
                                + Ajouter un commercial
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
