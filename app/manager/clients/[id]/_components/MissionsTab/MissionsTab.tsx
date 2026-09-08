"use client";

import Link from "next/link";
import {
    Target,
    Plus,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    Edit,
    List,
    ExternalLink,
    Calendar,
} from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import type { Client, Mission } from "../../types";
import { CHANNEL_LABELS } from "../../types";
import { MISSION_STATUS_CONFIG, type MissionStatusValue } from "@/lib/constants/missionStatus";

interface MissionsTabProps {
    client: Client;
    onNewMission: () => void;
    onEditMission: (mission: Mission) => void;
}

export function MissionsTab({
    client,
    onNewMission,
    onEditMission,
}: MissionsTabProps) {
    const missions = client.missions || [];

    const getMissionStatus = (m: Mission): MissionStatusValue => {
        if (m.status) return m.status;
        return m.isActive ? "ACTIVE" : "PAUSED";
    };

    return (
        <div className="space-y-6">
            {/* Missions List Card */}
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2890F8] flex items-center justify-center">
                            <Target className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                                Missions de Prospection ({missions.length})
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Campagnes actives, listes de prospection et canaux ciblés.
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="primary"
                        size="sm"
                        onClick={onNewMission}
                        className="gap-2 text-xs font-bold bg-[#2890F8] hover:bg-[#1a75ce] text-white shadow-sm shadow-blue-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nouvelle mission
                    </Button>
                </div>

                {/* Body */}
                {missions.length > 0 ? (
                    <div className="p-5 space-y-4">
                        {missions.map((mission) => {
                            const statusKey = getMissionStatus(mission);
                            const statusInfo = MISSION_STATUS_CONFIG[statusKey] || {
                                label: statusKey,
                                badgeVariant: "default",
                            };
                            const campaignsCount = mission._count?.campaigns || 0;
                            const listsCount = mission._count?.lists || 0;
                            const totalItems = Math.max(campaignsCount + listsCount, 1);

                            return (
                                <div
                                    key={mission.id}
                                    className={cn(
                                        "p-5 rounded-2xl border transition-all bg-white hover:shadow-md",
                                        mission.isActive
                                            ? "border-slate-200 border-l-4 border-l-[#2890F8]"
                                            : "border-slate-200 border-l-4 border-l-slate-300 opacity-80"
                                    )}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        {/* Left info */}
                                        <div className="flex items-start gap-4 min-w-0">
                                            <div
                                                className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                    mission.isActive ? "bg-blue-50 text-[#2890F8]" : "bg-slate-100 text-slate-400"
                                                )}
                                            >
                                                {mission.isActive ? (
                                                    <CheckCircle2 className="w-5 h-5" />
                                                ) : (
                                                    <XCircle className="w-5 h-5" />
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <h3 className="text-base font-bold text-slate-900 truncate">
                                                        {mission.name}
                                                    </h3>
                                                    <Badge
                                                        variant={statusInfo.badgeVariant}
                                                        className="text-[10px] font-bold py-0.5"
                                                    >
                                                        {statusInfo.label}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                                                    <span className="font-bold text-[#2890F8]">
                                                        {CHANNEL_LABELS[mission.channel] || mission.channel}
                                                    </span>
                                                    <span>·</span>
                                                    <span>
                                                        {campaignsCount} campagne{campaignsCount > 1 ? "s" : ""}
                                                    </span>
                                                    <span>·</span>
                                                    <span>
                                                        {listsCount} liste{listsCount > 1 ? "s" : ""}
                                                    </span>
                                                </div>

                                                <div className="mt-3 max-w-xs">
                                                    <ProgressBar
                                                        value={campaignsCount}
                                                        max={totalItems}
                                                        height="sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right actions & dates */}
                                        <div className="text-xs text-slate-500 md:text-right shrink-0 flex flex-col md:items-end justify-between gap-3">
                                            <div className="space-y-0.5">
                                                <p className="flex items-center md:justify-end gap-1 font-medium">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    Début : {new Date(mission.startDate).toLocaleDateString("fr-FR")}
                                                </p>
                                                {mission.endDate && (
                                                    <p className="text-slate-400">
                                                        Fin : {new Date(mission.endDate).toLocaleDateString("fr-FR")}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 pt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onEditMission(mission)}
                                                    className="gap-1.5 text-xs font-bold text-slate-700 hover:border-[#2890F8]"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                    Modifier
                                                </Button>

                                                <Link href={`/manager/missions/${mission.id}`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1.5 text-xs font-bold text-[#2890F8] hover:bg-blue-50"
                                                    >
                                                        Ouvrir
                                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <h3 className="text-sm font-bold text-slate-900">Aucune mission enregistrée</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
                            Créez votre première mission de prospection pour assigner des SDRs et lancer les campagnes.
                        </p>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={onNewMission}
                            className="gap-2 bg-[#2890F8] hover:bg-[#1a75ce] text-white"
                        >
                            <Plus className="w-4 h-4" />
                            Créer une mission
                        </Button>
                    </div>
                )}
            </div>

            {/* Prospection Lists Grouped by Mission */}
            {missions.some((m) => m.lists?.length) && (
                <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2890F8] flex items-center justify-center">
                            <List className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                                Listes de Prospection Associées
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Fichiers de comptes et contacts segmentés par mission.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {missions.map(
                            (mission) =>
                                mission.lists && mission.lists.length > 0 && (
                                    <div key={mission.id}>
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Target className="w-3.5 h-3.5 text-[#2890F8]" />
                                            Mission : {mission.name}
                                        </h3>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                            {mission.lists.map((list) => (
                                                <Link
                                                    key={list.id}
                                                    href={`/manager/lists/${list.id}`}
                                                    className="group flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <p className="text-xs font-bold text-slate-900 group-hover:text-[#2890F8] truncate transition-colors">
                                                            {list.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {list._count?.companies || 0} entreprises qualifiées
                                                        </p>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-[#2890F8] transition-colors shrink-0" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
