"use client";

import {
    Fragment, useState, useEffect, useCallback, useMemo, useRef
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Phone, Mail, Linkedin, Building2, User, CheckCircle2,
    XCircle, Ban, Loader2, Clock, Calendar, Sparkles, RotateCcw,
    RefreshCw, BarChart3, TrendingUp, TrendingDown,
    Search, CalendarPlus, ChevronRight, ChevronUp, ChevronDown,
    Activity, Target, Send, PhoneMissed, ThumbsUp, PhoneOff,
    CalendarX, RotateCw, SlidersHorizontal, Download, Columns3,
    X, Radio, Zap, Users, Filter, ArrowUpDown, Check, Mic,
    Volume2, ExternalLink
} from "lucide-react";
import dynamic from "next/dynamic";
import { Card, Button, useToast } from "@/components/ui";
import { ManagerCallEnrichmentSyncModal } from "@/components/prospection/ManagerCallEnrichmentSyncModal";
import { cn } from "@/lib/utils";

const UnifiedActionDrawer = dynamic(
    () => import("@/components/drawers/UnifiedActionDrawer").then((m) => ({ default: m.UnifiedActionDrawer })),
    { ssr: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_TABS = [
    { value: "ALL" as const, label: "Tous canaux", icon: Activity },
    { value: "CALL" as const, label: "Appels", icon: Phone },
    { value: "EMAIL" as const, label: "Email", icon: Mail },
    { value: "LINKEDIN" as const, label: "LinkedIn", icon: Linkedin },
] as const;
type ChannelTabValue = (typeof CHANNEL_TABS)[number]["value"];

type SortKey = "createdAt" | "result" | "sdr" | "name" | "duration" | "mission";
type SortDir = "asc" | "desc";
type Density = "compact" | "default" | "comfortable";

interface MissionItem {
    id: string;
    name: string;
    channel: string;
    channels?: string[];
    client: { id: string; name: string; bookingUrl?: string | null };
    _count?: { actions?: number; campaigns?: number };
    sdrAssignments?: { sdrId: string; sdr: { id: string; name: string } }[];
}

interface ActionRecord {
    id: string;
    contactId: string | null;
    companyId: string | null;
    contact: {
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        company: { id: string; name: string };
    } | null;
    company: { id: string; name: string } | null;
    sdr: { id: string; name: string } | null;
    campaign?: {
        id: string;
        name: string;
        missionId: string;
        mission?: {
            id: string;
            name: string;
            channel?: string;
            channels?: string[];
            client?: { id: string; name: string; bookingUrl?: string | null };
        };
    };
    channel: string;
    result: string;
    note?: string;
    callSummary?: string | null;
    callTranscription?: string | null;
    callRecordingUrl?: string | null;
    duration?: number;
    createdAt: string;
    callbackDate?: string | null;
    _searchKey?: string;
}

const RESULT_CFG: Record<string, {
    label: string; icon: React.ElementType;
    text: string; bg: string; border: string; dot: string;
}> = {
    NO_RESPONSE: { label: "Pas de réponse", icon: PhoneMissed, text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200", dot: "bg-slate-400" },
    BAD_CONTACT: { label: "Mauvais contact", icon: PhoneOff, text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-400" },
    INTERESTED: { label: "Intéressé", icon: ThumbsUp, text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
    CALLBACK_REQUESTED: { label: "Rappel demandé", icon: RotateCw, text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
    MEETING_BOOKED: { label: "RDV planifié", icon: CalendarPlus, text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
    MEETING_CANCELLED: { label: "RDV annulé", icon: CalendarX, text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-400" },
    DISQUALIFIED: { label: "Disqualifié", icon: Ban, text: "text-slate-500", bg: "bg-slate-100", border: "border-slate-200", dot: "bg-slate-300" },
    ENVOIE_MAIL: { label: "Mail à envoyer", icon: Send, text: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-500" },
    MAIL_ENVOYE: { label: "Mail envoyé", icon: Send, text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
    CONNECTION_SENT: { label: "Connexion envoyée", icon: Linkedin, text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-400" },
    MESSAGE_SENT: { label: "Message envoyé", icon: Linkedin, text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200", dot: "bg-sky-400" },
    REPLIED: { label: "A répondu", icon: CheckCircle2, text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
    NOT_INTERESTED: { label: "Pas intéressé", icon: XCircle, text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-400" },
};

function getCfg(r: string) {
    return RESULT_CFG[r] ?? { label: r, icon: Target, text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200", dot: "bg-slate-400" };
}

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    CALL: Phone, EMAIL: Mail, LINKEDIN: Linkedin,
};

// ─────────────────────────────────────────────────────────────────────────────
// SPARKLINE & BADGES
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#2890F8" }: { data: number[]; color?: string }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const W = 64, H = 22;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * (H - 3) + 1.5}`)
        .join(" ");
    return (
        <svg width={W} height={H} className="shrink-0">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function LivePulse({ activeSdrsCount, isLive }: { activeSdrsCount: number; isLive: boolean }) {
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors select-none",
            isLive
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-100 border-slate-200 text-slate-500"
        )}>
            <span className="relative flex h-2 w-2">
                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                <span className={cn("relative inline-flex rounded-full h-2 w-2", isLive ? "bg-emerald-500" : "bg-slate-400")} />
            </span>
            {isLive ? (
                <span>Live • {activeSdrsCount} SDR{activeSdrsCount > 1 ? "s" : ""} actif{activeSdrsCount > 1 ? "s" : ""}</span>
            ) : (
                <span>Hors-ligne</span>
            )}
        </span>
    );
}

function ResultBadge({ result }: { result: string }) {
    const c = getCfg(result);
    const Icon = c.icon;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap",
            c.bg, c.text, c.border
        )}>
            <Icon className="w-3 h-3 shrink-0" aria-hidden />
            {c.label}
        </span>
    );
}

function Th({
    label, sortKey, currentKey, dir, onSort, className,
}: {
    label: string; sortKey: SortKey; currentKey: SortKey;
    dir: SortDir; onSort: (k: SortKey) => void; className?: string;
}) {
    const active = currentKey === sortKey;
    return (
        <th
            scope="col"
            className={cn(
                "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 select-none cursor-pointer hover:text-slate-700 transition-colors",
                active && "text-[#2890F8]",
                className
            )}
            onClick={() => onSort(sortKey)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                <span className="flex flex-col">
                    {active ? (
                        dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                </span>
            </div>
        </th>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN TOGGLE & DENSITY TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

const ALL_COLS = [
    { key: "date", label: "Date" },
    { key: "mission", label: "Mission & Client" },
    { key: "name", label: "Contact / Société" },
    { key: "sdr", label: "Effectué par" },
    { key: "result", label: "Résultat" },
    { key: "note", label: "Résumé / Note" },
    { key: "duration", label: "Durée" },
] as const;
type ColKey = (typeof ALL_COLS)[number]["key"];

function ColToggle({
    visible, onToggle,
}: {
    visible: Set<ColKey>; onToggle: (k: ColKey) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-label="Colonnes visibles"
                className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
            >
                <Columns3 className="w-3.5 h-3.5" aria-hidden />
                Colonnes
            </button>
            {open && (
                <div className="absolute right-0 top-11 z-30 w-52 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 space-y-1">
                    {ALL_COLS.map(c => {
                        const active = visible.has(c.key);
                        return (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => onToggle(c.key)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors",
                                    active ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-700"
                                )}
                            >
                                <span>{c.label}</span>
                                {active && <Check className="w-3.5 h-3.5 text-[#2890F8]" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function DensityToggle({
    value, onChange,
}: {
    value: Density; onChange: (d: Density) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const options: { val: Density; label: string; rows: number }[] = [
        { val: "compact", label: "Compact", rows: 4 },
        { val: "default", label: "Standard", rows: 3 },
        { val: "comfortable", label: "Aéré", rows: 2 },
    ];

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-label="Densité d'affichage"
                className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
            >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden />
                Densité
            </button>
            {open && (
                <div className="absolute right-0 top-11 z-30 w-40 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 space-y-1">
                    {options.map(opt => (
                        <button
                            key={opt.val}
                            type="button"
                            onClick={() => { onChange(opt.val); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors",
                                value === opt.val ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-700"
                            )}
                        >
                            {opt.label}
                            <span className="flex flex-col gap-px opacity-40">
                                {Array.from({ length: opt.rows }).map((_, i) => (
                                    <span key={i} className="block w-5 h-0.5 bg-current rounded-full" />
                                ))}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT FILTER CHIPS
// ─────────────────────────────────────────────────────────────────────────────

function ResultFilterBar({
    results, active, onToggle, counts,
}: {
    results: string[]; active: Set<string>;
    onToggle: (r: string) => void; counts: Record<string, number>;
}) {
    return (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par résultat">
            {results.map(r => {
                const c = getCfg(r);
                const Icon = c.icon;
                const isActive = active.has(r);
                const count = counts[r] ?? 0;
                return (
                    <button
                        key={r}
                        type="button"
                        onClick={() => onToggle(r)}
                        aria-pressed={isActive}
                        className={cn(
                            "flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-xl border text-[11px] font-bold transition-all duration-150",
                            isActive
                                ? cn(c.bg, c.text, c.border, "shadow-2xs")
                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                        )}
                    >
                        <Icon className="w-3 h-3 shrink-0" aria-hidden />
                        {c.label}
                        <span className={cn(
                            "ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums",
                            isActive ? "bg-white/70 shadow-2xs" : "bg-slate-100 text-slate-500"
                        )}>
                            {count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV EXPORT & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function exportCSV(rows: ActionRecord[], label: string) {
    const headers = ["Date", "Mission", "Client", "Contact", "Société", "Auteur (SDR)", "Canal", "Résultat", "Résumé / Note", "Durée (s)"];
    const lines = rows.map(r => {
        const name = getContactName(r);
        const company = getCompanyName(r);
        const missionName = r.campaign?.mission?.name || "";
        const clientName = r.campaign?.mission?.client?.name || r.company?.name || "";
        const note = (r.callSummary?.trim() || r.note || "").replace(/"/g, '""');
        const dateKey = r.createdAt;
        return [
            new Date(dateKey).toLocaleString("fr-FR"),
            `"${missionName.replace(/"/g, '""')}"`,
            `"${clientName.replace(/"/g, '""')}"`,
            `"${name.replace(/"/g, '""')}"`,
            `"${company.replace(/"/g, '""')}"`,
            `"${(r.sdr?.name ?? "").replace(/"/g, '""')}"`,
            r.channel,
            getCfg(r.result).label,
            `"${note}"`,
            r.duration ?? "",
        ].join(",");
    });
    const blob = new Blob([headers.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prospection_${label.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

function getContactName(action: ActionRecord): string {
    const full = `${action.contact?.firstName || ""} ${action.contact?.lastName || ""}`.trim();
    return full || "";
}

function getCompanyName(action: ActionRecord): string {
    return action.company?.name || action.contact?.company?.name || "";
}

function getActionDisplaySummary(action: ActionRecord): string {
    return action.callSummary?.trim() || action.note?.trim() || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN UNIFIED SINGLE-PAGE COCKPIT
// ─────────────────────────────────────────────────────────────────────────────

export default function ManagerProspectionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL state params
    const channelParam = (searchParams.get("channel") || "ALL").toUpperCase();
    const channel: ChannelTabValue = CHANNEL_TABS.some(t => t.value === channelParam)
        ? (channelParam as ChannelTabValue) : "ALL";
    const initialMissionId = searchParams.get("missionId") || "";

    // Data state
    const [missions, setMissions] = useState<MissionItem[]>([]);
    const [missionsLoading, setMissionsLoading] = useState(true);
    const [selectedMissionId, setSelectedMissionId] = useState<string>(initialMissionId);

    const [actions, setActions] = useState<ActionRecord[]>([]);
    const [stats, setStats] = useState<Record<string, any> | null>(null);
    const [hourlySparkData, setHourlySparkData] = useState<number[]>([]);
    const [liveStatus, setLiveStatus] = useState<{ isLive: boolean; activeSdrsCount: number; lastActionAt: string | null }>({
        isLive: false,
        activeSdrsCount: 0,
        lastActionAt: null,
    });
    const [loadingData, setLoadingData] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [newCount, setNewCount] = useState(0);

    const { error: showError, success: showSuccess } = useToast();
    const [sdrOptions, setSdrOptions] = useState<{ id: string; name: string }[]>([]);

    // Drawers & Modals
    const [drawerAction, setDrawerAction] = useState<ActionRecord | null>(null);
    const [callSyncModalOpen, setCallSyncModalOpen] = useState(false);
    const [bulkCallSyncOpen, setBulkCallSyncOpen] = useState(false);
    const [drawerClientBookingUrl, setDrawerClientBookingUrl] = useState<string>("");
    const [drawerClientInterlocuteurs, setDrawerClientInterlocuteurs] = useState<any[]>([]);

    // Filters & table state
    const [search, setSearch] = useState("");
    const [selectedClientId, setSelectedClientId] = useState("");
    const [sdrFilter, setSdrFilter] = useState("");
    const [resultFilters, setResultFilters] = useState<Set<string>>(new Set());
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [density, setDensity] = useState<Density>("default");
    const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
        new Set(["date", "mission", "name", "sdr", "result", "note", "duration"])
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const [liveRefresh, setLiveRefresh] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [showMissionSwitcher, setShowMissionSwitcher] = useState(true);
    const [missionSwitcherSearch, setMissionSwitcherSearch] = useState("");

    const searchRef = useRef<HTMLInputElement>(null);
    const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync channel in URL
    const setChannel = useCallback((ch: ChannelTabValue) => {
        const p = new URLSearchParams(searchParams.toString());
        if (ch === "ALL") p.delete("channel");
        else p.set("channel", ch);
        router.replace(`/manager/prospection?${p.toString()}`, { scroll: false });
    }, [router, searchParams]);

    // Sync mission in URL
    const handleSelectMission = useCallback((missionId: string) => {
        setSelectedMissionId(missionId);
        setPage(1);
        const p = new URLSearchParams(searchParams.toString());
        if (missionId) p.set("missionId", missionId);
        else p.delete("missionId");
        router.replace(`/manager/prospection?${p.toString()}`, { scroll: false });
    }, [router, searchParams]);

    // Init SDR users list
    useEffect(() => {
        let cancelled = false;
        fetch("/api/users?role=SDR,BUSINESS_DEVELOPER")
            .then(r => r.json())
            .then(j => { if (!cancelled && j.success) setSdrOptions(Array.isArray(j.data) ? j.data : []); });
        return () => { cancelled = true; };
    }, []);

    // Load active missions
    const reloadMissionsCatalog = useCallback(() => {
        setMissionsLoading(true);
        const p = new URLSearchParams({ isActive: "true", limit: "200" });
        if (channel !== "ALL") p.set("channel", channel);
        fetch(`/api/missions?${p}`)
            .then(r => r.json())
            .then(j => {
                if (j.success && Array.isArray(j.data)) {
                    setMissions(j.data);
                }
            })
            .finally(() => setMissionsLoading(false));
    }, [channel]);

    useEffect(() => {
        reloadMissionsCatalog();
    }, [reloadMissionsCatalog]);

    // Active selected mission object
    const selectedMission = useMemo(() => {
        if (!selectedMissionId) return null;
        return missions.find(m => m.id === selectedMissionId) || null;
    }, [missions, selectedMissionId]);

    // Unique clients for filter dropdown
    const clientOptions = useMemo(() => {
        const map = new Map<string, string>();
        missions.forEach(m => {
            if (m.client?.id) map.set(m.client.id, m.client.name);
        });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
    }, [missions]);

    // Filtered missions for quick switcher and dropdown
    const availableMissions = useMemo(() => {
        let list = missions;
        if (channel !== "ALL") {
            list = list.filter(m => m.channels?.includes(channel) ?? m.channel === channel);
        }
        if (selectedClientId) {
            list = list.filter(m => m.client?.id === selectedClientId);
        }
        if (sdrFilter) {
            list = list.filter(m => m.sdrAssignments?.some(a => a.sdrId === sdrFilter));
        }
        return list;
    }, [missions, channel, selectedClientId, sdrFilter]);

    // Switcher search filtered missions
    const quickSwitcherMissions = useMemo(() => {
        if (!missionSwitcherSearch.trim()) return availableMissions;
        const q = missionSwitcherSearch.toLowerCase().trim();
        return availableMissions.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.client?.name.toLowerCase().includes(q)
        );
    }, [availableMissions, missionSwitcherSearch]);

    // Keyboard shortcut: "/" focuses search, "Escape" clears
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "SELECT") {
                e.preventDefault();
                searchRef.current?.focus();
            }
            if (e.key === "Escape") {
                setSearch("");
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // Fetch booking URL & interlocuteurs for drawer
    useEffect(() => {
        const targetMissionId = selectedMission?.id || drawerAction?.campaign?.missionId;
        if (!drawerAction || !targetMissionId) {
            setDrawerClientBookingUrl("");
            setDrawerClientInterlocuteurs([]);
            return;
        }
        let cancelled = false;
        fetch(`/api/missions/${targetMissionId}/client-booking`)
            .then(r => r.json())
            .then(j => {
                if (cancelled) return;
                if (j.success) {
                    setDrawerClientBookingUrl(j.data?.bookingUrl || drawerAction.campaign?.mission?.client?.bookingUrl || "");
                    setDrawerClientInterlocuteurs(Array.isArray(j.data?.interlocuteurs) ? j.data.interlocuteurs : []);
                } else {
                    setDrawerClientBookingUrl(drawerAction.campaign?.mission?.client?.bookingUrl || "");
                    setDrawerClientInterlocuteurs([]);
                }
            })
            .catch(() => {
                if (cancelled) return;
                setDrawerClientBookingUrl(drawerAction.campaign?.mission?.client?.bookingUrl || "");
                setDrawerClientInterlocuteurs([]);
            });
        return () => { cancelled = true; };
    }, [drawerAction, selectedMission?.id]);

    // ─────────────────────────────────────────────────────────────────────────
    // DATA FETCHING: ACTIONS & STATS
    // ─────────────────────────────────────────────────────────────────────────

    const fetchProspectionStats = useCallback(async () => {
        const qs = new URLSearchParams();
        if (selectedMissionId) qs.set("missionId", selectedMissionId);
        if (selectedClientId) qs.set("clientId", selectedClientId);
        if (sdrFilter) qs.set("sdrId", sdrFilter);
        if (channel !== "ALL") qs.set("channel", channel);
        if (dateFrom) qs.set("from", `${dateFrom}T00:00:00`);
        if (dateTo) qs.set("to", `${dateTo}T23:59:59.999`);

        try {
            const res = await fetch(`/api/manager/prospection/stats?${qs.toString()}`);
            const json = await res.json();
            if (json.success && json.data) {
                setStats(json.data);
                if (Array.isArray(json.data.hourlySparkData)) {
                    setHourlySparkData(json.data.hourlySparkData);
                }
                if (json.data.liveStatus) {
                    setLiveStatus(json.data.liveStatus);
                }
            }
        } catch (err) {
            console.error("Failed to load prospection stats", err);
        }
    }, [selectedMissionId, selectedClientId, sdrFilter, channel, dateFrom, dateTo]);

    const fetchProspectionActions = useCallback(async (silent = false) => {
        if (!silent) setLoadingData(true);
        const qs = new URLSearchParams({ limit: "2000" });
        if (selectedMissionId) qs.set("missionId", selectedMissionId);
        if (selectedClientId) qs.set("clientId", selectedClientId);
        if (channel !== "ALL") qs.set("channel", channel);
        if (sdrFilter) qs.set("sdrId", sdrFilter);
        if (dateFrom) qs.set("from", `${dateFrom}T00:00:00`);
        if (dateTo) qs.set("to", `${dateTo}T23:59:59.999`);

        try {
            const res = await fetch(`/api/actions?${qs.toString()}`);
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                const next: ActionRecord[] = json.data.map((a: ActionRecord) => ({
                    ...a,
                    _searchKey: [
                        getContactName(a),
                        getCompanyName(a),
                        a.campaign?.name,
                        a.campaign?.mission?.name,
                        a.campaign?.mission?.client?.name,
                        a.note,
                        a.callSummary,
                        a.callTranscription,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase(),
                }));

                setActions(prev => {
                    const added = next.filter(n => !prev.some(p => p.id === n.id)).length;
                    if (added > 0 && !silent) setNewCount(c => c + added);
                    return next;
                });
                setLastRefresh(new Date());
            }
        } finally {
            if (!silent) setLoadingData(false);
        }
    }, [selectedMissionId, selectedClientId, channel, sdrFilter, dateFrom, dateTo]);

    // Initial and dependencies fetch
    useEffect(() => {
        fetchProspectionActions();
        fetchProspectionStats();
    }, [fetchProspectionActions, fetchProspectionStats]);

    // Live auto-refresh every 30s
    useEffect(() => {
        if (!liveRefresh) {
            if (liveTimerRef.current) clearInterval(liveTimerRef.current);
            return;
        }
        liveTimerRef.current = setInterval(() => {
            fetchProspectionActions(true);
            fetchProspectionStats();
        }, 30_000);
        return () => { if (liveTimerRef.current) clearInterval(liveTimerRef.current); };
    }, [liveRefresh, fetchProspectionActions, fetchProspectionStats]);

    // Export handler
    const handleExport = useCallback(() => {
        const rowsToExport = selectedIds.size > 0
            ? actions.filter(a => selectedIds.has(a.id))
            : actions;
        const label = selectedMission ? selectedMission.name : "toutes_missions";
        exportCSV(rowsToExport, label);
    }, [actions, selectedIds, selectedMission]);

    // ─────────────────────────────────────────────────────────────────────────
    // FILTERED & SORTED ACTION ROWS
    // ─────────────────────────────────────────────────────────────────────────

    const resultCounts = useMemo(() => {
        const map: Record<string, number> = {};
        actions.forEach(a => { map[a.result] = (map[a.result] || 0) + 1; });
        return map;
    }, [actions]);

    const uniqueResults = useMemo(() =>
        Array.from(new Set(actions.map(a => a.result))).sort(),
        [actions]);

    const handleSort = useCallback((key: SortKey) => {
        setSortKey(prev => {
            if (prev === key) setSortDir(d => d === "asc" ? "desc" : "asc");
            else setSortDir("desc");
            return key;
        });
        setPage(1);
    }, []);

    const toggleResult = useCallback((r: string) => {
        setResultFilters(prev => {
            const next = new Set(prev);
            if (next.has(r)) next.delete(r); else next.add(r);
            return next;
        });
        setPage(1);
    }, []);

    const toggleCol = useCallback((k: ColKey) => {
        setVisibleCols(prev => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k); else next.add(k);
            return next;
        });
    }, []);

    const processed = useMemo(() => {
        let rows = actions.filter(a => {
            if (resultFilters.size && !resultFilters.has(a.result)) return false;
            if (search && !a._searchKey?.includes(search.toLowerCase())) return false;
            return true;
        });

        rows.sort((a, b) => {
            let cmp = 0;
            if (sortKey === "createdAt") {
                const ak = (a.callbackDate as string | null) || a.createdAt;
                const bk = (b.callbackDate as string | null) || b.createdAt;
                cmp = new Date(ak).getTime() - new Date(bk).getTime();
            } else if (sortKey === "result") {
                cmp = a.result.localeCompare(b.result);
            } else if (sortKey === "sdr") {
                cmp = (a.sdr?.name || "").localeCompare(b.sdr?.name || "");
            } else if (sortKey === "duration") {
                cmp = (a.duration || 0) - (b.duration || 0);
            } else if (sortKey === "name") {
                const na = getContactName(a) || getCompanyName(a);
                const nb = getContactName(b) || getCompanyName(b);
                cmp = na.localeCompare(nb);
            } else if (sortKey === "mission") {
                const ma = a.campaign?.mission?.name || "";
                const mb = b.campaign?.mission?.name || "";
                cmp = ma.localeCompare(mb);
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
        return rows;
    }, [actions, resultFilters, search, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
    const pageRows = processed.slice((page - 1) * pageSize, page * pageSize);

    // Bulk selection
    const allPageSelected = pageRows.length > 0 && pageRows.every(r => selectedIds.has(r.id));
    const togglePageSelect = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allPageSelected) pageRows.forEach(r => next.delete(r.id));
            else pageRows.forEach(r => next.add(r.id));
            return next;
        });
    };
    const toggleRow = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Derived counts for KPI
    const sc = {
        total: stats?.total ?? actions.length,
        rdv: stats?.resultBreakdown?.MEETING_BOOKED ?? resultCounts["MEETING_BOOKED"] ?? 0,
        interested: stats?.resultBreakdown?.INTERESTED ?? resultCounts["INTERESTED"] ?? 0,
        callbacks: stats?.resultBreakdown?.CALLBACK_REQUESTED ?? resultCounts["CALLBACK_REQUESTED"] ?? 0,
        rate: stats?.conversionRate ? parseFloat(stats.conversionRate).toFixed(1) : (
            actions.length > 0 ? (((resultCounts["MEETING_BOOKED"] ?? 0) / actions.length) * 100).toFixed(1) : "0.0"
        ),
    };

    const rowPy = density === "compact" ? "py-2" : density === "comfortable" ? "py-4" : "py-3";
    const hasFilters = !!(selectedMissionId || selectedClientId || sdrFilter || search || resultFilters.size || dateFrom || dateTo);

    const resetAllFilters = () => {
        setSelectedMissionId("");
        setSelectedClientId("");
        setSdrFilter("");
        setSearch("");
        setResultFilters(new Set());
        setDateFrom("");
        setDateTo("");
        setPage(1);
        const p = new URLSearchParams(searchParams.toString());
        p.delete("missionId");
        router.replace(`/manager/prospection?${p.toString()}`, { scroll: false });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER UNIFIED COCKPIT
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="w-full min-w-0 space-y-6 max-w-[1600px] mx-auto pb-10">

            {/* ── 1. Top Executive Cockpit Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#0B0F19] text-[#2890F8] flex items-center justify-center shadow-md shadow-black/15 border border-slate-800 shrink-0">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                    Cockpit Prospection &amp; Téléphonie
                                </h1>
                                <LivePulse activeSdrsCount={liveStatus.activeSdrsCount} isLive={liveStatus.isLive} />
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Télémétrie en temps réel, écoutes d&apos;appels, flux SDR multi-missions et conversion.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Channel segmented tabs */}
                    <div role="tablist" aria-label="Canaux" className="flex items-center p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        {CHANNEL_TABS.map(tab => {
                            const Icon = tab.icon;
                            const active = channel === tab.value;
                            return (
                                <button
                                    key={tab.value}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setChannel(tab.value)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        active
                                            ? "bg-[#0B0F19] text-white shadow-2xs"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" aria-hidden />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Live auto-refresh toggle */}
                    <button
                        type="button"
                        onClick={() => setLiveRefresh(v => !v)}
                        aria-pressed={liveRefresh}
                        className={cn(
                            "h-9 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs",
                            liveRefresh
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                        title={liveRefresh ? "Rafraîchissement automatique activé (30s)" : "Rafraîchissement automatique désactivé"}
                    >
                        <Radio className={cn("w-3.5 h-3.5", liveRefresh && "animate-pulse")} aria-hidden />
                        Live
                    </button>

                    {/* Manual Refresh */}
                    <button
                        type="button"
                        onClick={() => {
                            fetchProspectionActions();
                            fetchProspectionStats();
                            setNewCount(0);
                        }}
                        disabled={loadingData}
                        className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs disabled:opacity-60"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loadingData && "animate-spin")} aria-hidden />
                        Actualiser
                    </button>

                    {/* Sync Allo button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (selectedMission) setCallSyncModalOpen(true);
                            else setBulkCallSyncOpen(true);
                        }}
                        className="h-9 px-3.5 flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-all shadow-2xs"
                        title={selectedMission ? `Synchroniser les appels Allo pour ${selectedMission.name}` : "Synchroniser les appels Allo pour toutes les missions"}
                    >
                        <Mic className="w-3.5 h-3.5 text-[#2890F8]" aria-hidden />
                        {selectedMission ? "Sync appels Allo" : "Sync Allo"}
                    </button>

                    {/* Export CSV */}
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={exporting || actions.length === 0}
                        className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs disabled:opacity-50"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── 2. Five Hero KPI Telemetry Strip ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Actions Totales */}
                <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-[#0A1224] via-[#08101E] to-[#050B16] border border-slate-800/80 shadow-lg shadow-black/20 flex flex-col justify-between group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/15 transition-all" />
                    <div className="flex items-center justify-between z-10">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#2890F8]">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#2890F8] text-[10px] font-bold">
                            Télémétrie
                        </span>
                    </div>
                    <div className="my-3 z-10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actions Totales</p>
                        <p className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-0.5 tabular-nums">
                            {sc.total}
                        </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 z-10">
                        <span>Flux d&apos;activité récente</span>
                        <Sparkline data={hourlySparkData} color="#2890F8" />
                    </div>
                </div>

                {/* 2. RDV Planifiés */}
                <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-[#0B0F19] via-[#090C14] to-[#04060A] border border-amber-900/40 shadow-lg shadow-black/20 flex flex-col justify-between group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/15 transition-all" />
                    <div className="flex items-center justify-between z-10">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <CalendarPlus className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                            Succès RDV
                        </span>
                    </div>
                    <div className="my-3 z-10">
                        <p className="text-xs font-bold text-amber-200/70 uppercase tracking-wider">RDV Planifiés</p>
                        <p className="text-3xl sm:text-4xl font-black text-amber-100 tracking-tight mt-0.5 tabular-nums">
                            {sc.rdv}
                        </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-amber-200/60 pt-2 border-t border-amber-900/40 z-10">
                        <span>Objectif de conversion</span>
                        <span className="text-amber-400 font-bold">{sc.rate}%</span>
                    </div>
                </div>

                {/* 3. Intéressés */}
                <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-teal-50/70 border border-emerald-200/80 shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between z-10">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
                            <ThumbsUp className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                            Intérêt
                        </span>
                    </div>
                    <div className="my-3 z-10">
                        <p className="text-xs font-bold text-emerald-900/60 uppercase tracking-wider">Intéressés</p>
                        <p className="text-3xl sm:text-4xl font-black text-emerald-950 tracking-tight mt-0.5 tabular-nums">
                            {sc.interested}
                        </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-emerald-800 pt-2 border-t border-emerald-200/60 z-10">
                        <span>Leads qualifiés chauds</span>
                        <ChevronRight className="w-4 h-4 text-emerald-600" />
                    </div>
                </div>

                {/* 4. Rappels Demandés */}
                <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-amber-50/90 via-amber-50/50 to-orange-50/70 border border-amber-200/80 shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between z-10">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
                            <Clock className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100/80 border border-amber-200 text-amber-800 text-[10px] font-bold">
                            Rappels
                        </span>
                    </div>
                    <div className="my-3 z-10">
                        <p className="text-xs font-bold text-amber-900/60 uppercase tracking-wider">Rappels Demandés</p>
                        <p className="text-3xl sm:text-4xl font-black text-amber-950 tracking-tight mt-0.5 tabular-nums">
                            {sc.callbacks}
                        </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-amber-800 pt-2 border-t border-amber-200/60 z-10">
                        <span>À recontacter sous 48h</span>
                        <ChevronRight className="w-4 h-4 text-amber-600" />
                    </div>
                </div>

                {/* 5. Taux de Conversion */}
                <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-violet-50/90 via-indigo-50/50 to-purple-50/70 border border-violet-200/80 shadow-2xs flex flex-col justify-between group">
                    <div className="flex items-center justify-between z-10">
                        <div className="w-10 h-10 rounded-2xl bg-violet-100/80 border border-violet-200 flex items-center justify-center text-violet-600 shadow-2xs">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-violet-100/80 border border-violet-200 text-violet-800 text-[10px] font-bold">
                            Performance
                        </span>
                    </div>
                    <div className="my-3 z-10">
                        <p className="text-xs font-bold text-violet-900/60 uppercase tracking-wider">Taux de Conversion</p>
                        <p className="text-3xl sm:text-4xl font-black text-violet-950 tracking-tight mt-0.5 tabular-nums">
                            {sc.rate}%
                        </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-violet-800 pt-2 border-t border-violet-200/60 z-10">
                        <span>Benchmark global SDR</span>
                        <Sparkles className="w-4 h-4 text-violet-600" />
                    </div>
                </div>
            </div>

            {/* ── 3. Quick Mission Switcher & Performance Bar ── */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-[#2890F8]" />
                        <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Missions en prospection ({availableMissions.length})
                        </h2>
                        {selectedMission && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                                Filtré : {selectedMission.name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-48 hidden sm:block">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Filtrer mission..."
                                value={missionSwitcherSearch}
                                onChange={e => setMissionSwitcherSearch(e.target.value)}
                                className="w-full h-8 pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2890F8]"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMissionSwitcher(s => !s)}
                            className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 p-1 rounded-lg hover:bg-slate-100"
                        >
                            {showMissionSwitcher ? "Masquer" : "Afficher"}
                            {showMissionSwitcher ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {showMissionSwitcher && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-200">
                        {/* "Toutes les missions" Pill */}
                        <button
                            type="button"
                            onClick={() => handleSelectMission("")}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs",
                                !selectedMissionId
                                    ? "bg-[#0B0F19] text-white border-slate-900 shadow-md"
                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300"
                            )}
                        >
                            <Activity className={cn("w-3.5 h-3.5", !selectedMissionId ? "text-[#2890F8]" : "text-slate-400")} />
                            <span>Toutes les missions</span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-lg text-[10px] font-black",
                                !selectedMissionId ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
                            )}>
                                {actions.length}
                            </span>
                        </button>

                        {/* Individual Mission Pills */}
                        {quickSwitcherMissions.map((m) => {
                            const isSelected = selectedMissionId === m.id;
                            const channelList = m.channels?.length ? m.channels : [m.channel];
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleSelectMission(isSelected ? "" : m.id)}
                                    className={cn(
                                        "group flex items-center gap-2.5 px-3 py-1.5 rounded-2xl border text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-2xs",
                                        isSelected
                                            ? "bg-blue-50/90 border-[#2890F8] text-blue-900 ring-2 ring-[#2890F8]/20"
                                            : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/30"
                                    )}
                                >
                                    <div className={cn(
                                        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                                        isSelected ? "bg-[#2890F8] text-white" : "bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700"
                                    )}>
                                        {m.client?.name?.[0] || m.name[0] || "M"}
                                    </div>
                                    <div className="text-left min-w-0">
                                        <p className="text-xs font-bold truncate max-w-[130px] leading-tight">
                                            {m.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate max-w-[130px] leading-tight">
                                            {m.client?.name}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {channelList.slice(0, 1).map((ch) => {
                                            const Icon = CHANNEL_ICONS[ch] ?? Phone;
                                            return (
                                                <span key={ch} className="p-1 rounded-md bg-slate-100 text-slate-500">
                                                    <Icon className="w-2.5 h-2.5" />
                                                </span>
                                            );
                                        })}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── 4. Selected Mission Highlight Banner (Contextual) ── */}
            {selectedMission && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border border-blue-200/80 shadow-xs">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center font-black text-lg shadow-md shadow-black/10 shrink-0">
                            {selectedMission.client?.name?.[0] || "M"}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-black text-slate-900">
                                    {selectedMission.name}
                                </h3>
                                <span className="px-2 py-0.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-[10px] font-bold uppercase">
                                    Mission Active
                                </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-500 flex items-center gap-2 mt-0.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>{selectedMission.client?.name}</span>
                                {selectedMission.sdrAssignments && selectedMission.sdrAssignments.length > 0 && (
                                    <>
                                        <span>•</span>
                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{selectedMission.sdrAssignments.length} SDR assigné{selectedMission.sdrAssignments.length > 1 ? "s" : ""}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Mission actions */}
                        <button
                            type="button"
                            onClick={() => setCallSyncModalOpen(true)}
                            className="h-8 px-3 rounded-xl bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                            <Mic className="w-3.5 h-3.5" />
                            Sync appels Allo
                        </button>

                        {selectedMission.client?.bookingUrl && (
                            <a
                                href={selectedMission.client.bookingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="h-8 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                Prise de RDV Client
                            </a>
                        )}

                        <button
                            type="button"
                            onClick={() => handleSelectMission("")}
                            className="h-8 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                            <X className="w-3.5 h-3.5" />
                            Voir toutes les missions
                        </button>
                    </div>
                </div>
            )}

            {/* ── 5. Search & Advanced Filter Bar ── */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-4 space-y-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Search box */}
                    <div className="flex-1 min-w-[240px] relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Rechercher contact, société, note, mission... ( / )"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full h-10 pl-10 pr-8 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 focus:border-[#2890F8] transition-all placeholder:text-slate-400"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Mission select filter */}
                    <select
                        value={selectedMissionId}
                        onChange={e => handleSelectMission(e.target.value)}
                        className="h-10 px-3 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 min-w-[180px] max-w-[240px] cursor-pointer"
                    >
                        <option value="">Toutes les missions ({missions.length})</option>
                        {availableMissions.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.name} {m.client?.name ? `(${m.client.name})` : ""}
                            </option>
                        ))}
                    </select>

                    {/* Client select filter */}
                    <select
                        value={selectedClientId}
                        onChange={e => { setSelectedClientId(e.target.value); setPage(1); }}
                        className="h-10 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 min-w-[150px] cursor-pointer"
                    >
                        <option value="">Tous les clients</option>
                        {clientOptions.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>

                    {/* SDR filter */}
                    <select
                        value={sdrFilter}
                        onChange={e => { setSdrFilter(e.target.value); setPage(1); }}
                        className="h-10 px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20 min-w-[150px] cursor-pointer"
                    >
                        <option value="">Tous les utilisateurs</option>
                        {sdrOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    {/* Date range filter */}
                    <div className="flex items-center gap-1.5">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="h-10 px-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-[#2890F8] cursor-pointer"
                            title="Date de début"
                        />
                        <span className="text-xs text-slate-400 font-bold">→</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="h-10 px-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-[#2890F8] cursor-pointer"
                            title="Date de fin"
                        />
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        {hasFilters && (
                            <button
                                type="button"
                                onClick={resetAllFilters}
                                className="h-10 px-3 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-all shadow-2xs cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Réinitialiser
                            </button>
                        )}
                        <ColToggle visible={visibleCols} onToggle={toggleCol} />
                        <DensityToggle value={density} onChange={setDensity} />

                        {/* Page Size Select */}
                        <div className="flex items-center gap-1.5 h-10 px-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Lignes :</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
                            >
                                {[25, 50, 100, 200].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Result filter chips with counters */}
                {uniqueResults.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                        <ResultFilterBar
                            results={uniqueResults}
                            active={resultFilters}
                            onToggle={toggleResult}
                            counts={resultCounts}
                        />
                    </div>
                )}
            </div>

            {/* ── 6. Bulk Action Bar ── */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0B0F19] text-white shadow-xl shadow-black/20 border border-slate-800 animate-in slide-in-from-bottom-2 duration-200">
                    <span className="text-xs font-bold text-[#2890F8]">
                        {selectedIds.size} action{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}
                    </span>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => exportCSV(processed.filter(r => selectedIds.has(r.id)), "selection")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" aria-hidden />
                        Exporter
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
                    >
                        <X className="w-3.5 h-3.5" aria-hidden />
                        Désélectionner
                    </button>
                </div>
            )}

            {/* ── 7. Comprehensive Action Feed Table ── */}
            <div className="rounded-3xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                {loadingData && actions.length === 0 ? (
                    <div className="grid gap-3 p-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : processed.length === 0 ? (
                    <div className="text-center py-20 bg-white">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 border border-slate-200">
                            <Filter className="w-7 h-7 text-slate-400" />
                        </div>
                        <p className="text-base font-bold text-slate-900">Aucune action trouvée</p>
                        <p className="text-xs text-slate-400 mt-1 mb-4">
                            Modifiez vos filtres ou sélectionnez une autre mission.
                        </p>
                        <button
                            type="button"
                            onClick={resetAllFilters}
                            className="px-4 py-2 rounded-xl bg-[#2890F8] text-white text-xs font-bold hover:bg-[#1a75ce] transition-colors"
                        >
                            Réinitialiser les critères
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse" role="grid" aria-label="Historique des prospections">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/80">
                                    <th className="w-10 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allPageSelected}
                                            onChange={togglePageSelect}
                                            className="w-4 h-4 rounded border-slate-300 accent-[#2890F8] cursor-pointer"
                                        />
                                    </th>
                                    {visibleCols.has("date") && (
                                        <Th label="Date" sortKey="createdAt" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                                    )}
                                    {visibleCols.has("mission") && (
                                        <Th label="Mission & Client" sortKey="mission" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="min-w-[180px]" />
                                    )}
                                    {visibleCols.has("name") && (
                                        <Th label="Contact / Société" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} className="min-w-[200px]" />
                                    )}
                                    {visibleCols.has("sdr") && (
                                        <Th label="Auteur" sortKey="sdr" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                                    )}
                                    {visibleCols.has("result") && (
                                        <Th label="Résultat" sortKey="result" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                                    )}
                                    {visibleCols.has("note") && (
                                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 min-w-[240px]">
                                            Résumé / Note Leexi
                                        </th>
                                    )}
                                    {visibleCols.has("duration") && (
                                        <Th label="Durée" sortKey="duration" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                                    )}
                                    <th className="w-12 px-3 py-3 text-right" aria-hidden />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pageRows.map((row) => {
                                    const isSelected = selectedIds.has(row.id);
                                    const displaySummary = getActionDisplaySummary(row);
                                    const contactName = getContactName(row);
                                    const companyName = getCompanyName(row);
                                    const name = contactName || companyName || "Non renseigné";
                                    const showCompany = companyName && companyName !== name;
                                    const missionName = row.campaign?.mission?.name || "Sans mission";
                                    const clientName = row.campaign?.mission?.client?.name || "";
                                    const missionId = row.campaign?.missionId;

                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => setDrawerAction(row)}
                                            className={cn(
                                                "group cursor-pointer transition-colors duration-100",
                                                isSelected
                                                    ? "bg-blue-50/60 hover:bg-blue-50"
                                                    : "hover:bg-slate-50/70"
                                            )}
                                            aria-selected={isSelected}
                                        >
                                            {/* Checkbox */}
                                            <td
                                                className={cn("px-4 text-center", rowPy)}
                                                onClick={e => { e.stopPropagation(); toggleRow(row.id); }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleRow(row.id)}
                                                    className="w-4 h-4 rounded border-slate-300 accent-[#2890F8] cursor-pointer"
                                                />
                                            </td>

                                            {/* Date */}
                                            {visibleCols.has("date") && (
                                                <td className={cn("px-4 whitespace-nowrap", rowPy)}>
                                                    {(() => {
                                                        const d = new Date(row.createdAt);
                                                        const cb = row.callbackDate ? new Date(row.callbackDate as string) : null;
                                                        return (
                                                            <>
                                                                <p className="text-xs font-bold text-slate-800 tabular-nums">
                                                                    {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 font-medium tabular-nums">
                                                                    {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                                                </p>
                                                                {cb && !Number.isNaN(cb.getTime()) && (
                                                                    <p className="text-[10px] text-amber-700 font-bold mt-0.5 tabular-nums flex items-center gap-1">
                                                                        <Clock className="w-2.5 h-2.5" />
                                                                        {cb.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                                                    </p>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                            )}

                                            {/* Mission & Client */}
                                            {visibleCols.has("mission") && (
                                                <td className={cn("px-4", rowPy)}>
                                                    <div className="min-w-0 max-w-[180px]">
                                                        {clientName && (
                                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                                                                {clientName}
                                                            </p>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (missionId) handleSelectMission(missionId);
                                                            }}
                                                            className="text-xs font-bold text-slate-800 hover:text-[#2890F8] truncate block text-left transition-colors"
                                                            title="Filtrer sur cette mission"
                                                        >
                                                            {missionName}
                                                        </button>
                                                    </div>
                                                </td>
                                            )}

                                            {/* Contact / Company */}
                                            {visibleCols.has("name") && (
                                                <td className={cn("px-4", rowPy)}>
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                                                            {row.contactId ? (
                                                                (row.contact?.firstName?.[0] || row.contact?.lastName?.[0] || "?").toUpperCase()
                                                            ) : (
                                                                (row.company?.name?.[0] || "?").toUpperCase()
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 max-w-[200px]">
                                                            <p className="text-xs font-bold text-slate-900 truncate">{name}</p>
                                                            {showCompany && (
                                                                <p className="text-[11px] text-slate-400 font-medium truncate">{companyName}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            )}

                                            {/* SDR */}
                                            {visibleCols.has("sdr") && (
                                                <td className={cn("px-4 whitespace-nowrap", rowPy)}>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black text-slate-600 shrink-0">
                                                            {(row.sdr?.name?.[0] || "?").toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-700">{row.sdr?.name || "Non assigné"}</span>
                                                    </div>
                                                </td>
                                            )}

                                            {/* Result */}
                                            {visibleCols.has("result") && (
                                                <td className={cn("px-4 whitespace-nowrap", rowPy)}>
                                                    <ResultBadge result={row.result} />
                                                </td>
                                            )}

                                            {/* Summary / Note */}
                                            {visibleCols.has("note") && (
                                                <td className={cn("px-4 max-w-[320px]", rowPy)}>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            {row.callRecordingUrl && (
                                                                <span className="p-0.5 rounded bg-emerald-50 text-emerald-600" title="Enregistrement audio disponible">
                                                                    <Volume2 className="w-3 h-3" />
                                                                </span>
                                                            )}
                                                            {row.callSummary && (
                                                                <span className="text-[10px] font-bold text-[#2890F8] bg-blue-50 px-1.5 py-0.2 rounded">
                                                                    Leexi
                                                                </span>
                                                            )}
                                                        </div>
                                                        {displaySummary ? (
                                                            <p className="text-xs text-slate-600 line-clamp-2" title={displaySummary}>
                                                                {displaySummary}
                                                            </p>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">Non renseigné</span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}

                                            {/* Duration */}
                                            {visibleCols.has("duration") && (
                                                <td className={cn("px-4 whitespace-nowrap", rowPy)}>
                                                    {row.duration ? (
                                                        <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                                            {Math.floor(row.duration / 60)}:{String(row.duration % 60).padStart(2, "0")}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">-</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Action Chevron */}
                                            <td className={cn("pr-4 text-right", rowPy)} onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => setDrawerAction(row)}
                                                    aria-label="Voir la fiche"
                                                    className="p-1 rounded-lg hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-[#2890F8]"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── 8. Pagination ── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-xs font-semibold text-slate-500">
                            Page {page} / {totalPages} — {processed.length} résultat{processed.length > 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                            >
                                «
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronUp className="w-3.5 h-3.5 -rotate-90" />
                            </button>

                            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                let p: number;
                                if (totalPages <= 7) p = i + 1;
                                else if (page <= 4) p = i + 1;
                                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                                else p = page - 3 + i;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPage(p)}
                                        className={cn(
                                            "h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors",
                                            page === p
                                                ? "bg-[#0B0F19] text-white shadow-2xs"
                                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        {p}
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                            >
                                »
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 9. Drawers & Modals ── */}
            {/* Single Mission Call Sync */}
            {selectedMission && (
                <ManagerCallEnrichmentSyncModal
                    isOpen={callSyncModalOpen}
                    onClose={() => setCallSyncModalOpen(false)}
                    missionId={selectedMission.id}
                    missionName={selectedMission.name}
                    onSynced={() => {
                        fetchProspectionActions(true);
                        fetchProspectionStats();
                    }}
                    onToast={(kind, title, message) => {
                        if (kind === "success") showSuccess(title, message);
                        else showError(title, message);
                    }}
                />
            )}

            {/* Bulk All Missions Call Sync */}
            <ManagerCallEnrichmentSyncModal
                isOpen={bulkCallSyncOpen}
                onClose={() => setBulkCallSyncOpen(false)}
                onSynced={() => {
                    fetchProspectionActions(true);
                    fetchProspectionStats();
                    reloadMissionsCatalog();
                }}
                onToast={(kind, title, message) => {
                    if (kind === "success") showSuccess(title, message);
                    else showError(title, message);
                }}
            />

            {/* Unified Action Drawer */}
            {drawerAction && (
                <UnifiedActionDrawer
                    isOpen={!!drawerAction}
                    onClose={() => setDrawerAction(null)}
                    contactId={drawerAction.contactId || null}
                    companyId={drawerAction.companyId || drawerAction.contact?.company?.id || ""}
                    missionId={selectedMission?.id || drawerAction.campaign?.missionId}
                    missionName={selectedMission?.name || drawerAction.campaign?.mission?.name}
                    clientBookingUrl={drawerClientBookingUrl || undefined}
                    clientInterlocuteurs={drawerClientInterlocuteurs}
                    onActionRecorded={() => {
                        fetchProspectionActions(true);
                        fetchProspectionStats();
                    }}
                    onContactSelect={(newContactId) => {
                        setDrawerAction({
                            ...drawerAction,
                            contactId: newContactId,
                        });
                    }}
                />
            )}
        </div>
    );
}
