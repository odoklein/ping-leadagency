"use client";

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Building2, Layers, Sparkles, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge, Button } from "@/components/ui";

interface ImportHeaderProps {
    file: File | null;
    totalRows: number;
    missionName: string;
    mappedCount: number;
    totalHeaders: number;
    importType: "companies-only" | "companies-contacts";
    currentStep: number;
}

export function ImportHeader({
    file,
    totalRows,
    missionName,
    mappedCount,
    totalHeaders,
    importType,
    currentStep,
}: ImportHeaderProps) {
    const mappingPercent = totalHeaders > 0 ? Math.round((mappedCount / totalHeaders) * 100) : 0;

    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all">
            {/* Top subtle decorative accent bar */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="flex flex-col gap-4">
                {/* Navigation & Breadcrumbs */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Link
                            href="/manager/lists"
                            className="hover:text-indigo-600 transition-colors flex items-center gap-1 font-medium"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Listes
                        </Link>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <span className="font-semibold text-slate-800">Importer un fichier CSV</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="primary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] gap-1 font-medium">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            Moteur d&apos;import v2 • IA Active
                        </Badge>
                    </div>
                </div>

                {/* Main Header Content */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Importation de prospects
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500">
                            Chargez vos fichiers, mappez vos champs avec l&apos;aide de l&apos;IA et intégrez vos prospects dans Ping CRM.
                        </p>
                    </div>
                </div>

                {/* Status Snapshot Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                    {/* File Snapshot */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 p-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-indigo-600 shadow-2xs flex-shrink-0">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Fichier CSV</p>
                            <p className="text-xs font-semibold text-slate-800 truncate" title={file?.name}>
                                {file ? file.name : "Non sélectionné"}
                            </p>
                            {file && totalRows > 0 && (
                                <p className="text-[10px] text-slate-500 font-mono">
                                    {totalRows.toLocaleString()} lignes
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Mission Snapshot */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 p-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-purple-600 shadow-2xs flex-shrink-0">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Mission cible</p>
                            <p className="text-xs font-semibold text-slate-800 truncate" title={missionName}>
                                {missionName || "À choisir"}
                            </p>
                            {missionName && (
                                <p className="text-[10px] text-emerald-600 font-medium">Assignée</p>
                            )}
                        </div>
                    </div>

                    {/* Mapping Snapshot */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 p-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-blue-600 shadow-2xs flex-shrink-0">
                            <Layers className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Mapping</p>
                            <p className="text-xs font-semibold text-slate-800">
                                {totalHeaders > 0 ? `${mappedCount} / ${totalHeaders}` : "En attente"}
                            </p>
                            {totalHeaders > 0 && (
                                <div className="mt-1 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-300"
                                        style={{ width: `${mappingPercent}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mode Snapshot */}
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 p-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-emerald-600 shadow-2xs flex-shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Modèle</p>
                            <p className="text-xs font-semibold text-slate-800 truncate">
                                {importType === "companies-only" ? "Sociétés" : "Sociétés + Contacts"}
                            </p>
                            <p className="text-[10px] text-slate-500">
                                {importType === "companies-only" ? "1 entité / ligne" : "Contacts associés"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
