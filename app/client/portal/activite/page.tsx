"use client";

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    Activity,
    Briefcase,
    CalendarDays,
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    Mail,
    Phone,
    PhoneCall,
    RefreshCw,
    Search,
    TrendingUp,
    X,
} from "lucide-react";
import { Drawer, useToast } from "@/components/ui";
import { ACTION_RESULT_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    DISPLAY_TZ,
    displayDayKey,
    displayDayKeyDaysAgo,
    displayDayRange,
} from "@/lib/date";

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface CallItem {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    result: string;
    note?: string | null;
    duration?: number | null;
    company?: { name: string; industry?: string | null; country?: string | null } | null;
    contact?: {
        firstName?: string | null;
        lastName?: string | null;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        company?: { name: string; industry?: string | null; country?: string | null } | null;
    } | null;
    campaign: { name: string; mission: { name: string } };
}

interface StatusDef {
    code: string; label: string; color: string | null; sortOrder: number; resultCategoryCode: string | null;
}
interface ResultCategoryDef {
    id: string; code: string; label: string; color: string | null; sortOrder: number;
}
type ResultMeta = Record<string, { label: string; color: string }>;

/* Fallback palette, aligned to the app's slate + #2890F8 vocabulary. */
const RESULT_META_FALLBACK: ResultMeta = {
    MEETING_BOOKED:     { label: "RDV pris",        color: "#059669" },
    CALLBACK_REQUESTED: { label: "Rappel demandé",  color: "#d97706" },
    INTERESTED:         { label: "Intéressé",       color: "#2890F8" },
    NO_RESPONSE:        { label: "Pas de réponse",  color: "#64748b" },
    DISQUALIFIED:       { label: "Disqualifié",     color: "#e11d48" },
};
const DEFAULT_STATUS_ORDER = Object.keys(RESULT_META_FALLBACK);
const NEUTRAL = "#64748b";

function buildResultMeta(statuses: StatusDef[], categories: ResultCategoryDef[]): ResultMeta {
    const catByCode = Object.fromEntries(categories.map((c) => [c.code, c]));
    const meta: ResultMeta = {};
    for (const s of statuses) {
        meta[s.code] = {
            label: s.label,
            color: s.color ?? catByCode[s.resultCategoryCode ?? ""]?.color ?? NEUTRAL,
        };
    }
    return meta;
}

