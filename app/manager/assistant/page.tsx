"use client";

/**
 * Manager view of AI assistant usage.
 *
 * Posture is aggregate-first by design: the page answers "is it used, does it
 * work, what do people need" without showing anyone's words. Reading an actual
 * exchange is a separate, deliberate click that opens a drawer — and the page
 * says so, rather than leaving people to guess what managers can see.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertTriangle,
    Bot,
    Clock,
    Eye,
    Loader2,
    MessageSquare,
    Users,
    Wrench,
} from "lucide-react";
import { Drawer } from "@/components/ui";
import { cn } from "@/lib/utils";

type UserRole = string;

interface Overview {
    period: { from: string; to: string };
    totals: {
        conversations: number;
        messages: number;
        questions: number;
        activeUsers: number;
        failedTurns: number;
        failureRate: number;
        avgLatencyMs: number | null;
        totalTokens: number;
    };
    byRole: Array<{ role: UserRole; conversations: number; questions: number }>;
    byDay: Array<{ day: string; questions: number }>;
    toolUsage: Array<{ tool: string; calls: number; failures: number }>;
    topUsers: Array<{ userId: string; name: string; role: UserRole; questions: number }>;
}

interface ConversationRow {
    id: string;
    title: string;
    userName: string;
    userRole: UserRole;
    messageCount: number;
    lastMessageAt: string | null;
    createdAt: string;
    hadFailure: boolean;
}

interface TranscriptMessage {
    id: string;
    role: string;
    content: string;
    toolCalls: unknown;
    errorCode: string | null;
    latencyMs: number | null;
    createdAt: string;
}

interface Transcript {
    id: string;
    title: string;
    userName: string;
    userRole: UserRole;
    createdAt: string;
    messages: TranscriptMessage[];
}

const RANGES = [
    { key: "7", label: "7 j" },
    { key: "30", label: "30 j" },
    { key: "90", label: "90 j" },
] as const;

const ROLE_LABELS: Record<string, string> = {
    SDR: "SDR",
    BOOKER: "Booker",
    MANAGER: "Manager",
    CLIENT: "Client",
    COMMERCIAL: "Commercial",
    BUSINESS_DEVELOPER: "Business Dev",
    DEVELOPER: "Développeur",
};

function isoDaysAgo(days: number): string {
    return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function fmtDateTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/* ─── Small presentational pieces ─────────────────────────────────────────── */

function StatCard({
    icon: Icon,
    label,
    value,
    hint,
    tone = "neutral",
}: {
    icon: typeof Activity;
    label: string;
    value: string;
    hint?: string;
    tone?: "neutral" | "warn" | "good";
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        tone === "warn"
                            ? "bg-amber-50 text-amber-600"
                            : tone === "good"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-[#E8F2FE] text-[#1A75CE]"
                    )}
                >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            </div>
            <p className="mt-2.5 text-2xl font-black tabular-nums text-slate-900">{value}</p>
            {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
    );
}

