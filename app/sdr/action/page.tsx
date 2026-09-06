"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Phone,
    Mail,
    Linkedin,
    Building2,
    User,
    Globe,
    Clock,
    Calendar,
    Sparkles,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Ban,
    Loader2,
    ExternalLink,
    RefreshCw,
    AlertCircle,
    Filter,
    RotateCcw,
    MessageSquare,
    SkipForward,
    History,
    PhoneCall,
    Eye,
    Copy,
    ArrowDownUp,
    PhoneOff,
    MailOpen,
    PenLine,
    BarChart2,
    Trash2,
    Send,
    ChevronDown,
} from "lucide-react";
import { Card, Badge, Button, LoadingState, EmptyState, Tabs, Drawer, DataTable, useToast, TableSkeleton, CardSkeleton, Modal, DateTimePicker } from "@/components/ui";
import type { Column } from "@/components/ui/DataTable";
import dynamic from "next/dynamic";
import { CompanyDrawer, ContactDrawer } from "@/components/drawers";
import { BookingDrawer } from "@/components/sdr/BookingDrawer";
import { AlloCallPickerModal } from "@/components/sdr/AlloCallPickerModal";
import { ScriptCompanionDrawer } from "@/components/sdr/ScriptCompanionDrawer";
import { QueueSummary } from "@/components/sdr/QueueSummary";
import { useSidebar } from "@/components/layout/SidebarProvider";

import { trackActionCreated, trackEvent, UMAMI_EVENTS } from "@/lib/analytics/umami";

const UnifiedActionDrawer = dynamic(
    () => import("@/components/drawers/UnifiedActionDrawer").then((m) => ({ default: m.UnifiedActionDrawer })),
    { ssr: false }
);
import { QuickEmailModal } from "@/components/email/QuickEmailModal";
import type { ActionResult, Channel } from "@/lib/types";
import { ACTION_RESULT_LABELS, CHANNEL_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    sdrActionQueueKey,
    sdrDrawerContactKey,
    sdrDrawerCompanyKey,
    sdrClientBookingKey,
} from "@/lib/query-keys";

// ============================================
// TYPES
// ============================================

interface AlloCallItem {
    id: string;
    from: string;
    to: string;
    duration: number;
    direction: 'INBOUND' | 'OUTBOUND';
    outcome?: string;
    summary?: string;
    recording_url?: string;
    transcript?: Array<{ source: string; text: string }>;
    created_at?: string;
    start_time?: string | number;
}

interface NextActionData {
    hasNext: boolean;
    message?: string;
    priority?: "CALLBACK" | "FOLLOW_UP" | "NEW" | "RETRY";
    missionName?: string;
    contact?: {
        id: string;
        firstName?: string;
        lastName?: string;
        title?: string;
        email?: string;
        phone?: string;
        linkedin?: string;
        status: string;
    } | null;
    company?: {
        id: string;
        name: string;
        industry?: string;
        website?: string;
        country?: string;
        phone?: string | null;
    };
    campaignId?: string;
    strategyName?: string | null;
    sourceListId?: string | null;
    sourceListName?: string | null;
    channel?: Channel;
    script?: string;
    scriptAdditional?: string;
    scriptAiEnhanced?: string;
    scriptDefaultTab?: "base" | "additional" | "ai";
    clientBookingUrl?: string;
    clientInterlocuteurs?: Array<{
        id: string; firstName: string; lastName: string; title?: string;
        emails: Array<{ value: string; label: string; isPrimary: boolean }>;
        phones: Array<{ value: string; label: string; isPrimary: boolean }>;
        bookingLinks: Array<{ label: string; url: string; durationMinutes: number }>;
        isActive: boolean;
    }>;
    lastAction?: {
        result: string;
        note?: string;
        createdAt: string;
        callbackDate?: string;
    };
    lastActionBy?: { id: string; name: string | null } | null;
}

interface Mission {
    id: string;
    name: string;
    channel: string;
    client: { name: string };
    defaultMailboxId?: string | null;
}

interface ListItem {
    id: string;
    name: string;
    mission: { id: string; name: string };
    contactsCount: number;
}

interface QueueItem {
    contactId: string | null;
    companyId: string;
    contact: NextActionData["contact"] | null;
    company: NonNullable<NextActionData["company"]>;
    campaignId: string;
    channel: string;
    missionName: string;
    lastAction: NextActionData["lastAction"] | null;
    lastActionBy?: { id: string; name: string | null } | null;
    priority: string;
    _displayName?: string;
    _companyName?: string;
    _phone?: string | null;
    _email?: string | null;
    _searchNote?: string | null;
}

interface DrawerContact {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    additionalPhones?: string[] | null;
    additionalEmails?: string[] | null;
    title: string | null;
    linkedin: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    companyId: string;
    companyName?: string;
    companyPhone?: string | null;
}

interface DrawerCompany {
    id: string;
    name: string;
    industry: string | null;
    country: string | null;
    website: string | null;
    size: string | null;
    phone: string | null;
    status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
    contacts: Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
        title: string | null;
        linkedin: string | null;
        status: "INCOMPLETE" | "PARTIAL" | "ACTIONABLE";
        companyId: string;
    }>;
    _count: { contacts: number };
}

// Fallback when config API not available
const RESULT_OPTIONS_FALLBACK: { value: ActionResult; label: string; icon: React.ReactNode; key: string; color: string }[] = [
    { value: "NO_RESPONSE", label: "Pas de réponse", icon: <XCircle className="w-4 h-4" />, key: "1", color: "slate" },
    { value: "BAD_CONTACT", label: "Mauvais contact", icon: <Ban className="w-4 h-4" />, key: "2", color: "red" },
    { value: "INTERESTED", label: "Intéressé", icon: <Sparkles className="w-4 h-4" />, key: "3", color: "emerald" },
    { value: "CALLBACK_REQUESTED", label: "Rappel demandé", icon: <Clock className="w-4 h-4" />, key: "4", color: "amber" },
    { value: "MEETING_BOOKED", label: "RDV pris", icon: <Calendar className="w-4 h-4" />, key: "5", color: "amber" },
    { value: "DISQUALIFIED", label: "Disqualifié", icon: <XCircle className="w-4 h-4" />, key: "6", color: "slate" },
    { value: "ENVOIE_MAIL", label: "Mail à envoyer", icon: <Mail className="w-4 h-4" />, key: "7", color: "amber" },
    { value: "MAIL_ENVOYE", label: "Mail envoyé", icon: <Send className="w-4 h-4" />, key: "8", color: "emerald" },
];

const RESULT_ICON_MAP: Record<string, React.ReactNode> = {
    NO_RESPONSE: <XCircle className="w-4 h-4" />,
    BAD_CONTACT: <Ban className="w-4 h-4" />,
    INTERESTED: <Sparkles className="w-4 h-4" />,
    CALLBACK_REQUESTED: <Clock className="w-4 h-4" />,
    MEETING_BOOKED: <Calendar className="w-4 h-4" />,
    MEETING_CANCELLED: <XCircle className="w-4 h-4" />,
    DISQUALIFIED: <XCircle className="w-4 h-4" />,
    ENVOIE_MAIL: <Mail className="w-4 h-4" />,
    MAIL_ENVOYE: <Send className="w-4 h-4" />,
    BARRAGE_STANDARD: <PhoneOff className="w-4 h-4" />,
    BARRAGE_SECRETAIRE: <PhoneOff className="w-4 h-4" />,
    NUMERO_KO: <PhoneOff className="w-4 h-4" />,
    FAUX_NUMERO: <PhoneOff className="w-4 h-4" />,
    INVALIDE: <Ban className="w-4 h-4" />,
    REFUS: <XCircle className="w-4 h-4" />,
    REFUS_ARGU: <XCircle className="w-4 h-4" />,
    REFUS_CATEGORIQUE: <XCircle className="w-4 h-4" />,
    RELANCE: <RotateCcw className="w-4 h-4" />,
    RAPPEL: <Clock className="w-4 h-4" />,
    PROJET_A_SUIVRE: <Sparkles className="w-4 h-4" />,
    MAUVAIS_INTERLOCUTEUR: <Ban className="w-4 h-4" />,
    MAIL_UNIQUEMENT: <Mail className="w-4 h-4" />,
    MAIL_DOC: <Mail className="w-4 h-4" />,
    HORS_CIBLE: <Ban className="w-4 h-4" />,
    GERE_PAR_SIEGE: <Building2 className="w-4 h-4" />,
    NOT_INTERESTED: <XCircle className="w-4 h-4" />,
    CONNECTION_SENT: <Linkedin className="w-4 h-4" />,
    MESSAGE_SENT: <Send className="w-4 h-4" />,
    REPLIED: <MessageSquare className="w-4 h-4" />,
};

const RESULT_SEMANTIC: Record<string, {
    iconCls: string; selectedCls: string; hoverCls: string; activeBorder: string;
}> = {
    NO_RESPONSE:        { iconCls: "bg-slate-100 text-slate-500",   selectedCls: "bg-slate-50 border-slate-400",      hoverCls: "hover:border-slate-300 hover:bg-slate-50",     activeBorder: "border-l-slate-400" },
    BAD_CONTACT:        { iconCls: "bg-red-100 text-red-500",       selectedCls: "bg-red-50 border-red-400",          hoverCls: "hover:border-red-200 hover:bg-red-50/60",      activeBorder: "border-l-red-400" },
    INTERESTED:         { iconCls: "bg-emerald-100 text-emerald-600", selectedCls: "bg-emerald-50 border-emerald-400", hoverCls: "hover:border-emerald-200 hover:bg-emerald-50/60", activeBorder: "border-l-emerald-500" },
    CALLBACK_REQUESTED: { iconCls: "bg-amber-100 text-amber-600",   selectedCls: "bg-amber-50 border-amber-400",      hoverCls: "hover:border-amber-200 hover:bg-amber-50/60",  activeBorder: "border-l-amber-400" },
    RELANCE:            { iconCls: "bg-amber-100 text-amber-600",   selectedCls: "bg-amber-50 border-amber-400",      hoverCls: "hover:border-amber-200 hover:bg-amber-50/60",  activeBorder: "border-l-amber-400" },
    RAPPEL:             { iconCls: "bg-amber-100 text-amber-600",   selectedCls: "bg-amber-50 border-amber-400",      hoverCls: "hover:border-amber-200 hover:bg-amber-50/60",  activeBorder: "border-l-amber-400" },
    MEETING_BOOKED:     { iconCls: "bg-[rgba(255,158,27,0.12)] text-[var(--elan-petrol)]", selectedCls: "bg-[rgba(255,158,27,0.1)] border-[rgba(224,124,0,0.24)]", hoverCls: "hover:border-[rgba(224,124,0,0.2)] hover:bg-[rgba(255,158,27,0.12)]", activeBorder: "border-l-[var(--elan-amber-deep)]" },
    MEETING_CANCELLED:  { iconCls: "bg-slate-100 text-slate-500",   selectedCls: "bg-slate-50 border-slate-400",      hoverCls: "hover:border-slate-300 hover:bg-slate-50",     activeBorder: "border-l-slate-400" },
    DISQUALIFIED:       { iconCls: "bg-slate-100 text-slate-500",   selectedCls: "bg-slate-100 border-slate-400",     hoverCls: "hover:border-slate-300 hover:bg-slate-100/60", activeBorder: "border-l-slate-400" },
    ENVOIE_MAIL:        { iconCls: "bg-[rgba(12,59,56,0.1)] text-[var(--elan-petrol)]",     selectedCls: "bg-[rgba(12,59,56,0.06)] border-[rgba(12,59,56,0.22)]",        hoverCls: "hover:border-[rgba(12,59,56,0.18)] hover:bg-[rgba(12,59,56,0.08)]",    activeBorder: "border-l-[#25745f]" },
    MAIL_ENVOYE:        { iconCls: "bg-emerald-100 text-emerald-600", selectedCls: "bg-emerald-50 border-emerald-400", hoverCls: "hover:border-emerald-200 hover:bg-emerald-50/60", activeBorder: "border-l-emerald-500" },
};
const DEFAULT_SEMANTIC = { iconCls: "bg-[rgba(255,158,27,0.12)] text-[var(--elan-petrol)]", selectedCls: "bg-[rgba(255,158,27,0.1)] border-[rgba(224,124,0,0.24)]", hoverCls: "hover:border-[rgba(224,124,0,0.2)] hover:bg-[rgba(255,158,27,0.12)]", activeBorder: "border-l-[var(--elan-amber-deep)]" };