const PERIODS = [
    { key: "7",  label: "7 j" },
    { key: "30", label: "30 j" },
    { key: "60", label: "60 j" },
    { key: "90", label: "3 mois" },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function fmtDuration(s: number | null | undefined): string | null {
    if (!s || s <= 0) return null;
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: DISPLAY_TZ });
}
function fmtDayLabel(dayKey: string): string {
    const d = new Date(`${dayKey}T12:00:00`);
    const today = displayDayKey(new Date());
    const yesterday = displayDayKeyDaysAgo(1);
    if (dayKey === today) return "Aujourd'hui";
    if (dayKey === yesterday) return "Hier";
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function getInitials(first?: string | null, last?: string | null): string {
    const i = `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;
    return i || "?";
}
/** Deterministic hue per contact — replaces the hardcoded gradient map. */
function avatarHue(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
    return Math.abs(h) % 360;
}
function contactName(c: CallItem): string {
    return [c.contact?.firstName, c.contact?.lastName].filter(Boolean).join(" ") || "Contact";
}
function companyName(c: CallItem): string {
    return c.contact?.company?.name ?? c.company?.name ?? "Entreprise inconnue";
}

function exportCSV(rows: CallItem[], meta: ResultMeta) {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const head = ["Date","Heure","Résultat","Mission","Campagne","Prénom","Nom","Poste","Entreprise","Email","Téléphone","Durée (s)","Note"];
    const body = rows.map((c) => [
        displayDayKey(c.createdAt),
        fmtTime(c.createdAt),
        meta[c.result]?.label ?? ACTION_RESULT_LABELS[c.result] ?? c.result,
        c.campaign?.mission?.name ?? "",
        c.campaign?.name ?? "",
        c.contact?.firstName ?? "",
        c.contact?.lastName ?? "",
        c.contact?.title ?? "",
        companyName(c),
        c.contact?.email ?? "",
        c.contact?.phone ?? "",
        c.duration != null ? String(c.duration) : "",
        c.note ?? "",
    ].map(String).map(esc));
    const csv = [head.join(","), ...body.map((r) => r.join(","))].join("\n");
    const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })),
        download: `activite-${displayDayKey(new Date())}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
}

/* ═══════════════════════════════════════════════════════════════
   PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function ResultChip({ result, meta, size = "sm" }: { result: string; meta: ResultMeta; size?: "sm" | "xs" }) {
    const m = meta[result] ?? { label: ACTION_RESULT_LABELS[result] ?? result, color: NEUTRAL };
    return (
        <span
            style={{ background: `${m.color}14`, borderColor: `${m.color}55`, color: m.color }}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border font-bold leading-none whitespace-nowrap",
                size === "sm" ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
            )}
        >
            <span style={{ background: m.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" />
            {m.label}
        </span>
    );
}

function Avatar({ call, size = 32 }: { call: CallItem; size?: number }) {
    const hue = avatarHue(companyName(call) + contactName(call));
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-xl font-bold"
            style={{
                width: size, height: size, fontSize: size * 0.36,
                background: `hsl(${hue} 45% 93%)`, color: `hsl(${hue} 55% 32%)`,
            }}
            aria-hidden="true"
        >
            {getInitials(call.contact?.firstName, call.contact?.lastName)}
        </div>
    );
}

/* ── Activity heatmap: answers "are you working my account?" at a glance ── */

/** Monday-first, matching the column padding below. */
const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
const CELL = "h-3.5 w-3.5";

function HeatmapStrip({ days, countsByDay, activeDay, onPickDay }: {
    days: string[];
    countsByDay: Record<string, number>;
    activeDay: string | null;
    onPickDay: (day: string | null) => void;
}) {
    const max = Math.max(1, ...days.map((d) => countsByDay[d] ?? 0));
    const level = (n: number) => (n === 0 ? 0 : n / max <= 0.25 ? 1 : n / max <= 0.5 ? 2 : n / max <= 0.75 ? 3 : 4);
    const TONES = ["bg-slate-100", "bg-blue-100", "bg-blue-300", "bg-blue-500", "bg-blue-700"];

    // Pad so each column is a Mon–Sun week.
    const firstWeekday = (new Date(`${days[0]}T12:00:00`).getDay() + 6) % 7;
    const cells: (string | null)[] = [...Array<null>(firstWeekday).fill(null), ...days];

    // One label per column, printed only when the month changes. Labels are wider
    // than their 14px column, so the row is allowed to overflow like GitHub's.
    const columnCount = Math.ceil(cells.length / 7);
    const monthLabels: (string | null)[] = [];
    let lastMonth = "";
    for (let c = 0; c < columnCount; c++) {
        const firstDay = cells.slice(c * 7, c * 7 + 7).find(Boolean);
        if (!firstDay) { monthLabels.push(null); continue; }
        const month = new Date(`${firstDay}T12:00:00`).toLocaleDateString("fr-FR", { month: "short" });
        monthLabels.push(month === lastMonth ? null : month);
        lastMonth = month;
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Couverture de la période
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                    Moins
                    {TONES.map((t) => <span key={t} className={cn("h-2.5 w-2.5 rounded-sm", t)} />)}
                    Plus
                </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
                {/* Weekday gutter. Every other day is labelled, so 14px rows stay legible. */}
                <div className="grid shrink-0 grid-rows-7 gap-1 pt-[15px]">
                    {WEEKDAY_INITIALS.map((d, i) => (
                        <span
                            key={i}
                            aria-hidden="true"
                            className={cn("flex items-center text-[9px] font-bold leading-none text-slate-400", CELL)}
                        >
                            {i % 2 === 0 ? d : ""}
                        </span>
                    ))}
                </div>

                <div className="shrink-0">
                    <div className="mb-1 grid h-[11px] grid-flow-col auto-cols-[14px] gap-1">
                        {monthLabels.map((label, i) => (
                            <span
                                key={i}
                                aria-hidden="true"
                                className="overflow-visible whitespace-nowrap text-[9px] font-bold leading-none text-slate-400"
                            >
                                {label}
                            </span>
                        ))}
                    </div>

                    {/* auto-cols-[14px] + justify-start is load-bearing: implicit column
                        tracks default to `auto`, which stretches them across the full
                        width and scatters the grid. */}
                    <div
                        role="grid"
                        aria-label="Appels par jour"
                        className="grid grid-flow-col grid-rows-7 auto-cols-[14px] justify-start gap-1"
                    >
                        {cells.map((day, i) => {
                            if (!day) return <span key={`pad-${i}`} className={CELL} />;
                            const n = countsByDay[day] ?? 0;
                            const isActive = activeDay === day;
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => onPickDay(isActive ? null : day)}
                                    title={`${fmtDayLabel(day)} — ${n} appel${n > 1 ? "s" : ""}`}
                                    aria-label={`${fmtDayLabel(day)}, ${n} appels`}
                                    aria-pressed={isActive}
                                    className={cn(
                                        CELL,
                                        "rounded-sm transition-transform hover:ring-2 hover:ring-slate-400",
                                        TONES[level(n)],
                                        isActive && "ring-2 ring-slate-900",
                                    )}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {activeDay && (
                <button
                    type="button"
                    onClick={() => onPickDay(null)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                >
                    <X className="h-3 w-3" />
                    {fmtDayLabel(activeDay)}
                </button>
            )}
        </div>
    );
}

function CallRow({ call, meta, onOpen }: { call: CallItem; meta: ResultMeta; onOpen: () => void }) {
    const dur = fmtDuration(call.duration);
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-all hover:border-slate-400 hover:shadow-sm"
        >
            <Avatar call={call} />

            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-xs font-bold text-slate-900">{contactName(call)}</span>
                    {call.contact?.title && (
                        <span className="truncate text-[11px] text-slate-500">{call.contact.title}</span>
                    )}
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600">
                    <Briefcase className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate font-medium">{companyName(call)}</span>
                    <span className="shrink-0 text-slate-300">·</span>
                    <span className="truncate text-slate-500">{call.campaign.mission.name}</span>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
                {dur && (
                    <span className="hidden items-center gap-1 text-[11px] font-medium text-slate-500 sm:flex">
                        <Clock className="h-3 w-3" aria-hidden="true" />{dur}
                    </span>
                )}
                <ResultChip result={call.result} meta={meta} />
                <span className="w-10 text-right text-[11px] font-bold tabular-nums text-slate-500">
                    {fmtTime(call.createdAt)}
                </span>
            </div>
        </button>
    );
}

function CallDetailDrawer({ call, meta, onClose }: { call: CallItem | null; meta: ResultMeta; onClose: () => void }) {
    const dur = call ? fmtDuration(call.duration) : null;
    return (
        <Drawer isOpen={!!call} onClose={onClose} size="md" title="Détail de l'appel">
            {call && (
                <div className="space-y-5 p-1">
                    <div className="flex items-center gap-3">
                        <Avatar call={call} size={44} />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{contactName(call)}</p>
                            <p className="truncate text-xs text-slate-500">
                                {call.contact?.title ? `${call.contact.title} · ` : ""}{companyName(call)}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <ResultChip result={call.result} meta={meta} />
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                            {fmtDayLabel(displayDayKey(call.createdAt))} · {fmtTime(call.createdAt)}
                        </span>
                        {dur && (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                <Clock className="h-3 w-3" />{dur}
                            </span>
                        )}
                    </div>

                    <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {[
                            { k: "Mission", v: call.campaign.mission.name },
                            { k: "Campagne", v: call.campaign.name },
                            { k: "Secteur", v: call.contact?.company?.industry ?? call.company?.industry ?? "—" },
                            { k: "Pays", v: call.contact?.company?.country ?? call.company?.country ?? "—" },
                        ].map(({ k, v }) => (
                            <div key={k}>
                                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</dt>
                                <dd className="mt-0.5 text-xs font-semibold text-slate-700">{v}</dd>
                            </div>
                        ))}
                    </dl>

                    {(call.contact?.email || call.contact?.phone) && (
                        <div className="flex flex-col gap-2">
                            {call.contact?.email && (
                                <a href={`mailto:${call.contact.email}`}
                                    className="inline-flex items-center gap-2 text-xs font-medium text-[#1a75ce] hover:underline">
                                    <Mail className="h-3.5 w-3.5" />{call.contact.email}
                                </a>
                            )}
                            {call.contact?.phone && (
                                <a href={`tel:${call.contact.phone}`}
                                    className="inline-flex items-center gap-2 text-xs font-medium text-[#1a75ce] hover:underline">
                                    <Phone className="h-3.5 w-3.5" />{call.contact.phone}
                                </a>
                            )}
                        </div>
                    )}

                    {call.note && (
                        <div>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Note de notre commercial
                            </p>
                            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs italic leading-relaxed text-slate-600">
                                &ldquo;{call.note}&rdquo;
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Drawer>
    );
}

function ListSkeleton() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
function ActiviteView() {
    const { error: showError } = useToast();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const period      = params.get("p") ?? "30";
    const urlSearch   = params.get("q") ?? "";
    const resultFilter = params.get("r");
    const missionFilter = params.get("m");
    const dayFilter   = params.get("d");

    /* Search is local so typing never triggers a navigation; the URL catches up on
       a debounce, keeping the view shareable without a replace() per keystroke. */
    const [search, setSearch] = useState(urlSearch);

    const [calls, setCalls] = useState<CallItem[]>([]);
    const [statusConfig, setStatusConfig] = useState<{ statuses: StatusDef[]; categories: ResultCategoryDef[] } | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [selected, setSelected] = useState<CallItem | null>(null);

    const deferredSearch = useDeferredValue(search);

    /* URL is the single source of filter state — shareable and restorable. */
    const setParam = useCallback((key: string, value: string | null) => {
        const next = new URLSearchParams(params.toString());
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, pathname, router]);

    useEffect(() => {
        if (search === urlSearch) return;
        const t = setTimeout(() => setParam("q", search || null), 300);
        return () => clearTimeout(t);
    }, [search, urlSearch, setParam]);

    const clearFilters = useCallback(() => {
        setSearch("");
        const next = new URLSearchParams();
        if (period !== "30") next.set("p", period);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [period, pathname, router]);

    const resultMeta = useMemo<ResultMeta>(() => {
        if (statusConfig?.statuses?.length) return buildResultMeta(statusConfig.statuses, statusConfig.categories);
        return RESULT_META_FALLBACK;
    }, [statusConfig]);

    const statusOrder = useMemo(() => {
        if (statusConfig?.statuses?.length) return statusConfig.statuses.map((s) => s.code);
        return DEFAULT_STATUS_ORDER;
    }, [statusConfig]);

    const [showAllStatuses, setShowAllStatuses] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/client/action-status-config")
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                if (json.success && json.data?.statuses) {
                    setStatusConfig({ statuses: json.data.statuses, categories: json.data.categories ?? [] });
                }
            })
            .catch(() => undefined)
            .finally(() => { if (!cancelled) setConfigLoaded(true); });
        return () => { cancelled = true; };
    }, []);

    /* Date range is computed once, in business time, and the server result is
       trusted as-is — no second client-side pass that could drop boundary rows. */
    const range = useMemo(() => ({
        start: displayDayKeyDaysAgo(parseInt(period, 10)),
        end: displayDayKey(new Date()),
    }), [period]);

    const fetchCalls = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/client/calls?startDate=${range.start}&endDate=${range.end}`);
            const json = await res.json();
            if (json.success && json.data?.items) {
                setCalls(json.data.items);
                setLastUpdated(new Date());
            } else {
                showError("Erreur", json.error ?? "Impossible de charger l'activité");
            }
        } catch {
            showError("Erreur", "Impossible de charger l'activité");
        } finally {
            setIsLoading(false);
        }
    }, [range, showError]);

    useEffect(() => { void fetchCalls(); }, [fetchCalls]);

    const missions = useMemo(
        () => [...new Set(calls.map((c) => c.campaign?.mission?.name).filter(Boolean))].sort(),
        [calls],
    );

    /* Result counts reflect every filter except the result filter itself, so the
       chip numbers stay meaningful while one is active. */
    const preResultFiltered = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        return calls.filter((c) => {
            if (missionFilter && c.campaign?.mission?.name !== missionFilter) return false;
            if (dayFilter && displayDayKey(c.createdAt) !== dayFilter) return false;
            if (!q) return true;
            return [
                c.contact?.firstName, c.contact?.lastName, c.contact?.email, c.contact?.phone,
                c.contact?.title, c.contact?.company?.name, c.company?.name,
                c.campaign?.mission?.name, c.campaign?.name, c.note,
            ].filter(Boolean).join(" ").toLowerCase().includes(q);
        });
    }, [calls, deferredSearch, missionFilter, dayFilter]);

    const resultCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        preResultFiltered.forEach((c) => { counts[c.result] = (counts[c.result] ?? 0) + 1; });
        return counts;
    }, [preResultFiltered]);

    const filtered = useMemo(
        () => (resultFilter ? preResultFiltered.filter((c) => c.result === resultFilter) : preResultFiltered),
        [preResultFiltered, resultFilter],
    );

    const byDay = useMemo(() => {
        const map = new Map<string, CallItem[]>();
        for (const c of filtered) {
            const k = displayDayKey(c.createdAt);
            const bucket = map.get(k);
            if (bucket) bucket.push(c); else map.set(k, [c]);
        }
        return [...map.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([day, items]) => [
                day,
                items.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()),
            ] as const);
    }, [filtered]);

    const heatmapDays = useMemo(() => displayDayRange(range.start, range.end), [range]);
    const countsByDay = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of calls) {
            const k = displayDayKey(c.createdAt);
            counts[k] = (counts[k] ?? 0) + 1;
        }
        return counts;
    }, [calls]);

    /**
     * Which result chips to show up front. Outcomes carrying at least 5% of the
     * period's calls lead (plus whatever is currently selected, so the active
     * filter is never hidden); the rest fold behind a "+N autres" toggle.
     */
    const presentStatuses = useMemo(
        () => statusOrder.filter((code) => (resultCounts[code] ?? 0) > 0 || resultFilter === code),
        [statusOrder, resultCounts, resultFilter],
    );

    const visibleStatuses = useMemo(() => {
        if (showAllStatuses) return presentStatuses;
        const threshold = Math.max(1, Math.round(preResultFiltered.length * 0.05));
        const kept = presentStatuses.filter(
            (code) => (resultCounts[code] ?? 0) >= threshold || resultFilter === code,
        );
        // Never collapse to almost nothing: if the threshold is too aggressive,
        // fall back to showing everything rather than a lone chip.
        return kept.length >= 2 ? kept : presentStatuses;
    }, [showAllStatuses, presentStatuses, resultCounts, resultFilter, preResultFiltered.length]);

    const hiddenStatusCount = presentStatuses.length - visibleStatuses.length;

    const stats = useMemo(() => {
        const meetings = filtered.filter((c) => c.result === "MEETING_BOOKED").length;
        return {
            total: filtered.length,
            meetings,
            activeDays: new Set(filtered.map((c) => displayDayKey(c.createdAt))).size,
            missions: new Set(filtered.map((c) => c.campaign?.mission?.name)).size,
            convRate: filtered.length ? Math.round((meetings / filtered.length) * 100) : 0,
        };
    }, [filtered]);

    const hasFilters = !!(search || resultFilter || missionFilter || dayFilter);
    const busy = isLoading || !configLoaded;

    const KPIS = [
        { Icon: Activity,     value: stats.total,      label: "Appels passés",    sub: `sur ${period} jours` },
        { Icon: CalendarDays, value: stats.activeDays, label: "Jours travaillés", sub: "jours d'activité" },
        { Icon: CheckCircle2, value: stats.meetings,   label: "RDV obtenus",      sub: `taux ${stats.convRate}%` },
        { Icon: TrendingUp,   value: stats.missions,   label: "Missions actives", sub: "sur la période" },
    ];

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-5 pb-8">
            {/* ── Header ── */}
            <header className="flex flex-col gap-4 border-b-2 border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-[#0B0F19] text-[#2890F8] shadow-md shadow-black/15">
                        <PhoneCall className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                            Activité de prospection
                        </h1>
                        <p className="mt-0.5 text-xs font-medium text-slate-600">
                            Chaque appel passé pour vous, jour par jour.
                            {lastUpdated && (
                                <span className="text-slate-400">
                                    {" "}· maj {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                        {PERIODS.map(({ key, label }) => (
                            <button key={key} type="button" onClick={() => setParam("p", key)}
                                aria-pressed={period === key}
                                className={cn(
                                    "rounded-lg px-2.5 py-1 text-xs font-bold transition-all",
                                    period === key ? "bg-[#0B0F19] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                                )}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => void fetchCalls()} disabled={busy}
                        title="Actualiser" aria-label="Actualiser"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-2xs transition-all hover:border-blue-300 hover:text-[#2890F8] disabled:opacity-50">
                        <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    </button>
                    <button type="button" onClick={() => exportCSV(filtered, resultMeta)} disabled={!filtered.length}
                        className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-60">
                        <FileSpreadsheet className="h-4 w-4" />
                        Exporter{filtered.length ? ` (${filtered.length})` : ""}
                    </button>
                </div>
            </header>

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {KPIS.map(({ Icon, value, label, sub }) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="text-[10.5px] font-bold uppercase tracking-wider">{label}</span>
                        </div>
                        <p className="mt-1 text-2xl font-black leading-none tabular-nums text-slate-900">
                            {busy ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-slate-200" /> : value}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Heatmap ── */}
            {!busy && heatmapDays.length > 0 && (
                <HeatmapStrip
                    days={heatmapDays}
                    countsByDay={countsByDay}
                    activeDay={dayFilter}
                    onPickDay={(d) => setParam("d", d)}
                />
            )}

            {/* ── Filters ── */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Contact, entreprise, mission…"
                            aria-label="Rechercher"
                            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-[#2890F8] focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch("")} aria-label="Effacer la recherche"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {missions.length > 1 && (
                        <select
                            value={missionFilter ?? ""}
                            onChange={(e) => setParam("m", e.target.value || null)}
                            aria-label="Filtrer par mission"
                            className="h-9 min-w-[150px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-[#2890F8] focus:outline-none focus:ring-2 focus:ring-[#2890F8]/20"
                        >
                            <option value="">Toutes les missions</option>
                            {missions.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                    )}

                    {hasFilters && (
                        <button type="button" onClick={clearFilters}
                            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 transition-all hover:bg-slate-100">
                            <X className="h-3.5 w-3.5" />Réinitialiser
                        </button>
                    )}
                </div>

                {/* Global result filter — one click, applies across every day and mission.
                    The configured order is semantic (wins first, refusals last), so it is
                    kept; only the long tail of low-count outcomes is folded away, since
                    fifteen chips over three rows buried the ones that matter. */}
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par résultat">
                    <button type="button" onClick={() => setParam("r", null)} aria-pressed={!resultFilter}
                        className={cn(
                            "flex items-center gap-1.5 rounded-xl border py-1.5 pl-2.5 pr-2 text-[11px] font-bold transition-all",
                            !resultFilter ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400",
                        )}>
                        Tous
                        <span className={cn("ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums",
                            !resultFilter ? "bg-white/20" : "bg-slate-100 text-slate-500")}>
                            {preResultFiltered.length}
                        </span>
                    </button>

                    {visibleStatuses.map((code) => {
                            const m = resultMeta[code] ?? { label: ACTION_RESULT_LABELS[code] ?? code, color: NEUTRAL };
                            const active = resultFilter === code;
                            return (
                                <button key={code} type="button" aria-pressed={active}
                                    onClick={() => setParam("r", active ? null : code)}
                                    style={active
                                        ? { background: m.color, borderColor: m.color, color: "#fff" }
                                        : { background: `${m.color}12`, borderColor: `${m.color}45`, color: m.color }}
                                    className="flex items-center gap-1.5 rounded-xl border py-1.5 pl-2.5 pr-2 text-[11px] font-bold transition-all hover:brightness-95">
                                    {m.label}
                                    <span className={cn("ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums",
                                        active ? "bg-white/25" : "bg-white/70")}>
                                        {resultCounts[code] ?? 0}
                                    </span>
                                </button>
                            );
                        })}

                    {hiddenStatusCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowAllStatuses((v) => !v)}
                            aria-expanded={showAllStatuses}
                            className="flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white py-1.5 pl-2.5 pr-2 text-[11px] font-bold text-slate-500 transition-all hover:border-slate-400 hover:text-slate-700"
                        >
                            {showAllStatuses ? "Voir moins" : `+${hiddenStatusCount} autres`}
                        </button>
                    )}
                </div>
            </div>

            {/* ── List ── */}
            {busy ? (
                <ListSkeleton />
            ) : byDay.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                        <PhoneCall className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                        {hasFilters ? "Aucun appel ne correspond à ces filtres" : "Aucune activité sur cette période"}
                    </p>
                    <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
                        {hasFilters
                            ? "Élargissez la recherche ou réinitialisez les filtres pour revoir toute la période."
                            : "Dès que nos commerciaux appellent pour vous, chaque appel apparaît ici."}
                    </p>
                    {hasFilters && (
                        <button type="button" onClick={clearFilters}
                            className="mt-4 flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                            <X className="h-3.5 w-3.5" />Réinitialiser les filtres
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-5">
                    {byDay.map(([day, items]) => {
                        const dayMeetings = items.filter((c) => c.result === "MEETING_BOOKED").length;
                        return (
                            <section key={day}>
                                <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 bg-white/95 px-1 py-1.5 backdrop-blur-sm">
                                    <h2 className="text-xs font-black uppercase tracking-wide text-slate-800">
                                        {fmtDayLabel(day)}
                                    </h2>
                                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-600">
                                        {items.length} appel{items.length > 1 ? "s" : ""}
                                    </span>
                                    {dayMeetings > 0 && (
                                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                                            {dayMeetings} RDV
                                        </span>
                                    )}
                                    <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                                </div>

                                <div className="space-y-2">
                                    {items.map((c) => (
                                        <CallRow key={c.id} call={c} meta={resultMeta} onOpen={() => setSelected(c)} />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            <CallDetailDrawer call={selected} meta={resultMeta} onClose={() => setSelected(null)} />
        </div>
    );
}

export default function ClientPortalActivitePage() {
    return (
        <Suspense fallback={<ListSkeleton />}>
            <ActiviteView />
        </Suspense>
    );
}
