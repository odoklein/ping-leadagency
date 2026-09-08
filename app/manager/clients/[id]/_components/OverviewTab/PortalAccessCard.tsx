"use client";

import { useState } from "react";
import { ShieldCheck, Plus, ChevronUp, ChevronDown, Check, Loader2, Key } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import type { Client, PortalUser } from "../../types";

interface PortalAccessCardProps {
    client: Client;
    onOpenManageAccess: () => void;
    onQuickCreate: () => void;
    onVisibilityChange: (key: "portalShowCallHistory" | "portalShowDatabase", value: boolean) => Promise<void>;
    isSavingSettings: boolean;
}

export function PortalAccessCard({
    client,
    onOpenManageAccess,
    onQuickCreate,
    onVisibilityChange,
    isSavingSettings,
}: PortalAccessCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const clientUsers = (client.users || []).filter((u) => u.role === "CLIENT");

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-left"
                >
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#2890F8]" />
                        Portail Client ({clientUsers.length})
                    </h3>
                    {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                </button>

                <button
                    type="button"
                    onClick={onOpenManageAccess}
                    className="text-xs text-[#2890F8] font-bold hover:text-[#1a75ce] transition-colors"
                >
                    Gérer
                </button>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3">
                    {/* User accounts list */}
                    {clientUsers.length > 0 ? (
                        <div className="space-y-1.5">
                            {clientUsers.map((u) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={onOpenManageAccess}
                                    className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left"
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="text-xs font-bold text-slate-900 truncate">
                                            {u.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                    </div>
                                    <div className="shrink-0">
                                        {u.isActive === false ? (
                                            <Badge className="text-[9px] py-0 bg-red-100 text-red-700 border-0 font-bold">
                                                Révoqué
                                            </Badge>
                                        ) : (
                                            <Badge className="text-[9px] py-0 bg-emerald-100 text-emerald-700 border-0 font-bold">
                                                Actif
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic py-1 px-1">
                            Aucun compte client créé.
                        </p>
                    )}

                    {/* Portal visibility options */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                            Options du portail client
                        </span>

                        <label className="flex items-center justify-between gap-3 text-xs text-slate-700 cursor-pointer select-none">
                            <span className="font-medium">Afficher l'historique d'appels</span>
                            <input
                                type="checkbox"
                                checked={client.portalShowCallHistory ?? false}
                                onChange={(e) =>
                                    onVisibilityChange("portalShowCallHistory", e.target.checked)
                                }
                                disabled={isSavingSettings}
                                className="w-4 h-4 rounded text-[#2890F8] focus:ring-[#2890F8] accent-[#2890F8]"
                            />
                        </label>

                        <label className="flex items-center justify-between gap-3 text-xs text-slate-700 cursor-pointer select-none">
                            <span className="font-medium">Afficher la base de données (contacts/entreprises)</span>
                            <input
                                type="checkbox"
                                checked={client.portalShowDatabase ?? false}
                                onChange={(e) =>
                                    onVisibilityChange("portalShowDatabase", e.target.checked)
                                }
                                disabled={isSavingSettings}
                                className="w-4 h-4 rounded text-[#2890F8] focus:ring-[#2890F8] accent-[#2890F8]"
                            />
                        </label>

                        {isSavingSettings && (
                            <p className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Synchronisation...
                            </p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-1.5 pt-1">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={onOpenManageAccess}
                            className="w-full text-xs font-bold bg-[#2890F8] hover:bg-[#1a75ce] text-white gap-1.5"
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Gérer tous les accès portail
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onQuickCreate}
                            className="w-full text-xs font-bold text-slate-700 hover:border-[#2890F8] gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Créer un accès rapide
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