const getInitials = (firstName?: string | null, lastName?: string | null, fallback?: string | null): string => {
    const f = firstName?.trim() || "";
    const l = lastName?.trim() || "";
    if (f || l) return `${f[0] || ""}${l[0] || ""}`.toUpperCase();
    return (fallback?.trim()[0] || "?").toUpperCase();
};

const TABLE_QUEUE_LIMIT = 120;
const STATS_QUEUE_LIMIT = 250;

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
    ABSENT_RDV: { label: "⚠ RDV Absent", color: "bg-red-100 text-red-800 border-red-300 font-bold animate-pulse" },
    CALLBACK: { label: "Rappel", color: "bg-amber-50 text-amber-700 border-amber-200" },
    FOLLOW_UP: { label: "Suivi", color: "bg-[rgba(12,59,56,0.08)] text-[var(--elan-petrol)] border-[rgba(12,59,56,0.18)]" },
    NEW: { label: "Nouveau", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    RETRY: { label: "Relance", color: "bg-slate-50 text-slate-700 border-slate-200" },
};

const STATUS_HOVER_HINTS: Record<string, string> = {
    RELANCE: "Rappel demandé\nLe prospect attend ton appel\nIl y a un signal d'intérêt",
    RAPPEL: "Rappel à faire\nLe prospect n'a pas encore été joint\nC'est un rappel logistique, pas commercial",
};

const SCRIPT_TABS = [
    { id: "base", label: "Script de base" },
    { id: "additional", label: "Script additionel" },
    { id: "ai", label: "Script amélioré par IA" },
];