/** Horizontal bars. A chart library would be overkill for one ranked list. */
function BarList({
    rows,
    emptyLabel,
}: {
    rows: Array<{ key: string; label: string; value: number; sub?: string; danger?: boolean }>;
    emptyLabel: string;
}) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (rows.length === 0) {
        return <p className="py-6 text-center text-sm text-slate-400">{emptyLabel}</p>;
    }
    return (
        <ul className="space-y-2">
            {rows.map((r) => (
                <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-xs font-semibold text-slate-700">{r.label}</span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-slate-900">
                            {r.value}
                            {r.sub && <span className="ml-1 font-medium text-slate-400">{r.sub}</span>}
                        </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            className={cn(
                                "h-full rounded-full transition-[width] duration-300",
                                r.danger ? "bg-amber-500" : "bg-[#2890F8]"
                            )}
                            style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** Sparkline-ish day bars; same packed-grid lesson as the activity heatmap. */
function DayBars({ rows }: { rows: Array<{ day: string; questions: number }> }) {
    const max = Math.max(1, ...rows.map((r) => r.questions));
    if (rows.length === 0) {
        return <p className="py-6 text-center text-sm text-slate-400">Aucune question sur la période.</p>;
    }
    return (
        <div className="flex h-24 items-end gap-1 overflow-x-auto">
            {rows.map((r) => (
                <div
                    key={r.day}
                    title={`${r.day} — ${r.questions} question${r.questions > 1 ? "s" : ""}`}
                    className="flex min-w-[8px] flex-1 flex-col justify-end"
                >
                    <div
                        className="w-full rounded-sm bg-[#2890F8]"
                        style={{ height: `${Math.max(4, (r.questions / max) * 100)}%` }}
                    />
                </div>
            ))}
        </div>
    );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function ManagerAssistantPage() {
    const [days, setDays] = useState<(typeof RANGES)[number]["key"]>("30");
    const [roleFilter, setRoleFilter] = useState<string | null>(null);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [conversations, setConversations] = useState<ConversationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [transcriptLoading, setTranscriptLoading] = useState(false);

    const query = useMemo(() => {
        const p = new URLSearchParams({ from: isoDaysAgo(Number(days)) });
        if (roleFilter) p.set("role", roleFilter);
        return p.toString();
    }, [days, roleFilter]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        Promise.all([
            fetch(`/api/manager/assistant/overview?${query}`).then((r) => r.json()),
            fetch(`/api/manager/assistant/conversations?${query}`).then((r) => r.json()),
        ])
            .then(([o, c]) => {
                if (cancelled) return;
                if (o?.success) setOverview(o.data as Overview);
                if (c?.success) setConversations(c.data as ConversationRow[]);
            })
            .catch(() => undefined)
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [query]);

    const openTranscript = useCallback(async (id: string) => {
        setOpenId(id);
        setTranscript(null);
        setTranscriptLoading(true);
        try {
            const res = await fetch(`/api/manager/assistant/conversations/${id}`);
            const json = await res.json();
            if (json?.success) setTranscript(json.data as Transcript);
        } finally {
            setTranscriptLoading(false);
        }
    }, []);

    const t = overview?.totals;
    const periodLabel = `${RANGES.find((r) => r.key === days)?.label ?? days} glissants`;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2890F8] to-[#5BAEFC] text-white">
                        <Bot className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">
                            Usage de l&apos;assistant IA
                        </h1>
                        <p className="text-sm text-slate-500">
                            Ce que l&apos;équipe et les clients demandent · {periodLabel}
                        </p>
                    </div>
                </div>

                <div
                    className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"
                    role="group"
                    aria-label="Période"
                >
                    {RANGES.map((r) => (
                        <button
                            key={r.key}
                            type="button"
                            onClick={() => setDays(r.key)}
                            aria-pressed={days === r.key}
                            className={cn(
                                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2890F8]/40",
                                days === r.key
                                    ? "bg-[#0B0F19] text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Privacy posture, stated rather than implied. */}
            <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                Cette page est agrégée. Le contenu des échanges n&apos;apparaît qu&apos;en ouvrant une
                conversation, ce qui est tracé comme une consultation volontaire.
            </p>

            {loading && !overview ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard
                            icon={MessageSquare}
                            label="Questions posées"
                            value={String(t?.questions ?? 0)}
                            hint={`${t?.conversations ?? 0} conversation${(t?.conversations ?? 0) > 1 ? "s" : ""}`}
                        />
                        <StatCard
                            icon={Users}
                            label="Utilisateurs actifs"
                            value={String(t?.activeUsers ?? 0)}
                            hint="sur la période"
                        />
                        <StatCard
                            icon={AlertTriangle}
                            label="Taux d'échec"
                            value={`${t?.failureRate ?? 0}%`}
                            hint={`${t?.failedTurns ?? 0} réponse(s) en erreur`}
                            tone={(t?.failureRate ?? 0) > 5 ? "warn" : "good"}
                        />
                        <StatCard
                            icon={Clock}
                            label="Latence moyenne"
                            value={t?.avgLatencyMs ? `${(t.avgLatencyMs / 1000).toFixed(1)} s` : "—"}
                            hint={`${(t?.totalTokens ?? 0).toLocaleString("fr-FR")} tokens`}
                        />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        {/* Volume */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-2">
                            <h2 className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                Questions par jour
                            </h2>
                            <DayBars rows={overview?.byDay ?? []} />
                        </section>

                        {/* Roles — who actually leans on it */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h2 className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                Par rôle
                            </h2>
                            <BarList
                                emptyLabel="Aucun usage sur la période."
                                rows={(overview?.byRole ?? []).map((r) => ({
                                    key: r.role,
                                    label: ROLE_LABELS[r.role] ?? r.role,
                                    value: r.questions,
                                    sub: `· ${r.conversations} conv.`,
                                }))}
                            />
                        </section>

                        {/* Tools — what the AI actually reaches for, and what breaks */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                <Wrench className="h-3 w-3" aria-hidden="true" />
                                Outils appelés
                            </h2>
                            <BarList
                                emptyLabel="Aucun outil appelé."
                                rows={(overview?.toolUsage ?? []).map((tool) => ({
                                    key: tool.tool,
                                    label: tool.tool,
                                    value: tool.calls,
                                    sub: tool.failures > 0 ? `· ${tool.failures} échec(s)` : undefined,
                                    danger: tool.failures > 0,
                                }))}
                            />
                        </section>

                        {/* Top users */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h2 className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                Utilisateurs les plus actifs
                            </h2>
                            <BarList
                                emptyLabel="Aucun utilisateur actif."
                                rows={(overview?.topUsers ?? []).map((u) => ({
                                    key: u.userId,
                                    label: u.name,
                                    value: u.questions,
                                    sub: `· ${ROLE_LABELS[u.role] ?? u.role}`,
                                }))}
                            />
                        </section>

                        {/* Drill-down list */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    Conversations
                                </h2>
                                <span className="text-[11px] font-semibold text-slate-400">
                                    {conversations.length}
                                </span>
                            </div>
                            {conversations.length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-400">
                                    Aucune conversation sur la période.
                                </p>
                            ) : (
                                <ul className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
                                    {conversations.map((c) => (
                                        <li key={c.id}>
                                            <button
                                                type="button"
                                                onClick={() => void openTranscript(c.id)}
                                                className={cn(
                                                    "group w-full rounded-xl border border-slate-200 px-3 py-2 text-left transition-colors",
                                                    "hover:border-[#2890F8]/50 hover:bg-[#E8F2FE]/40",
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2890F8]/40"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="line-clamp-2 text-xs font-semibold text-slate-800">
                                                        {c.title}
                                                    </span>
                                                    {c.hadFailure && (
                                                        <AlertTriangle
                                                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                                                            aria-label="A rencontré une erreur"
                                                        />
                                                    )}
                                                </div>
                                                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                                    {c.userName} · {ROLE_LABELS[c.userRole] ?? c.userRole} ·{" "}
                                                    {fmtDateTime(c.lastMessageAt ?? c.createdAt)}
                                                </p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                </>
            )}

            {/* Transcript drawer — uses the shared floating shell. */}
            <Drawer
                isOpen={!!openId}
                onClose={() => {
                    setOpenId(null);
                    setTranscript(null);
                }}
                title={transcript?.title ?? "Conversation"}
                description={
                    transcript
                        ? `${transcript.userName} · ${ROLE_LABELS[transcript.userRole] ?? transcript.userRole}`
                        : undefined
                }
                size="lg"
                contentClassName="@container !bg-white"
            >
                {transcriptLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
                    </div>
                ) : !transcript ? (
                    <p className="py-20 text-center text-sm text-slate-400">Transcription indisponible.</p>
                ) : (
                    <div className="space-y-3">
                        {transcript.messages.map((m) => {
                            const calls = Array.isArray(m.toolCalls)
                                ? (m.toolCalls as Array<{ tool?: string; ok?: boolean }>)
                                : [];
                            return (
                                <div
                                    key={m.id}
                                    className={cn(
                                        "rounded-xl border px-3 py-2.5",
                                        m.role === "user"
                                            ? "border-slate-200 bg-slate-50"
                                            : "border-[#2890F8]/25 bg-[#E8F2FE]/40"
                                    )}
                                >
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            {m.role === "user" ? transcript.userName : "Assistant"}
                                        </span>
                                        <span className="text-[10px] tabular-nums text-slate-400">
                                            {fmtDateTime(m.createdAt)}
                                            {m.latencyMs ? ` · ${(m.latencyMs / 1000).toFixed(1)}s` : ""}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                                        {m.content}
                                    </p>
                                    {calls.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {calls.map((c, i) => (
                                                <span
                                                    key={`${c.tool}-${i}`}
                                                    className={cn(
                                                        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                                                        c.ok === false
                                                            ? "border-amber-200 bg-amber-50 text-amber-700"
                                                            : "border-slate-200 bg-white text-slate-500"
                                                    )}
                                                >
                                                    {c.tool}
                                                    {c.ok === false ? " ✕" : ""}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {m.errorCode && (
                                        <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
                                            Erreur : {m.errorCode}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Drawer>
        </div>
    );
}
