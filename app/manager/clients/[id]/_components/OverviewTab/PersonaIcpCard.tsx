"use client";

import { Target, Sparkles } from "lucide-react";
import type { Client } from "../../types";

interface PersonaIcpCardProps {
    client: Client;
    onEdit: () => void;
}

export function PersonaIcpCard({ client, onEdit }: PersonaIcpCardProps) {
    const icp = (client.onboarding?.onboardingData as { icp?: string } | null)?.icp?.trim();

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#2890F8]" />
                    Persona / Cible (ICP)
                </h3>
                <button
                    type="button"
                    onClick={onEdit}
                    className="text-xs text-[#2890F8] font-bold hover:text-[#1a75ce] transition-colors"
                >
                    Modifier
                </button>
            </div>

            <div className="p-4">
                {icp ? (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {icp}
                    </p>
                ) : (
                    <div className="text-center py-4">
                        <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-400 italic mb-2">
                            Aucun profil cible défini pour ce client.
                        </p>
                        <button
                            type="button"
                            onClick={onEdit}
                            className="text-xs font-bold text-[#2890F8] hover:underline"
                        >
                            + Définir le persona cible
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