// Stats modal body: summary + list of contacts with status (for Actions page)
function ActionStatsModalBody({
    items,
    loading,
    statusLabels,
    onRowClick,
    priorityLabels,
    resultIconMap,
    queueRowKey,
}: {
    items: QueueItem[];
    loading: boolean;
    statusLabels: Record<string, string>;
    onRowClick: (row: QueueItem) => void;
    priorityLabels: Record<string, { label: string; color: string }>;
    resultIconMap: Record<string, React.ReactNode>;
    queueRowKey: (row: QueueItem) => string;
}) {
    const byStatus = useMemo(() => {
        const map: Record<string, number> = {};
        items.forEach((row) => {
            const key = row.lastAction?.result ?? "NONE";
            map[key] = (map[key] ?? 0) + 1;
        });
        return map;
    }, [items]);
    const byPriority = useMemo(() => {
        const map: Record<string, number> = {};
        items.forEach((row) => {
            const key = row.priority ?? "";
            map[key] = (map[key] ?? 0) + 1;
        });
        return map;
    }, [items]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--elan-amber)]" />
            </div>
        );
    }
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] p-3">
                    <p className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide">Total</p>
                    <p className="text-[24px] font-[500] text-[#1a1a1a] tabular-nums">{items.length}</p>
                </div>
                {Object.entries(priorityLabels).map(([key, { label, color }]) => (
                    <div key={key} className={cn("rounded-xl border p-3", color)}>
                        <p className="text-[11px] font-[500] uppercase tracking-wide opacity-80">{label}</p>
                        <p className="text-[24px] font-[500] tabular-nums">{byPriority[key] ?? 0}</p>
                    </div>
                ))}
            </div>
            <div>
                <h4 className="text-[11px] font-[500] uppercase tracking-wide text-slate-400 mb-2">Par statut</h4>
                <div className="flex flex-wrap gap-1.5">
                    <Badge className="bg-[#f5f5f5] text-slate-600 border-[#e5e5e5] text-[12px]">Jamais contacté: {byStatus["NONE"] ?? 0}</Badge>
                    {Object.entries(statusLabels).map(([key, label]) => (
                        <Badge key={key} className="bg-[#f5f5f5] text-slate-600 border-[#e5e5e5] text-[12px]">{label}: {byStatus[key] ?? 0}</Badge>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Tous les contacts</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                    {items.length === 0 ? (
                        <p className="text-center py-8 text-slate-500 text-sm">Aucun contact dans cette vue.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr>
                                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Contact / Société</th>
                                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Statut</th>
                                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Priorité</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((row) => {
                                    const name = row._displayName ?? (row.contact ? `${row.contact.firstName ?? ""} ${row.contact.lastName ?? ""}`.trim() || row.company.name : row.company.name);
                                    const status = row.lastAction ? (statusLabels[row.lastAction.result] ?? row.lastAction.result) : "Jamais contacté";
                                    const pri = priorityLabels[row.priority];
                                    const isAbsent = row.priority === "ABSENT_RDV";
                                    return (
                                        <tr
                                            key={queueRowKey(row)}
                                            onClick={() => onRowClick(row)}
                                            className={cn(
                                                "border-b last:border-0 cursor-pointer transition-colors",
                                                isAbsent
                                                    ? "bg-red-50 border-red-100 hover:bg-red-100/80"
                                                    : "border-slate-100 hover:bg-[rgba(255,158,27,0.08)]"
                                            )}
                                        >
                                            <td className="py-2.5 px-3">
                                                <span className="font-medium text-slate-900">{name}</span>
                                                {row._companyName && row._companyName !== name && (
                                                    <span className="text-slate-500 text-xs block">{row._companyName}</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {row.lastAction ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        {resultIconMap[row.lastAction.result]}
                                                        {status}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Jamais contacté</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {pri ? <Badge className={cn("text-xs", pri.color)}>{pri.label}</Badge> : row.priority}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SDRActionPage() {
    const { setCollapsed } = useSidebar();
    const { data: session } = useSession();
    const { success, error: showError } = useToast();
    const [currentAction, setCurrentAction] = useState<NextActionData | null>(null);
    const [selectedResult, setSelectedResult] = useState<ActionResult | null>(null);
    const [note, setNote] = useState("");
    /** For CALLBACK_REQUESTED: date/time from calendar (YYYY-MM-DDTHH:mm for datetime-local). */
    const [callbackDateValue, setCallbackDateValue] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [actionsCompleted, setActionsCompleted] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const nextActionAbortRef = useRef<AbortController | null>(null);
    const refreshQueueAbortRef = useRef<AbortController | null>(null);
    const [isSyncingCalls, setIsSyncingCalls] = useState(false);
    const [syncResult, setSyncResult] = useState<{ enriched: number; total: number } | null>(null);

    // Allo call picker dialog
    const [alloDialogOpen, setAlloDialogOpen] = useState(false);
    const [alloDialogCalls, setAlloDialogCalls] = useState<AlloCallItem[]>([]);
    const [alloDialogLoading, setAlloDialogLoading] = useState(false);
    const [alloDialogSelectedId, setAlloDialogSelectedId] = useState<string | null>(null);
    const [alloDialogFilterPhone, setAlloDialogFilterPhone] = useState("");
    const [alloDialogAlloLineCount, setAlloDialogAlloLineCount] = useState<number | null>(null);
    const [linkedAlloCall, setLinkedAlloCall] = useState<AlloCallItem | null>(null);

    const [missions, setMissions] = useState<Mission[]>([]);
    const [lists, setLists] = useState<ListItem[]>([]);
    const [todayBlocksData, setTodayBlocksData] = useState<{
        todayBlocks: Array<{ id: string; startTime: string; endTime: string; mission: { id: string; name: string; channel: string } }>;
        todayMissionIds: string[];
        weekBlocks: Array<{ id: string; date: string; startTime: string; endTime: string; mission: { id: string; name: string; channel: string } }>;
        hasBlocksToday: boolean;
    } | null>(null);
    const [todayBlocksLoading, setTodayBlocksLoading] = useState(true);
    const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
    const [selectedListId, setSelectedListIdState] = useState<string | null>(null);
    const setSelectedListId = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
        setSelectedListIdState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (typeof window !== "undefined") {
                if (next) localStorage.setItem("sdr_selected_list", next);
                else localStorage.removeItem("sdr_selected_list");
            }
            return next;
        });
    }, []);
    const [viewType, setViewTypeState] = useState<"all" | "companies" | "contacts">(() =>
        (typeof window !== "undefined" && (localStorage.getItem("sdr_view_type") as "all" | "companies" | "contacts") in { all: 1, companies: 1, contacts: 1 })
            ? (localStorage.getItem("sdr_view_type") as "all" | "companies" | "contacts")
            : "contacts"
    );
    const setViewType = useCallback((value: "all" | "companies" | "contacts" | ((prev: "all" | "companies" | "contacts") => "all" | "companies" | "contacts")) => {
        setViewTypeState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (typeof window !== "undefined") localStorage.setItem("sdr_view_type", next);
            return next;
        });
    }, []);
    const [activeTab, setActiveTab] = useState<string>("base");
    const [showBookingDrawer, setShowBookingDrawer] = useState(false);
    const [unifiedBookingDialogOpen, setUnifiedBookingDialogOpen] = useState(false);
    const [unifiedAlloDialogOpen, setUnifiedAlloDialogOpen] = useState(false);
    const [rdvDate, setRdvDate] = useState("");
    const [meetingCat, setMeetingCat] = useState<"EXPLORATOIRE" | "BESOIN" | "">("");

    // View mode: card vs table — persisted in localStorage
    const [viewMode, setViewModeState] = useState<"card" | "table">(() =>
        (typeof window !== "undefined" && localStorage.getItem("sdr_view_mode") === "card") ? "card" : "table"
    );
    const setViewMode = useCallback((value: "card" | "table" | ((prev: "card" | "table") => "card" | "table")) => {
        setViewModeState((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (typeof window !== "undefined") localStorage.setItem("sdr_view_mode", next);
            return next;
        });
    }, []);
    // Mission search: server-side search so contacts can be filtered by name
    const [tableSearchInput, setTableSearchInput] = useState("");
    const [tableSearchApi, setTableSearchApi] = useState("");
    const queryClient = useQueryClient();
    const queueQueryKey = sdrActionQueueKey(selectedMissionId, selectedListId, tableSearchApi);
    const mapQueueItems = useCallback((items: QueueItem[]) =>
        items.map((i) => ({
            ...i,
            _displayName: i.contact
                ? `${(i.contact.firstName || "").trim()} ${(i.contact.lastName || "").trim()}`.trim() || i.company.name
                : i.company.name,
            _companyName: i.company.name,
            _phone: i.contact?.phone || i.company?.phone || null,
            _email: i.contact?.email || null,
            _searchNote: i.lastAction?.note ?? null,
        })), []);
    const {
        data: queueItems = [],
        isLoading: queueInitialLoading,
        error: queueFetchError,
    } = useQuery({
        queryKey: queueQueryKey,
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("missionId", selectedMissionId!);
            params.set("limit", String(TABLE_QUEUE_LIMIT));
            if (selectedListId) params.set("listId", selectedListId);
            if (tableSearchApi) params.set("search", tableSearchApi);
            const res = await fetch(`/api/sdr/action-queue?${params.toString()}`);
            const json = await res.json();
            if (!json.success || !json.data?.items) throw new Error(json.error || "Impossible de charger la file d'actions");
            return mapQueueItems(json.data.items as QueueItem[]);
        },
        enabled: viewMode === "table" && selectedMissionId !== null,
    });
    const queueFetchErrorMsg = queueFetchError ? (queueFetchError as Error).message : null;
    const [submittingRowKey, setSubmittingRowKey] = useState<string | null>(null);
    // Table view multi-select for bulk delete (disqualify)
    const [tableSelectedIds, setTableSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDisqualifying, setIsBulkDisqualifying] = useState(false);

    // Table view filters (client-side on current queue)
    const [tableFilterResult, setTableFilterResult] = useState<string>(""); // "" | ActionResult | "NONE" (no last action)
    const [tableFilterPriority, setTableFilterPriority] = useState<string>("");
    const [tableFilterChannel, setTableFilterChannel] = useState<string>("");
    const [tableFilterType, setTableFilterType] = useState<string>("contact"); // "" | "contact" | "company" — default to contacts in table view
    const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

    // Stats modal (table + card view): view stats and list of contacts with status
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsQueueItems, setStatsQueueItems] = useState<QueueItem[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);

    // Drawer for table view (contact/company fiche)
    const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
    const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);
    const { data: drawerContact = null, isFetching: drawerContactLoading } = useQuery({
        queryKey: sdrDrawerContactKey(drawerContactId),
        queryFn: async () => {
            const res = await fetch(`/api/contacts/${drawerContactId}`);
            const json = await res.json();
            if (!json.success || !json.data) throw new Error(json.error || "Impossible de charger le contact");
            const c = json.data;
            return {
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone,
                additionalPhones: c.additionalPhones ?? undefined,
                additionalEmails: c.additionalEmails ?? undefined,
                title: c.title,
                linkedin: c.linkedin,
                status: (c.status ?? "PARTIAL") as DrawerContact["status"],
                companyId: c.company?.id ?? "",
                companyName: c.company?.name ?? undefined,
                companyPhone: c.company?.phone ?? undefined,
            } as DrawerContact;
        },
        enabled: !!drawerContactId,
    });
    const { data: drawerCompany = null, isFetching: drawerCompanyLoading } = useQuery({
        queryKey: sdrDrawerCompanyKey(drawerCompanyId),
        queryFn: async () => {
            const res = await fetch(`/api/companies/${drawerCompanyId}`);
            const json = await res.json();
            if (!json.success || !json.data) throw new Error(json.error || "Impossible de charger la société");
            const co = json.data;
            return {
                id: co.id,
                name: co.name,
                industry: co.industry,
                country: co.country,
                website: co.website,
                size: co.size,
                phone: co.phone,
                status: (co.status ?? "PARTIAL") as DrawerCompany["status"],
                contacts: (co.contacts ?? []).map((ct: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; title: string | null; linkedin: string | null; status: string; companyId: string }) => ({
                    id: ct.id,
                    firstName: ct.firstName,
                    lastName: ct.lastName,
                    email: ct.email,
                    phone: ct.phone,
                    title: ct.title,
                    linkedin: ct.linkedin,
                    status:
                        ct.status === "INCOMPLETE" || ct.status === "PARTIAL" || ct.status === "ACTIONABLE"
                            ? ct.status
                            : "PARTIAL",
                    companyId: ct.companyId,
                })),
                _count: { contacts: co._count?.contacts ?? co.contacts?.length ?? 0 },
            } as DrawerCompany;
        },
        enabled: !!drawerCompanyId,
    });
    const drawerLoading = drawerContactLoading || drawerCompanyLoading;

    // Quick Email Modal state
    const [showQuickEmailModal, setShowQuickEmailModal] = useState(false);
    const [emailModalContact, setEmailModalContact] = useState<{
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        title?: string | null;
        company?: { id: string; name: string };
    } | null>(null);
    const [emailModalMissionId, setEmailModalMissionId] = useState<string | null>(null);
    const [emailModalMissionName, setEmailModalMissionName] = useState<string | null>(null);
    const [emailModalCompany, setEmailModalCompany] = useState<{ id: string; name: string; phone?: string | null } | null>(null);
    const [pendingEmailAction, setPendingEmailAction] = useState<{ row: QueueItem; result: ActionResult } | { cardMode: true; result: ActionResult } | null>(null);
    // Queue: "Mail à envoyer" choice modal — note only vs open email composer
    const [showMailToSendChoiceModal, setShowMailToSendChoiceModal] = useState(false);
    const [mailToSendChoiceRow, setMailToSendChoiceRow] = useState<QueueItem | null>(null);
    const [mailToSendChoiceNote, setMailToSendChoiceNote] = useState("");

    // Config-driven status options (from API)
    const [statusConfig, setStatusConfig] = useState<{
        statuses: Array<{
            code: string;
            label: string;
            color: string | null;
            requiresNote: boolean;
            triggersCallback?: boolean;
        }>;
    } | null>(null);

    // Load filters + today-blocks
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;
        const loadFilters = async () => {
            try {
                const [missionsRes, listsRes, todayRes] = await Promise.all([
                    fetch("/api/sdr/missions", { signal }),
                    fetch("/api/sdr/lists", { signal }),
                    fetch("/api/sdr/today-blocks", { signal }),
                ]);
                if (signal.aborted) return;
                const missionsJson = await missionsRes.json();
                const listsJson = await listsRes.json();
                const todayJson = await todayRes.json();
                if (signal.aborted) return;

                if (todayJson.success) {
                    setTodayBlocksData(todayJson.data);
                }
                setTodayBlocksLoading(false);

                if (missionsJson.success) {
                    const allMissions: Mission[] = missionsJson.data;
                    setMissions(allMissions);

                    const saved = localStorage.getItem("sdr_selected_mission");
                    const allowedMissionIds = (() => {
                        if (!todayJson.success || !todayJson.data) return new Set(allMissions.map((m: Mission) => m.id));
                        const planningData = todayJson.data as {
                            hasBlocksToday: boolean;
                            todayMissionIds: string[];
                            weekBlocks: Array<{ mission: { id: string } }>;
                        };
                        if (planningData.hasBlocksToday && planningData.todayMissionIds.length > 0) {
                            return new Set(planningData.todayMissionIds);
                        }
                        const weekIds = planningData.weekBlocks.map((b) => b.mission.id);
                        return weekIds.length > 0 ? new Set(weekIds) : new Set<string>();
                    })();
                    const availableMissions = allMissions.filter((m: Mission) => allowedMissionIds.has(m.id));
                    const missionId = (saved && availableMissions.some((m: Mission) => m.id === saved))
                        ? saved
                        : availableMissions.length > 0
                            ? availableMissions[0].id
                            : null;
                    if (missionId) setSelectedMissionId(missionId);
                    if (listsJson.success && missionId) {
                        const listsForMission = (listsJson.data as ListItem[]).filter((l) => l.mission.id === missionId);
                        const savedList = typeof window !== "undefined" ? localStorage.getItem("sdr_selected_list") : null;
                        if (savedList && listsForMission.some((l) => l.id === savedList)) {
                            setSelectedListId(savedList);
                        } else if (listsForMission.length > 0) {
                            setSelectedListId(listsForMission[0].id);
                        }
                    }
                }
                if (listsJson.success) {
                    setLists(listsJson.data);
                }
            } catch (err) {
                if ((err as Error).name === "AbortError") return;
                console.error("Failed to load filters:", err);
                showError("Impossible de charger les missions et listes");
                setTodayBlocksLoading(false);
            }
        };
        loadFilters();
        return () => controller.abort();
    }, [showError]);

    useEffect(() => {
        const allowedMissionIds = (() => {
            if (!todayBlocksData) return null;
            if (todayBlocksData.hasBlocksToday && todayBlocksData.todayMissionIds.length > 0) {
                return new Set(todayBlocksData.todayMissionIds);
            }
            const weekIds = todayBlocksData.weekBlocks.map((block) => block.mission.id);
            if (weekIds.length > 0) return new Set(weekIds);
            return new Set<string>();
        })();

        const availableMissions = allowedMissionIds
            ? missions.filter((mission) => allowedMissionIds.has(mission.id))
            : missions;

        if (selectedMissionId && availableMissions.some((m) => m.id === selectedMissionId)) return;
        if (availableMissions.length === 0) {
            setSelectedMissionId(null);
            setSelectedListId(null);
            return;
        }

        const nextMissionId = availableMissions[0].id;
        setSelectedMissionId(nextMissionId);
        const firstList = lists.find((l) => l.mission.id === nextMissionId);
        setSelectedListId(firstList?.id ?? null);
    }, [selectedMissionId, missions, todayBlocksData, lists, setSelectedListId]);

    // Fetch status config: global on mount, mission-specific when mission selected
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;
        const url = selectedMissionId
            ? `/api/config/action-statuses?missionId=${selectedMissionId}`
            : `/api/config/action-statuses`;
        fetch(url, { signal })
            .then((res) => res.json())
            .then((json) => {
                if (signal.aborted) return;
                if (json.success && json.data?.statuses?.length) {
                    setStatusConfig({ statuses: json.data.statuses });
                }
            })
            .catch((err) => {
                if ((err as Error).name === "AbortError") return;
                console.error("Failed to load status config:", err);
            });
        return () => controller.abort();
    }, [selectedMissionId]);

    const resultOptions = statusConfig?.statuses?.length
        ? statusConfig.statuses.map((s, i) => ({
            value: s.code as ActionResult,
            label: s.label,
            icon: RESULT_ICON_MAP[s.code] ?? <XCircle className="w-4 h-4" />,
            key: String(i + 1),
            color: ["slate", "red", "emerald", "amber", "amber", "slate", "emerald"][i % 7] as string,
        }))
        : RESULT_OPTIONS_FALLBACK;

    const statusLabels: Record<string, string> = statusConfig?.statuses?.length
        ? Object.fromEntries(statusConfig.statuses.map((s) => [s.code, s.label]))
        : ACTION_RESULT_LABELS;

    const callbackResultCodes = useMemo(() => {
        const defaults = ["CALLBACK_REQUESTED", "RAPPEL", "RELANCE"];
        if (!statusConfig?.statuses?.length) {
            return new Set<string>(defaults);
        }
        const configured = statusConfig.statuses
            .filter((s) => {
                if (s.triggersCallback === true) return true;
                const haystack = `${s.code} ${s.label}`.toUpperCase();
                return haystack.includes("RAPPEL") || haystack.includes("RELANCE");
            })
            .map((s) => s.code);
        return new Set<string>([...defaults, ...configured]);
    }, [statusConfig]);

    const isCallbackResult = useCallback((code: string | null | undefined) => {
        if (!code) return false;
        return callbackResultCodes.has(code);
    }, [callbackResultCodes]);

    const handlePhoneCallAttempt = useCallback((
        e: React.MouseEvent,
        phone: string,
        context?: {
            lastAction?: { result: string; note?: string; createdAt?: string } | null;
            lastActionBy?: { id: string; name: string | null } | null;
        }
    ) => {
        e.preventDefault();
        e.stopPropagation();
        const contactedByOther =
            !!context?.lastAction &&
            !!context?.lastActionBy?.id &&
            context.lastActionBy.id !== session?.user?.id;

        if (contactedByOther) {
            const lastStatus = statusLabels[context?.lastAction?.result || ""] ?? context?.lastAction?.result ?? "Inconnu";
            const lastNote = context?.lastAction?.note?.trim() || "Aucune note";
            const byName = context?.lastActionBy?.name || "un autre SDR";
            const confirmMessage =
                `Ce prospect est en cours de contact par un autre SDR (${byName}).\n\n` +
                `Dernier statut: ${lastStatus}\n` +
                `Dernière note: ${lastNote}\n\n` +
                `Voulez-vous quand même appeler ?`;
            const accepted = window.confirm(confirmMessage);
            if (!accepted) return;
        }
        window.location.href = `tel:${phone}`;
    }, [session?.user?.id, statusLabels]);

    const getRequiresNote = useCallback((code: string) =>
        statusConfig?.statuses?.find((s) => s.code === code)?.requiresNote ??
        ["INTERESTED", "CALLBACK_REQUESTED", "ENVOIE_MAIL"].includes(code)
        , [statusConfig]);

    const selectableMissionIds = useMemo(() => {
        if (!todayBlocksData) return null;
        if (todayBlocksData.hasBlocksToday && todayBlocksData.todayMissionIds.length > 0) {
            return new Set(todayBlocksData.todayMissionIds);
        }
        const weekIds = todayBlocksData.weekBlocks.map((block) => block.mission.id);
        if (weekIds.length > 0) return new Set(weekIds);
        return new Set<string>();
    }, [todayBlocksData]);

    const selectableMissions = useMemo(() => {
        if (!selectableMissionIds) return missions;
        return missions.filter((mission) => selectableMissionIds.has(mission.id));
    }, [missions, selectableMissionIds]);

    const filteredLists = selectedMissionId
        ? lists.filter((l) => l.mission.id === selectedMissionId)
        : lists;

    // Table view: client-side filtered queue (by last action result, priority, channel, type)
    const filteredQueueItems = useMemo(() => {
        return queueItems.filter((row) => {
            if (tableFilterResult) {
                if (tableFilterResult === "NONE") {
                    if (row.lastAction) return false;
                } else if (!row.lastAction || row.lastAction.result !== tableFilterResult) return false;
            }
            if (tableFilterPriority && row.priority !== tableFilterPriority) return false;
            if (tableFilterChannel && row.channel !== tableFilterChannel) return false;
            if (tableFilterType === "contact" && !row.contactId) return false;
            if (tableFilterType === "company" && row.contactId) return false;
            return true;
        });
    }, [queueItems, tableFilterResult, tableFilterPriority, tableFilterChannel, tableFilterType]);

    const hasTableFiltersActive = !!(tableFilterResult || tableFilterPriority || tableFilterChannel || tableFilterType);
    const urgentCallbackCount = useMemo(() => {
        const withinOneDay = Date.now() + 24 * 60 * 60 * 1000;
        return queueItems.filter((row) => {
            if (!row.lastAction || !isCallbackResult(row.lastAction.result) || !row.lastAction.callbackDate) return false;
            const timestamp = new Date(row.lastAction.callbackDate).getTime();
            return Number.isFinite(timestamp) && timestamp <= withinOneDay;
        }).length;
    }, [queueItems, isCallbackResult]);
    const untouchedCount = useMemo(() => queueItems.filter((row) => !row.lastAction).length, [queueItems]);
    const clearTableFilters = () => {
        setTableFilterResult("");
        setTableFilterPriority("");
        setTableFilterChannel("");
        setTableFilterType("");
    };

    // Why is the table empty? (so SDR/BD see a clear reason instead of a generic empty message)
    const emptyTableReason = useMemo((): { title: string; description: string; icon: typeof AlertCircle } => {
        if (missions.length === 0) {
            return {
                icon: AlertCircle,
                title: "Aucune mission active",
                description: "Vous n'avez aucune mission active assignée. Contactez votre manager pour être assigné à une mission et voir la file d'actions.",
            };
        }
        if (selectableMissions.length === 0) {
            return {
                icon: AlertCircle,
                title: "Aucune mission planifiée",
                description: "Vous ne pouvez travailler que sur vos missions planifiées (aujourd'hui ou cette semaine).",
            };
        }
        if (!selectedMissionId) {
            return {
                icon: AlertCircle,
                title: "Sélectionnez une mission",
                description: "Choisissez une mission dans le filtre ci-dessus pour afficher la file d'actions (contacts à appeler, contacter par email ou LinkedIn).",
            };
        }
        if (filteredLists.length === 0) {
            return {
                icon: AlertCircle,
                title: "Cette mission n'a pas de listes",
                description: "Aucune liste n'est associée à cette mission (ou les listes ne sont pas encore chargées). Demandez à votre manager d'ajouter des listes avec des sociétés et contacts.",
            };
        }
        if (tableSearchApi && queueItems.length === 0) {
            return {
                icon: AlertCircle,
                title: "Aucun résultat pour cette recherche",
                description: `Aucun contact ou société ne correspond à « ${tableSearchApi} ». Modifiez la recherche dans le filtre ci-dessus ou videz le champ pour voir toute la file.`,
            };
        }
        if (hasTableFiltersActive && queueItems.length > 0 && filteredQueueItems.length === 0) {
            return {
                icon: Filter,
                title: "Aucun contact ne correspond aux filtres",
                description: "Les filtres (statut, priorité, canal ou type) excluent tous les contacts. Cliquez sur « Réinitialiser » dans la zone Filtres pour tout réafficher.",
            };
        }
        if (queueItems.length === 0) {
            return {
                icon: AlertCircle,
                title: "File vide pour cette mission / liste",
                description: "Aucun contact ou société éligible. Vérifiez : (1) La mission a au moins une campagne active. (2) La liste est active (onglet BDD du manager). (3) Les sociétés ont les informations requises pour le canal : téléphone pour Appel, email pour Email et profil pour LinkedIn. Les sociétés sans contact n'apparaissent en Appel que si elles ont un téléphone. (4) Vous êtes bien assigné à la mission.",
            };
        }
        return {
            icon: AlertCircle,
            title: "Aucun contact affiché",
            description: "Aucun contact ne correspond aux critères actuels. Réinitialisez les filtres ou la recherche.",
        };
    }, [missions.length, selectableMissions.length, selectedMissionId, filteredLists.length, tableSearchApi, hasTableFiltersActive, queueItems.length, filteredQueueItems.length]);

    // Debounce mission search so we don't refetch on every keystroke
    useEffect(() => {
        if (!tableSearchInput.trim()) {
            setTableSearchApi("");
            return;
        }
        const t = setTimeout(() => setTableSearchApi(tableSearchInput.trim()), 400);
        return () => clearTimeout(t);
    }, [tableSearchInput]);

    // Load next action
    const loadNextAction = useCallback(async () => {
        nextActionAbortRef.current?.abort();
        const controller = new AbortController();
        nextActionAbortRef.current = controller;
        const signal = controller.signal;

        setIsLoading(true);
        setError(null);
        setSelectedResult(null);
        setNote("");
        setCallbackDateValue("");
        setMeetingCat("");
        setShowSuccess(false);
        setElapsedTime(0);
        setActiveTab("base");
        setLinkedAlloCall(null);
        setAlloDialogOpen(false);
        setAlloDialogCalls([]);
        setAlloDialogSelectedId(null);

        try {
            const params = new URLSearchParams();
            if (selectedMissionId) params.set("missionId", selectedMissionId);
            if (selectedListId) params.set("listId", selectedListId);

            const res = await fetch(`/api/actions/next?${params.toString()}`, { signal });
            const json = await res.json();
            if (signal.aborted) return;

            if (!json.success) {
                setError(json.error || "Erreur lors du chargement");
                setCurrentAction(null);
            } else {
                setCurrentAction(json.data);
                const preferredTab = json.data?.scriptDefaultTab;
                if (preferredTab === "additional" || preferredTab === "ai" || preferredTab === "base") {
                    setActiveTab(preferredTab);
                }
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
            }
        } catch (err) {
            if ((err as Error).name === "AbortError") return;
            setError("Erreur de connexion");
            setCurrentAction(null);
        } finally {
            if (!signal.aborted) setIsLoading(false);
            if (nextActionAbortRef.current === controller) nextActionAbortRef.current = null;
        }
    }, [selectedMissionId, selectedListId]);

    useEffect(() => {
        if (selectedMissionId !== null) loadNextAction();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [selectedMissionId, selectedListId, loadNextAction]);

    useEffect(() => {
        if (!currentAction?.campaignId) return;
        const controller = new AbortController();
        fetch(`/api/campaigns/${currentAction.campaignId}/script-companion`, { signal: controller.signal })
            .then((res) => res.json())
            .then((json) => {
                if (!json?.success) return;
                setCurrentAction((prev) => {
                    if (!prev || prev.campaignId !== currentAction.campaignId) return prev;
                    return {
                        ...prev,
                        scriptAdditional: json.data?.additionalShared ?? prev.scriptAdditional,
                        scriptAiEnhanced: json.data?.aiShared ?? prev.scriptAiEnhanced,
                        scriptDefaultTab: json.data?.defaultTab ?? prev.scriptDefaultTab,
                    };
                });
                const preferredTab = json.data?.defaultTab;
                if (preferredTab === "base" || preferredTab === "additional" || preferredTab === "ai") {
                    setActiveTab(preferredTab);
                }
            })
            .catch(() => {
                // best effort only
            });
        return () => controller.abort();
    }, [currentAction?.campaignId]);

    const queueRowKey = (row: QueueItem) => row.contactId ?? row.companyId;

    // Recently updated row keys (highlight in table after status update in drawer)
    const [recentlyUpdatedRowKeys, setRecentlyUpdatedRowKeys] = useState<Set<string>>(new Set());
    const recentlyUpdatedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => () => {
        if (recentlyUpdatedTimeoutRef.current) clearTimeout(recentlyUpdatedTimeoutRef.current);
    }, []);

    // Refetch queue (table view) — invalidate so React Query refetches
    const refreshQueue = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queueQueryKey });
    }, [queryClient, queueQueryKey]);

    const handleSyncCalls = useCallback(async () => {
        if (isSyncingCalls) return;
        setIsSyncingCalls(true);
        setSyncResult(null);
        try {
            const res = await fetch('/api/sdr/calls/sync', { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                const { enriched, total } = json.data;
                setSyncResult({ enriched, total });
                if (enriched > 0) {
                    success("Appels synchronisés", `${enriched} appel${enriched > 1 ? 's' : ''} enrichi${enriched > 1 ? 's' : ''} (résumé, transcription, audio).`);
                } else if (total === 0) {
                    success("Déjà à jour", "Aucun appel récent à synchroniser.");
                } else {
                    success("Synchronisation terminée", `${total} appel${total > 1 ? 's' : ''} analysé${total > 1 ? 's' : ''}. Aucune correspondance Allo trouvée.`);
                }
                refreshQueue();
            } else {
                showError("Erreur de synchronisation", json.error ?? "Impossible de contacter Allo.");
            }
        } catch {
            showError("Erreur réseau", "La synchronisation a échoué.");
        } finally {
            setIsSyncingCalls(false);
        }
    }, [isSyncingCalls, refreshQueue, success, showError]);

    const openAlloDialog = useCallback(async () => {
        const phone =
            currentAction?.contact?.phone ||
            (currentAction?.channel === "CALL" && currentAction?.company?.phone
                ? currentAction.company.phone
                : null);
        if (!phone) {
            showError("Numéro manquant", "Aucun numéro de téléphone trouvé pour ce contact.");
            return;
        }
        setAlloDialogFilterPhone(phone);
        setAlloDialogAlloLineCount(null);
        setAlloDialogOpen(true);
        setAlloDialogLoading(true);
        setAlloDialogCalls([]);
        setAlloDialogSelectedId(null);
        try {
            const res = await fetch(`/api/sdr/calls/for-contact?phone=${encodeURIComponent(phone)}`);
            const json = await res.json();
            if (json.success) {
                setAlloDialogCalls(json.data.calls ?? []);
                const meta = json.data?.meta as { filterPhone?: string; alloLineCount?: number } | undefined;
                if (meta?.filterPhone) setAlloDialogFilterPhone(meta.filterPhone);
                if (typeof meta?.alloLineCount === "number") setAlloDialogAlloLineCount(meta.alloLineCount);
            } else {
                showError("Erreur Allo", json.error ?? "Impossible de charger les appels.");
                setAlloDialogOpen(false);
            }
        } catch {
            showError("Erreur réseau", "Impossible de contacter Allo.");
            setAlloDialogOpen(false);
        } finally {
            setAlloDialogLoading(false);
        }
    }, [currentAction, showError]);

    const confirmAlloCall = useCallback(() => {
        const call = alloDialogCalls.find((c) => c.id === alloDialogSelectedId);
        if (!call) return;
        setLinkedAlloCall(call);
        setAlloDialogOpen(false);
    }, [alloDialogCalls, alloDialogSelectedId]);

    // When opening Stats modal in card view, fetch queue for current mission/list
    useEffect(() => {
        if (!showStatsModal || viewMode !== "card" || !selectedMissionId) return;
        setStatsLoading(true);
        const params = new URLSearchParams();
        params.set("missionId", selectedMissionId);
        params.set("limit", String(STATS_QUEUE_LIMIT));
        if (selectedListId) params.set("listId", selectedListId);
        fetch(`/api/sdr/action-queue?${params.toString()}`, { cache: "no-store" })
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data?.items) {
                    const items = json.data.items as QueueItem[];
                    setStatsQueueItems(items.map((i) => ({
                        ...i,
                        _displayName: i.contact
                            ? `${(i.contact.firstName || "").trim()} ${(i.contact.lastName || "").trim()}`.trim() || i.company.name
                            : i.company.name,
                        _companyName: i.company.name,
                        _phone: i.contact?.phone || i.company?.phone || null,
                        _email: i.contact?.email || null,
                        _searchNote: i.lastAction?.note ?? null,
                    })));
                } else {
                    setStatsQueueItems([]);
                }
            })
            .catch(() => setStatsQueueItems([]))
            .finally(() => setStatsLoading(false));
    }, [showStatsModal, viewMode, selectedMissionId, selectedListId]);

    // Unified drawer state (table view)
    const [unifiedDrawerOpen, setUnifiedDrawerOpen] = useState(false);
    const [unifiedDrawerContactId, setUnifiedDrawerContactId] = useState<string | null>(null);
    const [unifiedDrawerCompanyId, setUnifiedDrawerCompanyId] = useState<string | null>(null);
    const [unifiedDrawerMissionId, setUnifiedDrawerMissionId] = useState<string | undefined>();
    const [unifiedDrawerMissionName, setUnifiedDrawerMissionName] = useState<string | undefined>();
    const { data: clientBookingData } = useQuery({
        queryKey: sdrClientBookingKey(unifiedDrawerOpen && unifiedDrawerMissionId ? unifiedDrawerMissionId : null),
        queryFn: async () => {
            const res = await fetch(`/api/missions/${unifiedDrawerMissionId}/client-booking`);
            const json = await res.json();
            if (!json.success) return { bookingUrl: "", interlocuteurs: [] };
            return {
                bookingUrl: json.data?.bookingUrl ?? "",
                interlocuteurs: Array.isArray(json.data?.interlocuteurs) ? json.data.interlocuteurs : [],
            };
        },
        enabled: !!unifiedDrawerMissionId && !!unifiedDrawerOpen,
    });
    const unifiedDrawerClientBookingUrl = clientBookingData?.bookingUrl ?? "";
    const unifiedDrawerInterlocuteurs = clientBookingData?.interlocuteurs ?? [];
    /** Row used to open the drawer (for email modal context when "Envoie mail" is selected in drawer) */
    const [drawerRow, setDrawerRow] = useState<QueueItem | null>(null);
    const prevUnifiedDrawerOpenRef = useRef(false);

    // When drawer closes, refresh queue so table shows updated/removed contacts (runs after state commit)
    useEffect(() => {
        const wasOpen = prevUnifiedDrawerOpenRef.current;
        prevUnifiedDrawerOpenRef.current = unifiedDrawerOpen;
        if (wasOpen && !unifiedDrawerOpen && viewMode === "table") {
            const id = setTimeout(() => refreshQueue(), 80);
            return () => clearTimeout(id);
        }
    }, [unifiedDrawerOpen, viewMode, refreshQueue]);

    // Improve workspace when both drawers open in table flow.
    useEffect(() => {
        if (viewMode === "table" && unifiedDrawerOpen) {
            setCollapsed(true);
        }
    }, [viewMode, unifiedDrawerOpen, setCollapsed]);

    const openDrawerForRow = (row: QueueItem) => {
        setDrawerRow(row);
        setUnifiedDrawerContactId(row.contactId || null);
        setUnifiedDrawerCompanyId(row.companyId);

        // Find mission ID from row
        const mission = missions.find(m => m.name === row.missionName);
        setUnifiedDrawerMissionId(mission?.id);
        setUnifiedDrawerMissionName(row.missionName);
        setUnifiedDrawerOpen(true);
    };

    const closeUnifiedDrawer = () => {
        setUnifiedDrawerOpen(false);
        setUnifiedBookingDialogOpen(false);
        setUnifiedAlloDialogOpen(false);
        setDrawerRow(null);
        setUnifiedDrawerContactId(null);
        setUnifiedDrawerCompanyId(null);
        setUnifiedDrawerMissionId(undefined);
        setUnifiedDrawerMissionName(undefined);
    };

    const [emailModalPreferredMailboxId, setEmailModalPreferredMailboxId] = useState<string | null>(null);

    const openEmailModalFromDrawer = () => {
        if (drawerRow) {
            setEmailModalContact(drawerRow.contact ? {
                id: drawerRow.contact.id,
                firstName: drawerRow.contact.firstName,
                lastName: drawerRow.contact.lastName,
                email: drawerRow.contact.email,
                title: drawerRow.contact.title,
                company: drawerRow.company ? { id: drawerRow.company.id, name: drawerRow.company.name } : undefined,
            } : null);
            setEmailModalCompany(drawerRow.company ? {
                id: drawerRow.company.id,
                name: drawerRow.company.name,
                phone: drawerRow.company.phone ?? undefined,
            } : null);
        } else {
            setEmailModalContact(null);
            setEmailModalCompany(null);
        }
        setEmailModalMissionId(unifiedDrawerMissionId ?? null);
        setEmailModalMissionName(unifiedDrawerMissionName ?? null);
        setEmailModalPreferredMailboxId(null);

        if (unifiedDrawerMissionId) {
            (async () => {
                try {
                    // Load mission to get clientId
                    const missionRes = await fetch(`/api/missions/${unifiedDrawerMissionId}`);
                    const missionJson = await missionRes.json();
                    if (!missionJson.success) return;

                    // Mission-level default mailbox has priority
                    const missionDefaultMailboxId = missionJson.data?.defaultMailboxId as string | undefined;
                    if (missionDefaultMailboxId) {
                        setEmailModalPreferredMailboxId(missionDefaultMailboxId);
                        return;
                    }

                    if (!missionJson.data?.client?.id) return;
                    const clientId = missionJson.data.client.id as string;

                    // Load client onboarding data to get default mailbox id
                    const clientRes = await fetch(`/api/clients/${clientId}`);
                    const clientJson = await clientRes.json();
                    if (!clientJson.success) return;
                    const onboardingData = (clientJson.data?.onboarding?.onboardingData ?? {}) as {
                        defaultMailboxId?: string;
                    };
                    if (onboardingData.defaultMailboxId) {
                        setEmailModalPreferredMailboxId(onboardingData.defaultMailboxId);
                    }
                } catch {
                    // optional enhancement; silently ignore failures
                }
            })();
        }

        setShowQuickEmailModal(true);
    };

    // Keep legacy close functions for backwards compatibility
    const closeContactDrawer = () => setDrawerContactId(null);
    const closeCompanyDrawer = () => setDrawerCompanyId(null);
    const handleContactFromCompany = (contact: { id: string }) => {
        setDrawerCompanyId(null);
        setDrawerContactId(contact.id);
    };

    const handleQuickAction = async (row: QueueItem, result: ActionResult) => {
        // For MEETING_BOOKED, open the full drawer so SDR can use the booking flow
        if (result === "MEETING_BOOKED") {
            openDrawerForRow(row);
            return;
        }
        // For ENVOIE_MAIL, open choice modal: note only (Mail à envoyer) or send email (Mail envoyé)
        if (result === "ENVOIE_MAIL") {
            setMailToSendChoiceRow(row);
            setMailToSendChoiceNote("");
            setShowMailToSendChoiceModal(true);
            return;
        }

        const key = queueRowKey(row);
        setSubmittingRowKey(key);
        const noteRequired = getRequiresNote(result);
        const note = noteRequired
            ? (isCallbackResult(result) ? "Rappel demandé" : statusLabels[result] ?? "Note")
            : undefined;
        try {
            const res = await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: row.contactId ?? undefined,
                    companyId: row.contactId ? undefined : row.companyId,
                    campaignId: row.campaignId,
                    channel: row.channel,
                    result,
                    note: note ?? undefined,
                    callbackDate: isCallbackResult(result) ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
                }),
            });
            const json = await res.json();
            if (json.success) {
                queryClient.invalidateQueries({ queryKey: queueQueryKey });
                setActionsCompleted((c) => c + 1);
                trackActionCreated({ channel: row.channel, result, hasContact: !!row.contactId, hasCompany: !!row.companyId });
            } else {
                showError(json.error || "Erreur lors de l'enregistrement");
            }
        } catch {
            showError("Erreur de connexion");
        } finally {
            setSubmittingRowKey(null);
        }
    };

    // Queue: save "Mail à envoyer" with note only (no email sent)
    const handleMailToSendChoiceSaveOnly = async () => {
        const row = mailToSendChoiceRow;
        if (!row || !mailToSendChoiceNote.trim()) {
            showError("Erreur", "Une note est requise pour Mail à envoyer.");
            return;
        }
        setSubmittingRowKey(queueRowKey(row));
        try {
            const res = await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: row.contactId ?? undefined,
                    companyId: row.contactId ? undefined : row.companyId,
                    campaignId: row.campaignId,
                    channel: row.channel,
                    result: "ENVOIE_MAIL" as const,
                    note: mailToSendChoiceNote.trim(),
                }),
            });
            const json = await res.json();
            if (json.success) {
                queryClient.invalidateQueries({ queryKey: queueQueryKey });
                setActionsCompleted((c) => c + 1);
                success("Enregistré", "Statut Mail à envoyer enregistré.");
                setShowMailToSendChoiceModal(false);
                setMailToSendChoiceRow(null);
                setMailToSendChoiceNote("");
            } else {
                showError(json.error || "Erreur lors de l'enregistrement");
            }
        } catch {
            showError("Erreur de connexion");
        } finally {
            setSubmittingRowKey(null);
        }
    };

    // Queue: open email composer (will record MAIL_ENVOYE when sent)
    const handleMailToSendChoiceOpenComposer = (targetRow?: QueueItem) => {
        const row = targetRow || mailToSendChoiceRow;
        if (!row) return;
        const mission = missions.find(m => m.name === row.missionName);
        const missionId = mission?.id || selectedMissionId;
        setEmailModalContact(row.contact ? {
            id: row.contact.id,
            firstName: row.contact.firstName,
            lastName: row.contact.lastName,
            email: row.contact.email,
            title: row.contact.title,
            company: { id: row.company.id, name: row.company.name }
        } : null);
        setEmailModalCompany(row.contact ? null : { id: row.company.id, name: row.company.name, phone: row.company.phone });
        setEmailModalMissionId(missionId || null);
        setEmailModalMissionName(mission?.name || row.missionName);
        setEmailModalPreferredMailboxId(null);
        if (mission?.defaultMailboxId) setEmailModalPreferredMailboxId(mission.defaultMailboxId);
        else if (missionId) {
            (async () => {
                try {
                    const missionRes = await fetch(`/api/missions/${missionId}`);
                    const missionJson = await missionRes.json();
                    if (!missionJson.success) return;
                    const missionDefaultMailboxId = missionJson.data?.defaultMailboxId as string | undefined;
                    if (missionDefaultMailboxId) {
                        setEmailModalPreferredMailboxId(missionDefaultMailboxId);
                        return;
                    }
                    if (!missionJson.data?.client?.id) return;
                    const clientId = missionJson.data.client.id as string;
                    const clientRes = await fetch(`/api/clients/${clientId}`);
                    const clientJson = await clientRes.json();
                    if (!clientJson.success) return;
                    const onboardingData = (clientJson.data?.onboarding?.onboardingData ?? {}) as { defaultMailboxId?: string };
                    if (onboardingData.defaultMailboxId) setEmailModalPreferredMailboxId(onboardingData.defaultMailboxId);
                } catch { /* ignore */ }
            })();
        }
        setPendingEmailAction({ row, result: "MAIL_ENVOYE" });
        setShowMailToSendChoiceModal(false);
        setMailToSendChoiceRow(null);
        setMailToSendChoiceNote("");
        setShowQuickEmailModal(true);
    };

    const handleBulkDisqualify = async () => {
        if (tableSelectedIds.size === 0) return;
        if (!confirm(`Marquer ${tableSelectedIds.size} élément(s) comme disqualifié(s) ?`)) return;

        const keysToRemove = new Set(tableSelectedIds);
        const rowsToProcess = filteredQueueItems.filter((r) => keysToRemove.has(queueRowKey(r)));

        // Optimistic: remove from UI immediately
        queryClient.invalidateQueries({ queryKey: queueQueryKey });
        setTableSelectedIds(new Set());
        setActionsCompleted((c) => c + rowsToProcess.length);
        setIsBulkDisqualifying(false);

        // Server: disqualify in background
        let failCount = 0;
        const promises = rowsToProcess.map(async (row) => {
            try {
                const res = await fetch("/api/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contactId: row.contactId ?? undefined,
                        companyId: row.contactId ? undefined : row.companyId,
                        campaignId: row.campaignId,
                        channel: row.channel,
                        result: "DISQUALIFIED" as const,
                        note: "Disqualifié",
                    }),
                });
                const json = await res.json();
                if (!json.success) failCount++;
            } catch {
                failCount++;
            }
        });
        await Promise.all(promises);

        trackEvent(UMAMI_EVENTS.ACTION_BULK_DISQUALIFIED, { count: rowsToProcess.length, failCount });

        if (failCount > 0) {
            await refreshQueue();
            showError("Erreur", `${failCount} élément(s) n'ont pas pu être traités.`);
        } else {
            success(`${rowsToProcess.length} élément(s) disqualifié(s).`);
        }
    };

    // Handle email sent from QuickEmailModal — record as MAIL_ENVOYE (email actually sent)
    const handleEmailSent = async () => {
        if (!pendingEmailAction) return;
        const result = "MAIL_ENVOYE" as const;

        const isCardMode = "cardMode" in pendingEmailAction && pendingEmailAction.cardMode;

        try {
            if (isCardMode && currentAction) {
                const res = await fetch("/api/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contactId: currentAction.contact?.id,
                        companyId: !currentAction.contact && currentAction.company ? currentAction.company.id : undefined,
                        campaignId: currentAction.campaignId,
                        channel: "EMAIL",
                        result,
                        note: "Email envoyé via template",
                    }),
                });
                const json = await res.json();
                if (!json.success) {
                    showError(json.error || "Erreur lors de l'enregistrement de l'email");
                    return;
                }
                trackEvent(UMAMI_EVENTS.EMAIL_SENT, { mode: "card" });
                setActionsCompleted((c) => c + 1);
                await loadNextAction();
            } else if (!isCardMode && "row" in pendingEmailAction) {
                const { row } = pendingEmailAction;
                const res = await fetch("/api/actions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contactId: row.contactId ?? undefined,
                        companyId: row.contactId ? undefined : row.companyId,
                        campaignId: row.campaignId,
                        channel: "EMAIL",
                        result,
                        note: "Email envoyé via template",
                    }),
                });
                const json = await res.json();
                if (!json.success) {
                    showError(json.error || "Erreur lors de l'enregistrement de l'email");
                    return;
                }
                trackEvent(UMAMI_EVENTS.EMAIL_SENT, { mode: "queue" });
                queryClient.invalidateQueries({ queryKey: queueQueryKey });
                setActionsCompleted((c) => c + 1);
            }
        } catch {
            showError("Erreur de connexion");
        }

        setPendingEmailAction(null);
        setEmailModalContact(null);
        setEmailModalCompany(null);
        setEmailModalMissionId(null);
        setEmailModalMissionName(null);
    };

    // Open QuickEmailModal for current card (when SDR chooses "Envoyer un email" for ENVOIE_MAIL)
    const openEmailModalForCard = () => {
        if (!currentAction) return;
        const contact = currentAction.contact;
        setEmailModalContact(contact ? {
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            title: contact.title,
            company: currentAction.company ? { id: currentAction.company.id, name: currentAction.company.name } : undefined,
        } : null);
        setEmailModalCompany(!contact && currentAction.company ? { id: currentAction.company.id, name: currentAction.company.name, phone: currentAction.company.phone } : null);
        setEmailModalMissionId(selectedMissionId ?? null);
        setEmailModalMissionName(currentAction.missionName ?? null);
        setEmailModalPreferredMailboxId(null);
        setPendingEmailAction({ cardMode: true, result: "MAIL_ENVOYE" });
        setShowQuickEmailModal(true);
        if (selectedMissionId) {
            (async () => {
                try {
                    const missionRes = await fetch(`/api/missions/${selectedMissionId}`);
                    const missionJson = await missionRes.json();
                    if (!missionJson.success) return;
                    const missionDefaultMailboxId = missionJson.data?.defaultMailboxId as string | undefined;
                    if (missionDefaultMailboxId) {
                        setEmailModalPreferredMailboxId(missionDefaultMailboxId);
                        return;
                    }
                    if (!missionJson.data?.client?.id) return;
                    const clientId = missionJson.data.client.id as string;
                    const clientRes = await fetch(`/api/clients/${clientId}`);
                    const clientJson = await clientRes.json();
                    if (!clientJson.success) return;
                    const onboardingData = (clientJson.data?.onboarding?.onboardingData ?? {}) as { defaultMailboxId?: string };
                    if (onboardingData.defaultMailboxId) setEmailModalPreferredMailboxId(onboardingData.defaultMailboxId);
                } catch { /* ignore */ }
            })();
        }
    };

    // Submit (wrapped in useCallback so keyboard shortcut always has latest)
    const handleSubmit = useCallback(async () => {
        if (!selectedResult || !currentAction?.campaignId) return;
        if (!currentAction.contact && !currentAction.company) {
            setError("Aucun contact ou entreprise disponible");
            return;
        }
        if (getRequiresNote(selectedResult) && !note.trim()) {
            setError("Note requise pour ce résultat");
            return;
        }

        // For MEETING_BOOKED, always open booking drawer so SDR can pick date/type/category
        if (selectedResult === "MEETING_BOOKED") {
            setShowBookingDrawer(true);
            return;
        }

        setIsSubmitting(true);
        setError(null);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

        try {
            const res = await fetch("/api/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contactId: currentAction.contact?.id,
                    companyId: !currentAction.contact && currentAction.company ? currentAction.company.id : undefined,
                    campaignId: currentAction.campaignId,
                    channel: currentAction.channel,
                    result: selectedResult,
                    note: note || undefined,
                    callbackDate: isCallbackResult(selectedResult) && callbackDateValue ? new Date(callbackDateValue).toISOString() : undefined,
                    duration: elapsedTime,
                }),
            });
            const json = await res.json();
            if (!json.success) {
                setError(json.error || "Erreur");
                return;
            }
            const newActionId = json.data?.id as string | undefined;
            const callToLink = linkedAlloCall;
            if (newActionId && currentAction.channel === "CALL" && callToLink) {
                const transcription =
                    callToLink.transcript?.length ?
                        callToLink.transcript.map((t) => `${t.source}: ${t.text}`).join("\n")
                    :   null;
                try {
                    const enrichRes = await fetch(`/api/actions/${newActionId}/enrich-call`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            callId: callToLink.id,
                            summary: callToLink.summary ?? null,
                            transcription,
                            recordingUrl: callToLink.recording_url ?? null,
                            duration: typeof callToLink.duration === "number" && callToLink.duration > 0 ? callToLink.duration : null,
                        }),
                    });
                    const enrichJson = await enrichRes.json();
                    if (!enrichJson.success) {
                        showError(
                            "Appel non enregistré",
                            enrichJson.error ?? "Les données Allo n'ont pas pu être attachées à l'action."
                        );
                    }
                } catch {
                    showError("Appel non enregistré", "Erreur réseau lors de l'enrichissement.");
                }
            }
            trackActionCreated({ channel: currentAction.channel ?? "CALL", result: selectedResult, hasContact: !!currentAction.contact, hasCompany: !!currentAction.company });
            setShowSuccess(true);
            setActionsCompleted((prev) => prev + 1);
            await loadNextAction();
            setShowSuccess(false);
        } catch {
            setError("Erreur de connexion");
        } finally {
            setIsSubmitting(false);
        }
    }, [
        selectedResult,
        currentAction,
        note,
        callbackDateValue,
        selectedMissionId,
        elapsedTime,
        loadNextAction,
        getRequiresNote,
        isCallbackResult,
        linkedAlloCall,
        showError,
    ]);

    // Handlers
    const handleMissionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedMissionId(id);
        localStorage.setItem("sdr_selected_mission", id);
        const firstList = lists.find((l) => l.mission.id === id);
        setSelectedListId(firstList?.id ?? null);
    };

    const handleListChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedListId(id === "all" ? null : id);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement) return;
            if (e.key >= "1" && e.key <= "9") {
                const idx = parseInt(e.key, 10) - 1;
                if (resultOptions[idx]) setSelectedResult(resultOptions[idx].value);
            }
            if (e.key === "Enter" && selectedResult && !isSubmitting) {
                e.preventDefault();
                handleSubmit();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [selectedResult, isSubmitting, resultOptions, handleSubmit]);


    const parseBaseScript = (rawScript?: string): string => {
        if (!rawScript?.trim()) return "";
        const parseCandidate = (candidate: string): string | null => {
            try {
                const parsed = JSON.parse(candidate);
                if (typeof parsed === "string") return parseCandidate(parsed) ?? parsed;
                if (!parsed || typeof parsed !== "object") return null;
                const sections = [
                    { key: "intro", label: "Intro" },
                    { key: "discovery", label: "Decouverte" },
                    { key: "objection", label: "Objections" },
                    { key: "closing", label: "Closing" },
                ]
                    .map(({ key, label }) => {
                        const value = (parsed as Record<string, unknown>)[key];
                        return typeof value === "string" && value.trim() ? `--- ${label} ---\n${value.trim()}` : null;
                    })
                    .filter((value): value is string => Boolean(value));
                return sections.length > 0 ? sections.join("\n\n") : null;
            } catch {
                return null;
            }
        };
        return parseCandidate(rawScript) ?? rawScript;
    };

    const scriptPanelContent = {
        base: parseBaseScript(currentAction?.script),
        additional: currentAction?.scriptAdditional?.trim() || "",
        ai: currentAction?.scriptAiEnhanced?.trim() || "",
    };
    const availableScriptTabs = SCRIPT_TABS.filter((tab) => {
        const content = scriptPanelContent[tab.id as keyof typeof scriptPanelContent];
        return Boolean(content && content.trim());
    });
    useEffect(() => {
        if (availableScriptTabs.length === 0) return;
        if (!availableScriptTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab(availableScriptTabs[0].id);
        }
    }, [activeTab, availableScriptTabs]);

    // NOTE: Planning blocks are informational only — SDRs can prospect even without scheduled blocks today.

    // Sync calls button — always visible in headers
    const syncCallsButton = (
        <button
            type="button"
            onClick={handleSyncCalls}
            disabled={isSyncingCalls}
            title="Synchroniser les résumés et transcriptions d'appels Allo (24 dernières heures)"
            className={cn(
                "flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                "border-[#d8e2df] bg-white text-[var(--elan-petrol)] hover:bg-[#f3f7f5]",
                isSyncingCalls && "opacity-70 cursor-not-allowed"
            )}
        >
            {isSyncingCalls ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <PhoneCall className="w-4 h-4" />
            )}
            {isSyncingCalls ? "Synchro…" : "Sync appels"}
            {syncResult && !isSyncingCalls && (
                <span className={cn(
                    "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    syncResult.enriched > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                )}>
                    {syncResult.enriched}/{syncResult.total}
                </span>
            )}
        </button>
    );

    const queueColumns: Column<QueueItem>[] = [
            {
                key: "name",
                header: "Contact / Société",
                render: (_, row) => {
                    const name = row.contact
                        ? `${row.contact.firstName || ""} ${row.contact.lastName || ""}`.trim() || row.company.name
                        : row.company.name;
                    return (
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors",
                                row.contactId
                                    ? "bg-[rgba(255,158,27,0.1)] border-[rgba(224,124,0,0.18)] text-[var(--elan-petrol)]"
                                    : "bg-slate-50 border-slate-200 text-slate-500"
                            )}>
                                {row.contactId ? (
                                    <User className="w-4.5 h-4.5" />
                                ) : (
                                    <Building2 className="w-4.5 h-4.5" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate max-w-[220px]">{name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {row.contact && row.company.name !== name && (
                                        <span className="text-xs text-slate-500 truncate max-w-[140px] flex items-center gap-1">
                                            <Building2 className="w-3 h-3 flex-shrink-0" />
                                            {row.company.name}
                                        </span>
                                    )}
                                    {row.contact?.title && (
                                        <span className="text-xs text-slate-400 truncate max-w-[120px]">
                                            · {row.contact.title}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                },
            },
            {
                key: "_phone",
                header: "Téléphone",
                render: (_, row) => {
                    const phone = row._phone || row.contact?.phone || row.company?.phone;
                    if (!phone) return (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-2 py-1 rounded-md bg-slate-50 border border-slate-100">
                            <PhoneOff className="w-3 h-3" /> Aucun
                        </span>
                    );
                    return (
                        <a
                            href={`tel:${phone}`}
                            onClick={(e) => handlePhoneCallAttempt(e, phone, {
                                lastAction: row.lastAction,
                                lastActionBy: row.lastActionBy ?? null,
                            })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-lg transition-all duration-150 hover:shadow-sm group"
                            title="Cliquer pour appeler"
                        >
                            <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-mono tracking-tight">{phone}</span>
                        </a>
                    );
                },
            },
            {
                key: "_email",
                header: "Email",
                render: (_, row) => {
                    const email = row._email || row.contact?.email;
                    if (!email) return (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-2 py-1 rounded-md bg-slate-50 border border-slate-100">
                            <Mail className="w-3 h-3 text-slate-300" /> Aucun
                        </span>
                    );
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMailToSendChoiceOpenComposer(row);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#1F4D47] bg-[#EDF4F2] hover:bg-[#E2ECE8] border border-[#CBD8D4] rounded-lg transition-all duration-150 hover:shadow-sm group cursor-pointer"
                            title="Envoyer un email (boîte & templates de la mission)"
                        >
                            <Mail className="w-3.5 h-3.5 text-[#1F4D47]" />
                            <span className="truncate max-w-[160px] font-mono text-[11px]">{email}</span>
                        </button>
                    );
                },
            },
            {
                key: "channel",
                header: "Canal",
                render: (v) => {
                    const channelConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                        CALL: { icon: <Phone className="w-3.5 h-3.5" />, color: "bg-[rgba(255,158,27,0.1)] text-[var(--elan-petrol)] border-[rgba(224,124,0,0.22)]", label: "Appel" },
                        EMAIL: { icon: <MailOpen className="w-3.5 h-3.5" />, color: "bg-[rgba(12,59,56,0.08)] text-[var(--elan-petrol)] border-[rgba(12,59,56,0.18)]", label: "Email" },
                        LINKEDIN: { icon: <Linkedin className="w-3.5 h-3.5" />, color: "bg-sky-50 text-sky-700 border-sky-200", label: "LinkedIn" },
                    };
                    const cfg = channelConfig[v as string] || { icon: <Globe className="w-3.5 h-3.5" />, color: "bg-slate-50 text-slate-600 border-slate-200", label: v };
                    return (
                        <Badge className={cn("text-xs gap-1 font-medium border", cfg.color)}>
                            {cfg.icon}
                            {cfg.label}
                        </Badge>
                    );
                },
            },
            {
                key: "lastAction",
                header: "Dernière action",
                render: (_, row) => {
                    if (!row.lastAction) {
                        return (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 italic px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                Jamais contacté
                            </span>
                        );
                    }
                    const resultColor: Record<string, { badge: string; dot: string }> = {
                        NO_RESPONSE: { badge: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
                        BAD_CONTACT: { badge: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-400" },
                        INTERESTED: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
                        CALLBACK_REQUESTED: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
                        RELANCE: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
                        RAPPEL: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
                        MEETING_BOOKED: { badge: "bg-[rgba(255,158,27,0.1)] text-[var(--elan-petrol)] border-[rgba(224,124,0,0.22)]", dot: "bg-[var(--elan-amber)]" },
                        DISQUALIFIED: { badge: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
                        ENVOIE_MAIL: { badge: "bg-[rgba(12,59,56,0.08)] text-[var(--elan-petrol)] border-[rgba(12,59,56,0.18)]", dot: "bg-[#25745f]" },
                        MAIL_ENVOYE: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
                    };
                    const color = resultColor[row.lastAction.result] || { badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
                    const contactedByOther = row.lastActionBy?.id && row.lastActionBy.id !== session?.user?.id;
                    return (
                        <div className="space-y-1.5">
                            <Badge className={cn("text-xs border font-medium", color.badge)}>
                                {RESULT_ICON_MAP[row.lastAction.result]}
                                <span className="ml-1">{statusLabels[row.lastAction.result] ?? row.lastAction.result}</span>
                            </Badge>
                            {contactedByOther && row.lastActionBy?.name && (
                                <p className="text-[11px] text-amber-700 font-medium">
                                    Contacté par {row.lastActionBy.name}
                                </p>
                            )}
                            {row.lastAction.note && (
                                <div className="flex items-start gap-1.5 max-w-[220px]" title={row.lastAction.note}>
                                    <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                        {row.lastAction.note}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                },
            },
            {
                key: "priority",
                header: "Urgence",
                render: (_, row) => {
                    if (row.priority === "ABSENT_RDV") {
                        return (
                            <div className="space-y-1">
                                <Badge className="text-xs font-bold border bg-red-100 text-red-800 border-red-300 animate-pulse gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    RDV ABSENT
                                </Badge>
                                <p className="text-[10px] font-semibold text-red-600">A rappeler en priorité</p>
                            </div>
                        );
                    }
                    const isCallbackRow = !!row.lastAction && isCallbackResult(row.lastAction.result);
                    const callbackDateRaw = row.lastAction?.callbackDate;
                    const callbackTs = callbackDateRaw ? new Date(callbackDateRaw).getTime() : NaN;
                    const now = Date.now();
                    const oneDayMs = 24 * 60 * 60 * 1000;
                    const threeDaysMs = 3 * oneDayMs;

                    if (!isCallbackRow || !Number.isFinite(callbackTs)) {
                        return (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                                Non planifié
                            </span>
                        );
                    }

                    const isOverdue = callbackTs < now;
                    const isCritical = callbackTs <= now + oneDayMs;
                    const isSoon = callbackTs <= now + threeDaysMs;
                    const urgencyLabel = isOverdue ? "En retard" : isCritical ? "Urgent" : isSoon ? "Bientot" : "Planifié";
                    const urgencyClass = isOverdue
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : isCritical
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : isSoon
                                ? "bg-[rgba(255,158,27,0.1)] text-[var(--elan-petrol)] border-[rgba(224,124,0,0.22)]"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200";

                    return (
                        <div className="space-y-1">
                            <time className="block text-[11px] font-medium text-slate-600">
                                {new Date(callbackDateRaw as string).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </time>
                            <Badge className={cn("text-xs font-medium border", urgencyClass)}>
                                {urgencyLabel}
                            </Badge>
                        </div>
                    );
                },
            },
            {
                key: "quickActions",
                header: "Actions rapides",
                render: (_, row) => {
                    const key = queueRowKey(row);
                    const submitting = submittingRowKey === key;
                    // Show only the most common 4 actions inline, rest via drawer  
                    const primaryActions = resultOptions.slice(0, 5);
                    return (
                        <div className="flex items-center gap-1">
                            {submitting && (
                                <span className="flex items-center justify-center w-8 h-8 text-[var(--elan-amber)]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </span>
                            )}
                            {primaryActions.map((opt) => {
                                const actionColors: Record<string, string> = {
                                    NO_RESPONSE: "hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700 hover:shadow-sm",
                                    BAD_CONTACT: "hover:border-red-300 hover:bg-red-50 hover:text-red-600 hover:shadow-sm hover:shadow-red-100",
                                    INTERESTED: "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-sm hover:shadow-emerald-100",
                                    CALLBACK_REQUESTED: "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 hover:shadow-sm hover:shadow-amber-100",
                                    RELANCE: "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 hover:shadow-sm hover:shadow-amber-100",
                                    RAPPEL: "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600 hover:shadow-sm hover:shadow-amber-100",
                                    MEETING_BOOKED: "hover:border-[rgba(224,124,0,0.24)] hover:bg-[rgba(255,158,27,0.12)] hover:text-[var(--elan-petrol)] hover:shadow-sm hover:shadow-[rgba(255,158,27,0.12)]",
                                    DISQUALIFIED: "hover:border-slate-400 hover:bg-slate-100 hover:text-slate-600 hover:shadow-sm",
                                    ENVOIE_MAIL: "hover:border-[rgba(12,59,56,0.22)] hover:bg-[rgba(12,59,56,0.08)] hover:text-[var(--elan-petrol)] hover:shadow-sm hover:shadow-[rgba(12,59,56,0.08)]",
                                    MAIL_ENVOYE: "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-sm hover:shadow-emerald-100",
                                };
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickAction(row, opt.value);
                                        }}
                                        disabled={submitting}
                                        title={`${opt.label} (${opt.key})`}
                                        className={cn(
                                            "w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-150",
                                            "border-slate-200 text-slate-400 bg-white",
                                            actionColors[opt.value] || "hover:border-[rgba(224,124,0,0.24)] hover:bg-[rgba(255,158,27,0.12)] hover:text-[var(--elan-petrol)]",
                                            submitting && "opacity-40 pointer-events-none",
                                            "active:scale-95"
                                        )}
                                    >
                                        {opt.icon}
                                    </button>
                                );
                            })}
                            {/* Open drawer for full control */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openDrawerForRow(row);
                                }}
                                title="Voir la fiche complète"
                                className="w-8 h-8 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-[rgba(224,124,0,0.24)] hover:bg-[rgba(255,158,27,0.12)] hover:text-[var(--elan-petrol)] transition-all duration-150 active:scale-95"
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                        </div>
                    );
                },
            },
        ];

        return (
            <div className="sdr-actions-page min-h-full space-y-3 bg-[var(--elan-paper)]">
                {/* Header — Table View */}
                <div className="border-b border-[#e3e9e6] pb-3">

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8e2df] bg-[#eef4f2]">
                                <Phone className="h-4 w-4 text-[var(--elan-petrol)]" />
                            </div>
                            <div>
                                <h1 className="text-[21px] font-semibold leading-tight text-[#15201e]">Actions</h1>
                                <p className="text-[12px] text-slate-500">Gérez vos actions commerciales</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Button type="button" onClick={() => setShowStatsModal(true)} variant="outline" className="h-9 rounded-lg border-[#d8e2df] bg-white px-3 text-[13px] font-medium text-[var(--elan-petrol)] hover:bg-[#f3f7f5] gap-1.5">
                                <BarChart2 className="w-3.5 h-3.5" /> Stats
                            </Button>

                            {syncCallsButton}

                            <div className="flex h-9 items-center gap-2 rounded-lg border border-[#d8e2df] bg-[#f7f9f8] px-3">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-[16px] font-semibold text-[#15201e] tabular-nums leading-none">{actionsCompleted}</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">actions</span>
                            </div>
                        </div>
                    </div>
                </div>

                <QueueSummary
                    completed={actionsCompleted}
                    remaining={filteredQueueItems.length}
                    urgentCallbacks={urgentCallbackCount}
                    untouched={untouchedCount}
                />

                {/* Filter Card */}
                <div className="overflow-hidden rounded-2xl border border-[#dfe7e3] bg-white shadow-[0_10px_30px_-26px_rgba(12,59,56,0.55)]">
                    <div className="px-4 pt-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                                <Filter className="h-4 w-4 text-[var(--elan-petrol)]" />
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[13px] font-semibold text-[#1a1a1a]">Filtres</h3>
                                    {hasTableFiltersActive && (
                                        <p className="text-[11px] text-[var(--elan-petrol)] font-medium">
                                            {[tableFilterResult, tableFilterPriority, tableFilterChannel, tableFilterType].filter(Boolean).length} actif{[tableFilterResult, tableFilterPriority, tableFilterChannel, tableFilterType].filter(Boolean).length > 1 ? "s" : ""}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {hasTableFiltersActive && (
                                    <Button variant="ghost" size="sm" onClick={clearTableFilters} className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-1.5 text-[12px] h-7">
                                        <RotateCcw className="w-3 h-3" />
                                        Réinitialiser
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setAdvancedFiltersOpen((open) => !open)}
                                    aria-expanded={advancedFiltersOpen}
                                    className="h-7 gap-1.5 text-[12px] text-[var(--elan-petrol)] hover:bg-[#eef4f2]"
                                >
                                    Filtres avancés
                                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedFiltersOpen && "rotate-180")} />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-3 pt-2.5">
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.15fr)_minmax(160px,1fr)_minmax(280px,2fr)]">
                            {/* Mission */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide block">Mission</label>
                                <select value={selectedMissionId || ""} onChange={handleMissionChange} className="w-full h-9 px-3 text-[13px] border border-[#e5e5e5] rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.28)] focus:border-[var(--elan-amber-deep)] transition-shadow cursor-pointer">
                                    {selectableMissions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            {/* Liste */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide block">Liste</label>
                                <select value={selectedListId || "all"} onChange={handleListChange} className="w-full h-9 px-3 text-[13px] border border-[#e5e5e5] rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.28)] focus:border-[var(--elan-amber-deep)] transition-shadow cursor-pointer">
                                    <option value="all">Toutes</option>
                                    {filteredLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            {/* Search */}
                            <div className="space-y-1 sm:col-span-2 lg:col-span-2 xl:col-span-1">
                                <label className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide block">Rechercher</label>
                                <input type="text" value={tableSearchInput} onChange={(e) => setTableSearchInput(e.target.value)} placeholder="Contact ou société…" className="w-full h-9 px-3 text-[13px] border border-[#e5e5e5] rounded-lg bg-white text-[#1a1a1a] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.28)] focus:border-[var(--elan-amber-deep)] transition-shadow" />
                            </div>
                        </div>

                        {advancedFiltersOpen && (
                        <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-[#edf1ef] pt-3 sm:grid-cols-2 xl:grid-cols-4">
                            {/* Statut */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide block">Statut</label>
                                <select value={tableFilterResult} onChange={(e) => setTableFilterResult(e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e5e5] rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.28)] focus:border-[var(--elan-amber-deep)] transition-shadow cursor-pointer">
                                    <option value="">Tous</option>
                                    <option value="NONE">Jamais contacté</option>
                                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                            {/* Priorité */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide block">Priorité</label>
                                <select value={tableFilterPriority} onChange={(e) => setTableFilterPriority(e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e5e5] rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.28)] focus:border-[var(--elan-amber-deep)] transition-shadow cursor-pointer">
                                    <option value="">Toutes</option>
                                    {Object.entries(PRIORITY_LABELS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                            {/* Canal */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide block">Canal</label>
                                <select value={tableFilterChannel} onChange={(e) => setTableFilterChannel(e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e5e5] rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.28)] focus:border-[var(--elan-amber-deep)] transition-shadow cursor-pointer">
                                    <option value="">Tous</option>
                                    {(Object.entries(CHANNEL_LABELS) as [Channel, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                            {/* Type */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-[500] text-slate-400 uppercase tracking-wide block">Type</label>
                                <select value={tableFilterType} onChange={(e) => setTableFilterType(e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e5e5e5] rounded-lg bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.28)] focus:border-[var(--elan-amber-deep)] transition-shadow cursor-pointer">
                                    <option value="">Tous</option>
                                    <option value="contact">Contact</option>
                                    <option value="company">Société</option>
                                </select>
                            </div>
                        </div>
                        )}

                        {hasTableFiltersActive && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Filtres actifs">
                                {tableFilterResult && <button type="button" onClick={() => setTableFilterResult("")} className="rounded-full border border-[#d7e3df] bg-[#eef4f2] px-2.5 py-1 text-[10px] font-semibold text-[#1f4d47]">Statut: {tableFilterResult === "NONE" ? "Jamais contacté" : statusLabels[tableFilterResult] ?? tableFilterResult} ×</button>}
                                {tableFilterPriority && <button type="button" onClick={() => setTableFilterPriority("")} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Priorité: {PRIORITY_LABELS[tableFilterPriority]?.label ?? tableFilterPriority} ×</button>}
                                {tableFilterChannel && <button type="button" onClick={() => setTableFilterChannel("")} className="rounded-full border border-[#d7e3df] bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">Canal: {CHANNEL_LABELS[tableFilterChannel as Channel] ?? tableFilterChannel} ×</button>}
                                {tableFilterType && <button type="button" onClick={() => setTableFilterType("")} className="rounded-full border border-[#d7e3df] bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">Type: {tableFilterType === "contact" ? "Contacts" : "Sociétés"} ×</button>}
                            </div>
                        )}

                        {/* Results summary */}
                        <div className="mt-2 flex items-center justify-between">
                            <span className="text-[12px] text-slate-500">
                                {tableSearchApi ? (
                                    <><span className="font-[500] text-[var(--elan-petrol)]">{queueItems.length}</span> résultat{queueItems.length !== 1 ? "s" : ""} pour «&nbsp;{tableSearchApi}&nbsp;»</>
                                ) : hasTableFiltersActive ? (
                                    <><span className="font-[500] text-[var(--elan-petrol)]">{filteredQueueItems.length}</span> sur {queueItems.length}</>
                                ) : (
                                    <><span className="font-[500] text-[#1a1a1a]">{queueItems.length}</span> dans la file</>
                                )}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => refreshQueue()} className="text-slate-400 hover:text-[var(--elan-petrol)] gap-1.5 text-[12px] h-7">
                                <RefreshCw className="w-3 h-3" />
                                Actualiser
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Bulk delete bar */}
                {tableSelectedIds.size > 0 && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[rgba(255,158,27,0.1)] border border-[rgba(224,124,0,0.22)] mb-4">
                        <span className="text-sm font-medium text-[var(--elan-petrol)]">
                            {tableSelectedIds.size} élément(s) sélectionné(s)
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTableSelectedIds(new Set())}
                                disabled={isBulkDisqualifying}
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={handleBulkDisqualify}
                                disabled={isBulkDisqualifying}
                                className="gap-2"
                            >
                                {isBulkDisqualifying ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Disqualifier la sélection
                            </Button>
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className="overflow-hidden rounded-xl border border-[#e1e7e4] bg-white">
                    {queueInitialLoading ? (
                        <TableSkeleton columns={6} rows={12} className="rounded-2xl" />
                    ) : queueFetchError ? (
                        <EmptyState
                            icon={RefreshCw}
                            title={queueFetchErrorMsg ?? "Erreur"}
                            description="Vérifiez votre connexion et réessayez."
                            action={
                                <Button
                                    variant="secondary"
                                    onClick={() => refreshQueue()}
                                    className="gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Réessayer
                                </Button>
                            }
                            className="rounded-2xl border-0"
                        />
                    ) : filteredQueueItems.length === 0 ? (
                        <EmptyState
                            icon={emptyTableReason.icon}
                            title={emptyTableReason.title}
                            description={emptyTableReason.description}
                            action={
                                hasTableFiltersActive ? (
                                    <Button variant="secondary" onClick={clearTableFilters} className="gap-2">
                                        <RotateCcw className="w-4 h-4" />
                                        Réinitialiser les filtres
                                    </Button>
                                ) : selectedMissionId ? (
                                    <Button variant="secondary" onClick={() => refreshQueue()} className="gap-2">
                                        <RefreshCw className="w-4 h-4" />
                                        Actualiser
                                    </Button>
                                ) : undefined
                            }
                            className="rounded-2xl border-0"
                        />
                    ) : (
                        <DataTable
                            data={filteredQueueItems}
                            columns={queueColumns}
                            keyField={(row) => queueRowKey(row)}
                            pagination
                            pageSize={15}
                            emptyMessage="Aucun contact dans la file. Changez de mission ou liste."
                            onRowClick={openDrawerForRow}
                            enableSecondaryColumnsToggle
                            selectable
                            selectedIds={tableSelectedIds}
                            onSelectionChange={(ids) => setTableSelectedIds(new Set(ids))}
                            getRowClassName={(row) => {
                                if (recentlyUpdatedRowKeys.has(queueRowKey(row))) {
                                    return "!bg-emerald-50/80 border-l-4 border-l-emerald-500 animate-fade-in";
                                }
                                const isCallbackRow = !!row.lastAction && isCallbackResult(row.lastAction.result);
                                if (!isCallbackRow) return "";
                                const callbackTs = row.lastAction?.callbackDate ? new Date(row.lastAction.callbackDate).getTime() : NaN;
                                const in3Days = Number.isFinite(callbackTs) && callbackTs <= Date.now() + 3 * 24 * 60 * 60 * 1000;
                                return in3Days
                                    ? "!bg-amber-100/80 border-l-8 border-l-amber-500 ring-1 ring-amber-200/70"
                                    : "!bg-amber-50/60 border-l-8 border-l-amber-300 ring-1 ring-amber-100/70";
                            }}
                        />
                    )}
                </div>

                {/* Unified Action Drawer — mount only when open to avoid heavy effects when closed */}
                {unifiedDrawerOpen && unifiedDrawerCompanyId && (
                        <UnifiedActionDrawer
                            isOpen={unifiedDrawerOpen}
                            onClose={closeUnifiedDrawer}
                            contactId={unifiedDrawerContactId}
                            companyId={unifiedDrawerCompanyId}
                            missionId={unifiedDrawerMissionId}
                            missionName={unifiedDrawerMissionName}
                            clientBookingUrl={unifiedDrawerClientBookingUrl || undefined}
                            clientInterlocuteurs={unifiedDrawerInterlocuteurs}
                            onBookingDialogOpenChange={setUnifiedBookingDialogOpen}
                            onAlloDialogOpenChange={setUnifiedAlloDialogOpen}
                            onContactSelect={(newContactId) => {
                                setUnifiedDrawerContactId(newContactId);
                            }}
                            onActionRecorded={() => {
                                const rowKey = unifiedDrawerContactId ?? unifiedDrawerCompanyId ?? "";
                                if (rowKey) {
                                    queryClient.invalidateQueries({ queryKey: queueQueryKey });
                                    setActionsCompleted((c) => c + 1);
                                }
                                refreshQueue();
                            }}
                            onValidateAndNext={() => {
                                if (!drawerRow) return;
                                const key = queueRowKey(drawerRow);
                                const idx = filteredQueueItems.findIndex((row) => queueRowKey(row) === key);
                                queryClient.invalidateQueries({ queryKey: queueQueryKey });
                                setActionsCompleted((c) => c + 1);
                                if (idx >= 0 && idx < filteredQueueItems.length - 1) {
                                    const nextRow = filteredQueueItems[idx + 1];
                                    openDrawerForRow(nextRow);
                                } else {
                                    closeUnifiedDrawer();
                                }
                                refreshQueue();
                            }}
                        />
                    )
                }

                {/* Script companion drawer (table view only), synchronized with unified drawer */}
                {unifiedDrawerOpen && unifiedDrawerMissionId && (
                    <ScriptCompanionDrawer
                        isOpen={
                            unifiedDrawerOpen &&
                            !unifiedBookingDialogOpen &&
                            !unifiedAlloDialogOpen
                        }
                        onClose={closeUnifiedDrawer}
                        missionId={unifiedDrawerMissionId}
                        missionName={unifiedDrawerMissionName}
                    />
                )}

                <QuickEmailModal
                    isOpen={showQuickEmailModal}
                    onClose={() => {
                        setShowQuickEmailModal(false);
                        setPendingEmailAction(null);
                        setEmailModalContact(null);
                        setEmailModalCompany(null);
                        setEmailModalMissionId(null);
                        setEmailModalMissionName(null);
                        setEmailModalPreferredMailboxId(null);
                    }}
                    onSent={handleEmailSent}
                    contact={emailModalContact}
                    company={emailModalCompany}
                    missionId={emailModalMissionId}
                    missionName={emailModalMissionName}
                    preferredMailboxId={emailModalPreferredMailboxId ?? undefined}
                />

                {/* Queue: Mail à envoyer — note only or open composer */}
                <Modal
                    isOpen={showMailToSendChoiceModal}
                    onClose={() => { setShowMailToSendChoiceModal(false); setMailToSendChoiceRow(null); setMailToSendChoiceNote(""); }}
                    title="Mail à envoyer"
                    description={mailToSendChoiceRow ? (mailToSendChoiceRow.contact ? `${mailToSendChoiceRow.contact.firstName ?? ""} ${mailToSendChoiceRow.contact.lastName ?? ""}`.trim() || mailToSendChoiceRow.company?.name : mailToSendChoiceRow.company?.name) ?? "" : ""}
                    size="sm"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Enregistrer une note (Mail à envoyer) ou envoyer un email maintenant (Mail envoyé).
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Note *</label>
                            <textarea
                                value={mailToSendChoiceNote}
                                onChange={(e) => setMailToSendChoiceNote(e.target.value)}
                                placeholder="Ex: Mail à envoyer après validation du devis..."
                                rows={3}
                                maxLength={500}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgba(255,158,27,0.35)]"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowMailToSendChoiceModal(false);
                                    setMailToSendChoiceRow(null);
                                    setMailToSendChoiceNote("");
                                }}
                            >
                                Annuler
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleMailToSendChoiceOpenComposer()}
                                className="gap-2 border-[rgba(12,59,56,0.18)] text-[var(--elan-petrol)] bg-[rgba(12,59,56,0.08)] hover:bg-[rgba(12,59,56,0.12)]"
                            >
                                <Send className="w-4 h-4" />
                                Envoyer un email
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleMailToSendChoiceSaveOnly}
                                disabled={!mailToSendChoiceNote.trim() || submittingRowKey !== null}
                                isLoading={submittingRowKey !== null}
                            >
                                Enregistrer (Mail à envoyer)
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Stats modal: summary + list of contacts with status (click to open drawer) */}
                <Modal
                    isOpen={showStatsModal}
                    onClose={() => setShowStatsModal(false)}
                    title="Statistiques"
                    description={selectedMissionId ? (missions.find((m) => m.id === selectedMissionId)?.name ?? "") + (selectedListId ? ` · ${filteredLists.find((l) => l.id === selectedListId)?.name ?? ""}` : "") : "Sélectionnez une mission"}
                    size="xl"
                >
                    <ActionStatsModalBody
                        items={filteredQueueItems}
                        loading={false}
                        statusLabels={statusLabels}
                        onRowClick={(row) => {
                            openDrawerForRow(row);
                            setShowStatsModal(false);
                        }}
                        priorityLabels={PRIORITY_LABELS}
                        resultIconMap={RESULT_ICON_MAP}
                        queueRowKey={queueRowKey}
                    />
                </Modal>
            </div>
        );
}
