"use client";

import Link from "next/link";
import { Target, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Mission } from "../../types";
import { CHANNEL_LABELS } from "../../types";

interface ActiveMissionsSummaryProps {
    missions: Mission[] | undefined;
    onViewAll: () => void;
    onNewMission: () => void;
}

export function ActiveMissionsSummary({
    missions,
    onViewAll,
    onNewMission,
}: ActiveMissionsSummaryProps) {
    const activeMissions = (missions || []).filter((m) => m.isActive);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#2890F8]" />
                    Missions actives ({activeMissions.length})
                </h3>
                <button
                    type="button"
                    onClick={onViewAll}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2890F8] hover:text-[#1a75ce]"
                >
                    Tout voir <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
            </div>

            {activeMissions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {activeMissions.slice(0, 4).map((mission) => {
                        const campaignsCount = mission._count?.campaigns || 0;
                        const listsCount = mission._count?.lists || 0;
                        const totalUnits = Math.max(campaignsCount + listsCount, 1);

                        return (
                            <Link key={mission.id} href={`/manager/missions/${mission.id}`}>
                                <div className="group p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all h-full flex flex-col justify-between">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2890F8] flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 group-hover:text-[#2890F8] truncate transition-colors">
                                                    {mission.name}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {CHANNEL_LABELS[mission.channel] || mission.channel}
                                                </p>
                                            </div>
                                        </div>

                                        <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#2890F8] transition-colors shrink-0 mt-1" />
                                    </div>

                                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                                            <span>
                                                {campaignsCount} campagne{campaignsCount > 1 ? "s" : ""}
                                            </span>
                                            <span>
                                                {listsCount} liste{listsCount > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <ProgressBar
                                            value={campaignsCount}
                                            max={totalUnits}
                                            height="sm"
                                        />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                    <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">Aucune mission active</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onNewMission}
                        className="mt-3 text-xs font-bold text-[#2890F8] border-blue-200 hover:bg-blue-50"
                    >
                        Créer une mission
                    </Button>
                </div>
            )}
        </div>
    );
}
