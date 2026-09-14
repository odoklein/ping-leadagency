"use client";

/**
 * Support ticket queue.
 *
 * Built around triage rather than browsing: the default filter is the
 * actionable set (everything not yet resolved), the counts live on the filter
 * chips so the shape of the backlog is visible before clicking, and the long
 * tail of statuses folds away — the same pattern as the client activity page,
 * where fifteen chips over three rows buried the ones that mattered.
 *
 * Tickets raised through the assistant link back to the exchange that produced
 * them, which is the point of routing support through the AI at all.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    Bot,
    Check,
    Inbox,
    Loader2,
    MessageSquare,
    Send,
    User as UserIcon,
} from "lucide-react";
import { Drawer, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type Status = "OPEN" | "IN_PROGRESS" | "WAITING_ON_REQUESTER" | "RESOLVED" | "CLOSED";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface TicketRow {
    id: string;
    subject: string;
    category: string;
    priority: Priority;
    status: Status;
    source: "ASSISTANT" | "WEB";
    createdAt: string;
    resolvedAt: string | null;
    requester: { id: string; name: string; role: string } | null;
    client: { id: string; name: string } | null;
    assignee: { id: string; name: string } | null;
    _count: { messages: number };
}

interface TicketDetail extends Omit<TicketRow, "_count"> {
    body: string;
    context: Record<string, unknown> | null;
    mission: { id: string; name: string } | null;
    messages: Array<{
        id: string;
        content: string;
        isSystem: boolean;
        createdAt: string;
        author: { id: string; name: string } | null;
    }>;
}

const STATUS_META: Record<Status, { label: string; className: string }> = {
    OPEN: { label: "Ouvert", className: "border-[#2890F8]/35 bg-[#E8F2FE] text-[#1A75CE]" },
    IN_PROGRESS: { label: "En cours", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
    WAITING_ON_REQUESTER: {
        label: "En attente",
        className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    RESOLVED: { label: "Résolu", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    CLOSED: { label: "Fermé", className: "border-slate-200 bg-slate-100 text-slate-500" },
};

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
    LOW: { label: "Basse", className: "text-slate-400" },
    NORMAL: { label: "Normale", className: "text-slate-500" },
    HIGH: { label: "Haute", className: "text-amber-600" },
    URGENT: { label: "Urgente", className: "text-red-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
    BUG: "Bug",
    QUESTION: "Question",
    DATA_ISSUE: "Donnée incorrecte",
    ACCESS: "Accès",
    BILLING: "Facturation",
    FEATURE_REQUEST: "Évolution",
    OTHER: "Autre",
};

/** The set a manager is expected to act on. */
const ACTIONABLE: Status[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER"];

const NEXT_STATUS: Array<{ from: Status[]; to: Status; label: string }> = [
    { from: ["OPEN"], to: "IN_PROGRESS", label: "Prendre en charge" },
    { from: ["OPEN", "IN_PROGRESS"], to: "WAITING_ON_REQUESTER", label: "Attendre le demandeur" },
    { from: ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER"], to: "RESOLVED", label: "Marquer résolu" },
    { from: ["RESOLVED"], to: "CLOSED", label: "Fermer" },
];

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function ManagerTicketsPage() {
    const { success, error: showError } = useToast();
    const [tickets, setTickets] = useState<TicketRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Status | "ACTIONABLE" | "ALL">("ACTIONABLE");
    const [openId, setOpenId] = useState<string | null>(null);
    const [detail, setDetail] = useState<TicketDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [reply, setReply] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/support/tickets?scope=all");
            const json = await res.json();
            if (json?.success) setTickets(json.data as TicketRow[]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const counts = useMemo(() => {
        const c: Record<string, number> = { ALL: tickets.length, ACTIONABLE: 0 };
        for (const t of tickets) {
            c[t.status] = (c[t.status] ?? 0) + 1;
            if (ACTIONABLE.includes(t.status)) c.ACTIONABLE += 1;
        }
        return c;
    }, [tickets]);

    const visible = useMemo(() => {
        if (filter === "ALL") return tickets;
        if (filter === "ACTIONABLE") return tickets.filter((t) => ACTIONABLE.includes(t.status));
        return tickets.filter((t) => t.status === filter);
    }, [tickets, filter]);

    const openTicket = useCallback(async (id: string) => {
        setOpenId(id);
        setDetail(null);
        setReply("");
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/support/tickets/${id}`);
            const json = await res.json();
            if (json?.success) setDetail(json.data as TicketDetail);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const patch = useCallback(
        async (body: Record<string, unknown>) => {
            if (!openId) return;
            setSaving(true);
            try {
                const res = await fetch(`/api/support/tickets/${openId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const json = await res.json();
                if (!json?.success) throw new Error(json?.error || "Échec de la mise à jour");
                success("Ticket mis à jour", "");
                setReply("");
                await Promise.all([load(), openTicket(openId)]);
            } catch (e) {
                showError("Erreur", e instanceof Error ? e.message : "Échec de la mise à jour");
            } finally {
                setSaving(false);
            }
        },
        [openId, load, openTicket, success, showError]
    );

    const chips: Array<{ key: Status | "ACTIONABLE" | "ALL"; label: string }> = [
        { key: "ACTIONABLE", label: "À traiter" },
        { key: "OPEN", label: STATUS_META.OPEN.label },
        { key: "IN_PROGRESS", label: STATUS_META.IN_PROGRESS.label },
        { key: "WAITING_ON_REQUESTER", label: STATUS_META.WAITING_ON_REQUESTER.label },
        { key: "RESOLVED", label: STATUS_META.RESOLVED.label },
        { key: "CLOSED", label: STATUS_META.CLOSED.label },
        { key: "ALL", label: "Tous" },
    ];

    const linkedConversationId =
        typeof detail?.context?.conversationId === "string" ? detail.context.conversationId : null;

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-5">
            <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2890F8] to-[#5BAEFC] text-white">
                    <Inbox className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900">
                        Tickets de support
                    </h1>
                    <p className="text-sm text-slate-500">
                        Demandes de l&apos;équipe et des clients, y compris celles ouvertes par
                        l&apos;assistant IA.
                    </p>
                </div>
            </div>

            {/* Counts on the chips: the backlog's shape is readable before any click. */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par statut">
                {chips.map((c) => {
                    const active = filter === c.key;
                    const n = counts[c.key] ?? 0;
                    return (
                        <button
                            key={c.key}
                            type="button"
                            onClick={() => setFilter(c.key)}
                            aria-pressed={active}
                            className={cn(
                                "flex items-center gap-1.5 rounded-xl border py-1.5 pl-2.5 pr-2 text-[11px] font-bold transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2890F8]/40",
                                active
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                            )}
                        >
                            {c.label}
                            <span
                                className={cn(
                                    "rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums",
                                    active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                                )}
                            >
                                {n}
                            </span>
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
                </div>
            ) : visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                    <Check className="mb-3 h-8 w-8 text-emerald-500" aria-hidden="true" />
                    <p className="text-sm font-bold text-slate-800">Rien à traiter ici</p>
                    <p className="mt-1 text-sm text-slate-500">
                        Aucun ticket ne correspond à ce filtre.
                    </p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {visible.map((t) => (
                        <li key={t.id}>
                            <button
                                type="button"
                                onClick={() => void openTicket(t.id)}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors",
                                    "hover:border-[#2890F8]/50 hover:bg-[#E8F2FE]/30",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2890F8]/40"
                                )}
                            >
                                <span
                                    className={cn(
                                        "shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold",
                                        STATUS_META[t.status].className
                                    )}
                                >
                                    {STATUS_META[t.status].label}
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                        {t.source === "ASSISTANT" && (
                                            <Bot
                                                className="h-3.5 w-3.5 shrink-0 text-[#2890F8]"
                                                aria-label="Ouvert par l'assistant IA"
                                            />
                                        )}
                                        <span className="truncate text-sm font-bold text-slate-900">
                                            {t.subject}
                                        </span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                                        {t.requester?.name ?? "—"}
                                        {t.client ? ` · ${t.client.name}` : ""} ·{" "}
                                        {CATEGORY_LABELS[t.category] ?? t.category} · {fmtDate(t.createdAt)}
                                    </span>
                                </span>

                                {t.priority !== "NORMAL" && t.priority !== "LOW" && (
                                    <span
                                        className={cn(
                                            "shrink-0 text-[11px] font-bold",
                                            PRIORITY_META[t.priority].className
                                        )}
                                    >
                                        {PRIORITY_META[t.priority].label}
                                    </span>
                                )}

                                <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                                    {t._count.messages}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Detail + triage */}
            <Drawer
                isOpen={!!openId}
                onClose={() => {
                    setOpenId(null);
                    setDetail(null);
                }}
                title={detail?.subject ?? "Ticket"}
                description={
                    detail
                        ? `${detail.requester?.name ?? "—"}${detail.client ? ` · ${detail.client.name}` : ""}`
                        : undefined
                }
                size="lg"
                contentClassName="@container !bg-white"
            >
                {detailLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
                    </div>
                ) : !detail ? (
                    <p className="py-20 text-center text-sm text-slate-400">Ticket indisponible.</p>
                ) : (
                    <div className="space-y-4">
                        {/* Facts */}
                        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 @sm:grid-cols-4">
                            {[
                                { label: "Statut", value: STATUS_META[detail.status].label },
                                { label: "Priorité", value: PRIORITY_META[detail.priority].label },
                                {
                                    label: "Catégorie",
                                    value: CATEGORY_LABELS[detail.category] ?? detail.category,
                                },
                                { label: "Origine", value: detail.source === "ASSISTANT" ? "Assistant IA" : "Web" },
                            ].map((f) => (
                                <div key={f.label}>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        {f.label}
                                    </p>
                                    <p className="mt-0.5 text-xs font-bold text-slate-800">{f.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* The reason routing support through the AI is worth anything. */}
                        {linkedConversationId && (
                            <Link
                                href={`/manager/assistant?conversation=${linkedConversationId}`}
                                className="flex items-center gap-2 rounded-xl border border-[#2890F8]/30 bg-[#E8F2FE]/50 px-3 py-2 text-xs font-semibold text-[#1A75CE] transition-colors hover:bg-[#E8F2FE]"
                            >
                                <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                                Voir la conversation qui a généré ce ticket
                            </Link>
                        )}

                        <div className="rounded-xl border border-slate-200 p-3">
                            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Demande
                            </p>
                            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                                {detail.body}
                            </p>
                        </div>

                        {/* Thread */}
                        {detail.messages.length > 1 && (
                            <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    Échanges
                                </p>
                                {detail.messages.slice(1).map((m) => (
                                    <div
                                        key={m.id}
                                        className={cn(
                                            "rounded-xl border px-3 py-2",
                                            m.isSystem
                                                ? "border-slate-200 bg-slate-50 text-slate-500"
                                                : "border-slate-200 bg-white"
                                        )}
                                    >
                                        <div className="mb-0.5 flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                {m.isSystem ? "Système" : (m.author?.name ?? "—")}
                                            </span>
                                            <span className="text-[10px] tabular-nums text-slate-400">
                                                {fmtDate(m.createdAt)}
                                            </span>
                                        </div>
                                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                                            {m.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Triage — only the transitions that make sense from here. */}
                        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                Actions
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {NEXT_STATUS.filter((s) => s.from.includes(detail.status)).map((s) => (
                                    <button
                                        key={s.to}
                                        type="button"
                                        disabled={saving}
                                        onClick={() => void patch({ status: s.to })}
                                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2890F8]/40"
                                    >
                                        {s.label}
                                    </button>
                                ))}
                                {detail.priority !== "URGENT" && (
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => void patch({ priority: "URGENT" })}
                                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                                    >
                                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                        Passer en urgent
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 pt-1 @sm:flex-row">
                                <textarea
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    rows={2}
                                    placeholder="Répondre au demandeur…"
                                    aria-label="Réponse"
                                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 focus:border-[#2890F8] focus:outline-none focus:ring-2 focus:ring-[#2890F8]/15"
                                />
                                <button
                                    type="button"
                                    disabled={saving || !reply.trim()}
                                    onClick={() => void patch({ reply: reply.trim() })}
                                    className="flex h-9 shrink-0 items-center justify-center gap-1.5 self-end rounded-xl bg-[#2890F8] px-3 text-xs font-bold text-white transition-colors hover:bg-[#1A75CE] disabled:opacity-45"
                                >
                                    {saving ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                    Envoyer
                                </button>
                            </div>
                        </div>

                        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <UserIcon className="h-3 w-3" aria-hidden="true" />
                            Ouvert le {fmtDate(detail.createdAt)}
                            {detail.mission ? ` · mission ${detail.mission.name}` : ""}
                        </p>
                    </div>
                )}
            </Drawer>
        </div>
    );
}
