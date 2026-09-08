"use client";

import { useState, useMemo } from "react";
import {
    Building2,
    Mail,
    Phone,
    Globe,
    MapPin,
    Briefcase,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Calendar,
    PhoneCall,
    ShieldCheck,
    Info,
} from "lucide-react";

export interface ColumnMapping {
    csvColumn: string;
    targetField: string;
    confidence?: number;
    autoDetected?: boolean;
    reasoning?: string;
    isCustomField?: boolean;
}

interface ActionColumnMapping {
    statusColumn?: string;
    dateColumn?: string;
    callbackDateColumn?: string;
    noteColumn?: string;
    channelColumn?: string;
}

interface LiveCrmLeadPreviewProps {
    sampleRows: Record<string, string>[];
    mappings: ColumnMapping[];
    importType: "companies-only" | "companies-contacts";
    actionColumnMapping?: ActionColumnMapping;
    importActions?: boolean;
}

export function LiveCrmLeadPreview({
    sampleRows,
    mappings,
    importType,
    actionColumnMapping,
    importActions,
}: LiveCrmLeadPreviewProps) {
    const [currentRowIndex, setCurrentRowIndex] = useState(0);

    const totalSamples = Math.min(sampleRows.length, 5);
    const activeRow = sampleRows[currentRowIndex] || {};

    // Helper to get value mapped to a specific target field
    const getValueForField = (targetField: string): { value: string; isMapped: boolean; sourceCol: string } => {
        const mapping = mappings.find((m) => m.targetField === targetField);
        if (!mapping || !mapping.csvColumn) {
            return { value: "", isMapped: false, sourceCol: "" };
        }
        return {
            value: (activeRow[mapping.csvColumn] ?? "").trim(),
            isMapped: true,
            sourceCol: mapping.csvColumn,
        };
    };

    // Extract core fields
    const companyName = getValueForField("company.name");
    const companyIndustry = getValueForField("company.industry");
    const companyCountry = getValueForField("company.country");
    const companyWebsite = getValueForField("company.website");
    const companyPhone = getValueForField("company.phone");
    const companySize = getValueForField("company.size");

    const contactFirstName = getValueForField("contact.firstName");
    const contactLastName = getValueForField("contact.lastName");
    const contactEmail = getValueForField("contact.email");
    const contactPhone = getValueForField("contact.phone");
    const contactTitle = getValueForField("contact.title");
    const contactLinkedin = getValueForField("contact.linkedin");

    // Extract custom fields
    const customFields = useMemo(() => {
        return mappings
            .filter((m) => m.targetField && (m.isCustomField || (
                (m.targetField.startsWith("company.") && !["company.name", "company.industry", "company.country", "company.website", "company.phone", "company.additionalPhones", "company.size"].includes(m.targetField)) ||
                (m.targetField.startsWith("contact.") && !["contact.firstName", "contact.lastName", "contact.email", "contact.phone", "contact.additionalPhones", "contact.title", "contact.linkedin"].includes(m.targetField))
            )))
            .map((m) => ({
                label: m.targetField.replace(/^(company|contact)\./, ""),
                type: m.targetField.startsWith("company.") ? "Société" : "Contact",
                col: m.csvColumn,
                value: (activeRow[m.csvColumn] ?? "").trim(),
            }));
    }, [mappings, activeRow]);

    // Format contact full name
    const contactFullName = useMemo(() => {
        const first = contactFirstName.value;
        const last = contactLastName.value;
        if (first && last) return `${first} ${last}`;
        if (first) return first;
        if (last) return last;
        return "";
    }, [contactFirstName.value, contactLastName.value]);

    // Extract initials for avatar
    const initials = useMemo(() => {
        const first = contactFirstName.value;
        const last = contactLastName.value;
        if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
        if (first) return first.slice(0, 2).toUpperCase();
        if (last) return last.slice(0, 2).toUpperCase();
        if (companyName.value) return companyName.value.slice(0, 2).toUpperCase();
        return "CRM";
    }, [contactFirstName.value, contactLastName.value, companyName.value]);

    // Calculate lead prospect readiness score (0-100%)
    const readinessScore = useMemo(() => {
        let score = 0;
        // Company name (mandatory)
        if (companyName.value) score += 30;
        else if (companyName.isMapped) score += 15;

        // Primary phone (direct or standard)
        if (contactPhone.value || companyPhone.value) score += 25;
        else if (contactPhone.isMapped || companyPhone.isMapped) score += 10;

        // Email
        if (contactEmail.value) score += 20;
        else if (contactEmail.isMapped) score += 10;

        // Contact name & title
        if (contactFullName && contactTitle.value) score += 15;
        else if (contactFullName || contactTitle.value) score += 10;
        else if (contactFirstName.isMapped || contactLastName.isMapped || contactTitle.isMapped) score += 5;

        // Website or Industry
        if (companyWebsite.value || companyIndustry.value) score += 10;
        else if (companyWebsite.isMapped || companyIndustry.isMapped) score += 5;

        return Math.min(100, score);
    }, [
        companyName,
        contactPhone,
        companyPhone,
        contactEmail,
        contactFullName,
        contactTitle,
        contactFirstName.isMapped,
        contactLastName.isMapped,
        companyWebsite,
        companyIndustry,
    ]);

    const getScoreBadge = () => {
        if (readinessScore >= 80) {
            return {
                label: "Excellente complétude",
                desc: "Parfait pour la prospection SDR directe",
                color: "text-emerald-700 bg-emerald-50 border-emerald-200",
                barColor: "bg-emerald-500",
                icon: ShieldCheck,
            };
        }
        if (readinessScore >= 50) {
            return {
                label: "Complétude moyenne",
                desc: "Données suffisantes pour le premier contact",
                color: "text-indigo-700 bg-indigo-50 border-indigo-200",
                barColor: "bg-indigo-500",
                icon: Sparkles,
            };
        }
        return {
            label: "Incomplet",
            desc: "Mappez au minimum Société et un Téléphone/Email",
            color: "text-amber-700 bg-amber-50 border-amber-200",
            barColor: "bg-amber-500",
            icon: AlertCircle,
        };
    };

    const scoreMeta = getScoreBadge();
    const ScoreIcon = scoreMeta.icon;

    // Action simulation (if mapped)
    const actionStatus = actionColumnMapping?.statusColumn ? (activeRow[actionColumnMapping.statusColumn] ?? "").trim() : "";
    const actionDate = actionColumnMapping?.dateColumn ? (activeRow[actionColumnMapping.dateColumn] ?? "").trim() : "";
    const actionNote = actionColumnMapping?.noteColumn ? (activeRow[actionColumnMapping.noteColumn] ?? "").trim() : "";

    return (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-300">
            {/* Header & Row Navigator */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Simulation Fiche CRM
                        </h4>
                        <p className="text-[11px] text-slate-400">Rendu prospect en temps réel</p>
                    </div>
                </div>

                {totalSamples > 1 && (
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/80">
                        <button
                            type="button"
                            onClick={() => setCurrentRowIndex((prev) => Math.max(0, prev - 1))}
                            disabled={currentRowIndex === 0}
                            className="p-0.5 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Ligne précédente"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-semibold text-slate-700 tabular-nums">
                            {currentRowIndex + 1} / {totalSamples}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentRowIndex((prev) => Math.min(totalSamples - 1, prev + 1))}
                            disabled={currentRowIndex === totalSamples - 1}
                            className="p-0.5 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Ligne suivante"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Completeness Gauge */}
            <div className="mt-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/70">
                <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <ScoreIcon className={`h-3.5 w-3.5 ${scoreMeta.color.split(" ")[0]}`} />
                        <span className="font-semibold text-slate-800">{scoreMeta.label}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-700 text-[11px]">{readinessScore}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                        className={`h-full ${scoreMeta.barColor} transition-all duration-500 ease-out`}
                        style={{ width: `${readinessScore}%` }}
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{scoreMeta.desc}</p>
            </div>

            {/* Virtual CRM Lead Card */}
            <div className="mt-4 rounded-xl border border-indigo-100/80 bg-gradient-to-b from-white via-white to-slate-50/50 p-3.5 shadow-sm space-y-3">
                {/* Company Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        {companyName.value ? (
                            <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{companyName.value}</span>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                            </h3>
                        ) : companyName.isMapped ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium italic">
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span>(Nom vide sur ligne {currentRowIndex + 1})</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                                <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                                <span>Nom de société non mappé *</span>
                            </div>
                        )}

                        {/* Industry & Country Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {companyIndustry.value && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
                                    <Briefcase className="w-2.5 h-2.5 text-slate-500" />
                                    {companyIndustry.value}
                                </span>
                            )}
                            {companyCountry.value && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
                                    <MapPin className="w-2.5 h-2.5 text-slate-500" />
                                    {companyCountry.value}
                                </span>
                            )}
                            {companySize.value && (
                                <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
                                    {companySize.value} sal.
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Website Button */}
                    {companyWebsite.value ? (
                        <a
                            href={companyWebsite.value.startsWith("http") ? companyWebsite.value : `https://${companyWebsite.value}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 transition-colors flex-shrink-0"
                            title={companyWebsite.value}
                        >
                            <Globe className="w-3 h-3" />
                            <span className="hidden sm:inline truncate max-w-[80px]">
                                {companyWebsite.value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                    ) : (
                        <div className="text-[10px] text-slate-400 italic px-2 py-1 rounded border border-dashed border-slate-200 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" />
                            <span>Pas de site</span>
                        </div>
                    )}
                </div>

                {/* Company Phone (Standard) */}
                {companyPhone.value && (
                    <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-[11px] font-medium text-slate-800">{companyPhone.value}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">(Standard)</span>
                    </div>
                )}

                {/* Contact Card (if mode is companies-contacts) */}
                {importType === "companies-contacts" && (
                    <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2.5 mb-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                {contactFullName ? (
                                    <p className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1">
                                        <span>{contactFullName}</span>
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">
                                        {contactFirstName.isMapped || contactLastName.isMapped
                                            ? "(Nom de contact vide sur cette ligne)"
                                            : "Contact non mappé"}
                                    </p>
                                )}
                                {contactTitle.value ? (
                                    <p className="text-[11px] text-slate-500 truncate">{contactTitle.value}</p>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">Poste non renseigné</p>
                                )}
                            </div>
                        </div>

                        {/* Contact Channels Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                            {/* Phone */}
                            {contactPhone.value ? (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-emerald-800 font-mono text-[11px] truncate">
                                    <PhoneCall className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                    <span className="truncate">{contactPhone.value}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-slate-400 text-[11px]">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">Tél. direct —</span>
                                </div>
                            )}

                            {/* Email */}
                            {contactEmail.value ? (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-50/70 border border-blue-200/70 text-blue-800 text-[11px] truncate">
                                    <Mail className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                    <span className="truncate" title={contactEmail.value}>
                                        {contactEmail.value}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-slate-400 text-[11px]">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">Email —</span>
                                </div>
                            )}
                        </div>

                        {/* LinkedIn */}
                        {contactLinkedin.value && (
                            <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50/50 border border-indigo-100 text-[10px] text-indigo-700 truncate">
                                <span className="font-bold text-[9px] bg-indigo-600 text-white px-1 rounded">in</span>
                                <span className="truncate">{contactLinkedin.value}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Custom Fields Section */}
                {customFields.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            Champs personnalisés ({customFields.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {customFields.map((cf, idx) => (
                                <span
                                    key={`${cf.label}-${idx}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-[10px] text-purple-700 font-medium"
                                    title={`Colonne CSV: ${cf.col}`}
                                >
                                    <span className="opacity-70">{cf.label}:</span>
                                    <span className="font-semibold truncate max-w-[120px]">
                                        {cf.value || "—"}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action History Simulation */}
                {importActions && (actionStatus || actionDate || actionNote) && (
                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-500" />
                            Historique importé
                        </p>
                        <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 space-y-0.5">
                            <div className="flex items-center justify-between font-medium">
                                <span>{actionStatus || "Action enregistrée"}</span>
                                <span className="text-[10px] text-amber-700">{actionDate || "Date N/A"}</span>
                            </div>
                            {actionNote && (
                                <p className="text-[11px] text-amber-800 italic truncate" title={actionNote}>
                                    &ldquo;{actionNote}&rdquo;
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* SDR Quick Actions Mock */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-[10px]">
                    <Info className="w-3 h-3 text-slate-400" />
                    Boutons SDR activés à l&apos;import :
                </span>
                <div className="flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${contactPhone.value || companyPhone.value ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400 opacity-60"}`}>
                        📞 Appel
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${contactEmail.value ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-400 opacity-60"}`}>
                        ✉️ Email
                    </span>
                </div>
            </div>
        </div>
    );
}
