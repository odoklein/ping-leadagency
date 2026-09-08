"use client";

import { Activity, Calendar, ShieldCheck, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui";
import type { Client } from "../../types";

interface ProductionEngagementCardProps {
    client: Client;
}

export function ProductionEngagementCard({ client }: ProductionEngagementCardProps) {
    const insights = client.insights;
    const production = insights?.production;
    const engagement = insights?.engagement;

    const formattedMonth = production?.month
        ? new Date(`${production.month}-01T12:00:00`).toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
          })
        : null;

    return (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2890F8] flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                            Production SDR & Engagement Contractuel
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Suivi du rythme de prospection et des objectifs mensuels.
                        </p>
                    </div>
                </div>

                {formattedMonth && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                        {formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1)}
                    </span>
                )}
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Card 1: Jours prévus / mois */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 transition-all hover:bg-blue-50/70">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2890F8] block">
                        Jours prévus / mois
                    </span>
                    <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
                        {production?.plannedMonthDays ?? "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 font-medium">
                        Plans mensuels actifs
                    </p>
                </div>

                {/* Card 2: Jours prévus / semaine */}
                <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 transition-all hover:bg-violet-50/70">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600 block">
                        Jours prévus / semaine
                    </span>
                    <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
                        {production?.plannedWeekDays ?? "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 font-medium">
                        Fréquence des missions
                    </p>
                </div>

                {/* Card 3: Jours effectués */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 transition-all hover:bg-emerald-50/70">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                        Jours effectués
                    </span>
                    <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
                        {production?.executedDays ?? 0}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
                        {production?.totalCalls ?? 0} appels · {production?.totalMeetings ?? 0} RDV
                    </p>
                </div>

                {/* Card 4: Engagement */}
                <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 transition-all hover:bg-amber-50/70">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                        Engagement
                    </span>
                    <p className="mt-2 text-xl font-black text-slate-900">
                        {engagement ? `${engagement.dureeMois} mois` : "Sans engagement"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 font-medium truncate">
                        {engagement
                            ? `${engagement.offreTarif.nom} · fin ${new Date(engagement.fin).toLocaleDateString("fr-FR")}`
                            : "Aucun contrat actif"}
                    </p>
                </div>
            </div>
        </div>
    );
}
