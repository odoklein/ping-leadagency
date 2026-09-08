"use client";

import { Building2, Target, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClientTabId = "overview" | "missions" | "sessions" | "analytics";

interface ClientTabsNavProps {
    activeTab: ClientTabId;
    onChange: (tab: ClientTabId) => void;
    counts?: {
        missions?: number;
        sessions?: number;
        tasks?: number;
    };
}

export function ClientTabsNav({ activeTab, onChange, counts }: ClientTabsNavProps) {
    const tabs: Array<{
        id: ClientTabId;
        label: string;
        icon: React.ReactNode;
        badge?: number;
    }> = [
        {
            id: "overview",
            label: "Vue d'ensemble",
            icon: <Building2 className="w-4 h-4" />,
        },
        {
            id: "missions",
            label: "Missions & Prospection",
            icon: <Target className="w-4 h-4" />,
            badge: counts?.missions,
        },
        {
            id: "sessions",
            label: "Sessions & CRs",
            icon: <FileText className="w-4 h-4" />,
            badge: counts?.sessions,
        },
        {
            id: "analytics",
            label: "Analytics & Persona",
            icon: <BarChart3 className="w-4 h-4" />,
        },
    ];

    return (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-white/80 backdrop-blur-md">
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-xs overflow-x-auto custom-scrollbar">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0",
                                isActive
                                    ? "bg-white text-[#2890F8] shadow-sm shadow-black/5 ring-1 ring-slate-200"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                            )}
                        >
                            <span className={cn("transition-colors", isActive ? "text-[#2890F8]" : "text-slate-400")}>
                                {tab.icon}
                            </span>
                            <span>{tab.label}</span>
                            {typeof tab.badge === "number" && tab.badge > 0 && (
                                <span
                                    className={cn(
                                        "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ml-0.5",
                                        isActive
                                            ? "bg-blue-100 text-[#2890F8]"
                                            : "bg-slate-200 text-slate-600"
                                    )}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
