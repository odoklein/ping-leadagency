"use client";

import { Target, Mic, CalendarCheck, AlertCircle, Clock } from "lucide-react";
import { StatCard } from "@/components/ui";
import type { Client, ClientSession, MeetingsData } from "../../types";

interface ClientKpiGridProps {
    client: Client;
    sessions: ClientSession[];
    meetingsData: MeetingsData | null;
    openTasksCount: number;
    lastSessionDaysAgo: number | null;
    onViewSessions: () => void;
}

export function ClientKpiGrid({
    client,
    sessions,
    meetingsData,
    openTasksCount,
    lastSessionDaysAgo,
    onViewSessions,
}: ClientKpiGridProps) {
    const activeMissionsCount = client.missions?.filter((m) => m.isActive).length || 0;
    const totalMissionsCount = client.missions?.length || 0;
    const totalMeetings = meetingsData?.totalMeetings || 0;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* 1. Active missions */}
            <StatCard
                label="Missions actives"
                value={activeMissionsCount}
                icon={Target}
                iconBg="bg-blue-50/80"
                iconColor="text-[#2890F8]"
                subtitle={
                    <span className="text-[11px] text-slate-400 font-medium">
                        {totalMissionsCount} mission{totalMissionsCount > 1 ? "s" : ""} au total
                    </span>
                }
                className="hover:border-blue-300 transition-all rounded-2xl shadow-xs"
            />

            {/* 2. Sessions */}
            <StatCard
                label="Sessions & CRs"
                value={sessions.length}
                icon={Mic}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
                subtitle={
                    sessions.length > 0 ? (
                        <button
                            type="button"
                            onClick={onViewSessions}
                            className="text-[11px] text-violet-600 hover:text-violet-800 font-bold hover:underline"
                        >
                            Voir l'historique →
                        </button>
                    ) : (
                        <span className="text-[11px] text-slate-400">Aucune session</span>
                    )
                }
                className="hover:border-violet-300 transition-all rounded-2xl shadow-xs"
            />

            {/* 3. RDV Pris */}
            <StatCard
                label="RDV Pris"
                value={totalMeetings}
                icon={CalendarCheck}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                subtitle={
                    <span className="text-[11px] text-emerald-700 font-medium">
                        Total qualifié
                    </span>
                }
                className="hover:border-emerald-300 transition-all rounded-2xl shadow-xs"
            />

            {/* 4. Open tasks */}
            <StatCard
                label="Tâches en cours"
                value={openTasksCount}
                icon={AlertCircle}
                iconBg={openTasksCount > 0 ? "bg-amber-50" : "bg-slate-50"}
                iconColor={openTasksCount > 0 ? "text-amber-600" : "text-slate-400"}
                subtitle={
                    <span className="text-[11px] text-slate-400 font-medium">
                        {openTasksCount > 0 ? "À traiter" : "Toutes terminées"}
                    </span>
                }
                className="hover:border-amber-300 transition-all rounded-2xl shadow-xs"
            />

            {/* 5. Cadence / Last Session */}
            <StatCard
                label="Cadence session"
                value={lastSessionDaysAgo === null ? "—" : `J-${lastSessionDaysAgo}`}
                icon={Clock}
                iconBg={
                    lastSessionDaysAgo !== null && lastSessionDaysAgo > 14
                        ? "bg-red-50"
                        : "bg-blue-50"
                }
                iconColor={
                    lastSessionDaysAgo !== null && lastSessionDaysAgo > 14
                        ? "text-red-600"
                        : "text-[#2890F8]"
                }
                subtitle={
                    lastSessionDaysAgo !== null && lastSessionDaysAgo > 14 ? (
                        <span className="text-[11px] text-red-600 font-bold">
                            Relance conseillée
                        </span>
                    ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                            Rythme normal
                        </span>
                    )
                }
                className="hover:border-slate-300 transition-all rounded-2xl shadow-xs"
            />
        </div>
    );
}
