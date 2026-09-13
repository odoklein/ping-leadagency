"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
    ArrowDown,
    BarChart3,
    Calendar,
    CalendarDays,
    CheckCircle2,
    History,
    MapPin,
    MessageCircle,
    Send,
    Wrench,
    X,
    Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SUP_LIGHT } from "./supportStyles";
import { AvatarRing, SupportBubble } from "./SupportBubble";
import { SUPPORT_INTENTS } from "@/lib/support/types";
import type {
    SupportConversationDetailDTO,
    SupportIntent,
    SupportMessageContext,
    SupportMessageDTO,
} from "@/lib/support/types";

const QUICK_REPLIES: string[] = [
    "Merci pour le suivi.",
    "Pouvez-vous me rappeler demain ?",
    "J'ai bien reçu le document, merci !",
    "Pouvez-vous m'envoyer un rapport détaillé ?",
    "Quand aura lieu la prochaine mise à jour ?",
];

const PAGE_LABELS: Record<string, string> = {
    "/client/portal": "Tableau de bord",
    "/client/portal/meetings": "Mes RDV",
    "/client/portal/reporting": "Rapports",
    "/client/portal/activite": "Activité",
    "/client/contact": "Messages",
    "/client/portal/email": "Mon Email",
    "/client/portal/database": "Base de données",
    "/client/portal/files": "Fichiers",
    "/client/portal/sales-playbook": "Sales Playbook",
    "/client/portal/aide": "Aide",
    "/client/portal/settings": "Paramètres",
};

function currentPageLabel(pathname: string | null): string {
    if (!pathname) return "Portail client";
    const exact = PAGE_LABELS[pathname];
    if (exact) return exact;
    const prefix = Object.keys(PAGE_LABELS)
        .filter((k) => pathname.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
    return prefix ? PAGE_LABELS[prefix] : "Portail client";
}

const T = SUP_LIGHT;

const INTENT_STYLES: Record<
    SupportIntent,
    { color: string; bg: string; border: string; Icon: LucideIcon; label: string }
> = {
    RDV: {
        color: "#1a75ce",
        bg: "#e6f0fa",
        border: "rgba(40,144,248,0.22)",
        Icon: Calendar,
        label: "Question RDV",
    },
    RAPPORT: {
        color: "#155B7A",
        bg: "#E4EEF4",
        border: "rgba(21,91,122,0.18)",
        Icon: BarChart3,
        label: "Rapport",
    },
    PROBLEME: {
        color: "#8A4A00",
        bg: "#FDF3E2",
        border: "rgba(201,123,42,0.22)",
        Icon: Wrench,
        label: "Problème",
    },
    AUTRE: {
        color: "#333333",
        bg: "#eeeeee",
        border: "rgba(8,8,8,0.12)",
        Icon: MessageCircle,
        label: "Autre",
    },
};

const DRAFT_KEY = "cp-support-draft";

interface ClientSupportPanelProps {
    conversation: SupportConversationDetailDTO;
    onClose: () => void;
    onConversationUpdate: (next: SupportConversationDetailDTO) => void;
}

interface UpcomingMeeting {
    id: string;
    label: string;
    date: string;
}

export function ClientSupportPanel({
    conversation,
    onClose,
    onConversationUpdate,
}: ClientSupportPanelProps) {
    const pathname = usePathname();
    const pageLabel = useMemo(() => currentPageLabel(pathname), [pathname]);

    const [inputValue, setInputValue] = useState("");
    const [emailNotif, setEmailNotif] = useState(conversation.emailNotificationOnReply);
    const [selectedIntent, setSelectedIntent] = useState<SupportIntent | null>(null);
    const [showIntentCard, setShowIntentCard] = useState(
        conversation.messageCount === 0 ||
            conversation.messages.every((m) => m.role !== "CLIENT"),
    );
    const [showContextBanner, setShowContextBanner] = useState(true);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [showResolvedHistory, setShowResolvedHistory] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [newMessageCount, setNewMessageCount] = useState(0);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [upcoming, setUpcoming] = useState<UpcomingMeeting[]>([]);
    const [injectedContext, setInjectedContext] = useState<{
        pageLabel?: string;
        rdvRefs: string[];
    }>({ rdvRefs: [] });

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);

    const messages = conversation.messages;
    const isResolved = conversation.status === "RESOLVED";
    const latestNewThreadMarkerIndex = [...messages]
        .map((m, idx) => ({ m, idx }))
        .reverse()
        .find(({ m }) =>
            m.role === "SYSTEM" &&
            m.context?.pathname === "client-new-thread",
        )?.idx ?? -1;
    const hasResolvedHistory = latestNewThreadMarkerIndex > 0;
    const visibleMessages = hasResolvedHistory && !showResolvedHistory
        ? messages.slice(latestNewThreadMarkerIndex)
        : messages;

    useEffect(() => {
        fetch("/api/support/conversation/read", { method: "POST" }).catch(() => undefined);
    }, []);

    // Restore an unsent draft, and focus the composer on open.
    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(DRAFT_KEY);
            if (saved) setInputValue(saved);
        } catch {
            /* storage unavailable */
        }
        const id = requestAnimationFrame(() => textareaRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, []);

    useEffect(() => {
        try {
            if (inputValue) window.localStorage.setItem(DRAFT_KEY, inputValue);
            else window.localStorage.removeItem(DRAFT_KEY);
        } catch {
            /* storage unavailable */
        }
    }, [inputValue]);

    // Escape closes; a click outside the panel and outside the launcher closes too.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        const onPointerDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (panelRef.current?.contains(target)) return;
            if (target.closest(".cp-sup-fab-wrap")) return;
            onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("mousedown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("mousedown", onPointerDown);
        };
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/support/upcoming-meetings")
            .then((r) => r.json())
            .then((json) => {
                if (cancelled || !json?.success) return;
                setUpcoming(json.data?.meetings ?? []);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        setIsAtBottom(atBottom);
        if (atBottom) setNewMessageCount(0);
    }, []);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }, [inputValue]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setNewMessageCount(0);
    };

    const canSend = inputValue.trim().length > 0 && !sending;

    const appendMessage = useCallback(
        (next: SupportMessageDTO) => {
            const updated: SupportConversationDetailDTO = {
                ...conversation,
                messages: [...conversation.messages, next],
                messageCount: conversation.messageCount + 1,
                lastMessageAt: next.createdAt,
                status: "ACTIVE",
                resolvedAt: null,
                resolvedBy: null,
            };
            onConversationUpdate(updated);
            if (isAtBottom) {
                setTimeout(
                    () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
                    40,
                );
            } else {
                setNewMessageCount((c) => c + 1);
            }
        },
        [conversation, isAtBottom, onConversationUpdate],
    );

    const handleSend = async () => {
        const text = inputValue.trim();
        if (!text || sending) return;
        const intentAtSend = selectedIntent;
        const contextAtSend = injectedContext;

        setSending(true);
        setSendError(null);

        const optimistic: SupportMessageDTO = {
            id: `tmp-${Date.now()}`,
            conversationId: conversation.id,
            role: "CLIENT",
            content: text,
            intent: intentAtSend,
            context: null,
            author: null,
            createdAt: new Date().toISOString(),
        };
        appendMessage(optimistic);
        setInputValue("");
        setShowIntentCard(false);

        const ctx: SupportMessageContext = {
            pathname: pathname ?? undefined,
            pageLabel: contextAtSend.pageLabel,
            rdvRefs: contextAtSend.rdvRefs.length > 0 ? contextAtSend.rdvRefs : undefined,
            intent: intentAtSend ?? undefined,
        };
        setInjectedContext({ rdvRefs: [] });
        setSelectedIntent(null);

        try {
            const res = await fetch("/api/support/conversation/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: text,
                    intent: intentAtSend ?? undefined,
                    context: ctx,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json?.success) {
                throw new Error(json?.error ?? "Impossible d'envoyer le message");
            }
            const saved = json.data as SupportMessageDTO;
            onConversationUpdate({
                ...conversation,
                messages: [
                    ...conversation.messages.filter((m) => m.id !== optimistic.id),
                    saved,
                ],
                messageCount: conversation.messageCount + 1,
                lastMessageAt: saved.createdAt,
                status: "ACTIVE",
                resolvedAt: null,
                resolvedBy: null,
            });
        } catch (err) {
            // Roll the optimistic bubble back and hand the text back to the client:
            // a failed send must be recoverable, not silently swallowed.
            onConversationUpdate(conversation);
            setInputValue(text);
            setSelectedIntent(intentAtSend);
            setInjectedContext(contextAtSend);
            setSendError(
                err instanceof Error ? err.message : "Votre message n'a pas pu être envoyé.",
            );
        } finally {
            setSending(false);
            textareaRef.current?.focus();
        }
    };

    const handleIntentSelect = (intent: SupportIntent) => {
        setSelectedIntent(intent);
        setShowIntentCard(false);
        textareaRef.current?.focus();
    };

    const handleAddContext = () => {
        setInputValue((v) => v + (v ? " " : "") + `[📍 ${pageLabel}]`);
        setInjectedContext((c) => ({ ...c, pageLabel }));
        setShowContextBanner(false);
        textareaRef.current?.focus();
    };

    const handleMeetingTag = (m: UpcomingMeeting) => {
        const ref = `[@RDV:${m.label}]`;
        setInputValue((v) => v + (v ? " " : "") + ref);
        setInjectedContext((c) => ({
            ...c,
            rdvRefs: Array.from(new Set([...c.rdvRefs, m.label])),
        }));
        textareaRef.current?.focus();
    };

    const handleQuickReply = (reply: string) => {
        setInputValue(reply);
        setShowQuickReplies(false);
        textareaRef.current?.focus();
    };

    const handleEmailNotifToggle = async () => {
        const next = !emailNotif;
        setEmailNotif(next);
        try {
            await fetch("/api/support/conversation/email-notification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: next }),
            });
        } catch {
            setEmailNotif(!next);
        }
    };

    const handleReopen = async () => {
        try {
            const res = await fetch("/api/support/conversation/reopen", {
                method: "POST",
            });
            if (!res.ok) return;
            const detail = await fetch("/api/support/conversation").then((r) => r.json());
            if (detail?.success) {
                onConversationUpdate(detail.data);
                setShowResolvedHistory(false);
            }
        } catch {
            // ignore
        }
    };

    const lastClientMessage = [...visibleMessages].reverse().find((m) => m.role === "CLIENT");

    return (
        <div
            ref={panelRef}
            className="cp-support-root cp-sup-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cp-sup-title"
            style={{
                position: "fixed",
                bottom: 96,
                right: 24,
                zIndex: 2147482999,
                width: 420,
                maxWidth: "calc(100vw - 32px)",
                height: 640,
                maxHeight: "calc(100vh - 128px)",
                borderRadius: T.radiusXL,
                overflow: "hidden",
                background: T.paper,
                border: `1px solid ${T.line}`,
                boxShadow: T.shadowPanel,
                display: "flex",
                flexDirection: "column",
                animation: "cpSupPanelIn 0.35s cubic-bezier(.34,1.4,.64,1) both",
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderBottom: `1px solid ${T.line}`,
                    background: T.paperRaised,
                    flexShrink: 0,
                }}
            >
                <AvatarRing name="Équipe support" size={40} status="none" theme="light" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        id="cp-sup-title"
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: T.ink,
                            lineHeight: 1.2,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        Équipe support Ping
                    </div>
                    <div
                        style={{
                            fontSize: 11.5,
                            color: T.ink3,
                            marginTop: 2,
                            fontWeight: 500,
                        }}
                    >
                        Réponse sous quelques heures ouvrées
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer le panneau"
                    className="cp-sup-icon-btn"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: T.radiusS,
                        background: T.paperSunken,
                        border: `1px solid ${T.line}`,
                        color: T.ink3,
                        flexShrink: 0,
                    }}
                >
                    <X size={15} aria-hidden="true" />
                </button>
            </div>

            {/* Messages area */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="cp-sup-scroll-hidden"
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "16px",
                    position: "relative",
                    background: isResolved ? "rgba(124,92,252,0.05)" : T.paper,
                    transition: "background 0.5s ease",
                }}
            >
                {showContextBanner && !isResolved && (
                    <div
                        style={{
                            margin: "0 0 12px",
                            padding: "10px 14px",
                            borderRadius: T.radiusS,
                            border: `1px solid rgba(201,123,42,0.22)`,
                            background: T.accentAmberSoft,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            animation: "cpSupSlideDown 0.3s ease both",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                minWidth: 0,
                            }}
                        >
                            <MapPin size={14} style={{ color: "#8A4A00", flexShrink: 0 }} aria-hidden="true" />
                            <span
                                style={{
                                    fontSize: 12,
                                    color: "#8A4A00",
                                    fontWeight: 500,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                Vous consultez : {pageLabel}
                            </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                                type="button"
                                onClick={handleAddContext}
                                className="cp-sup-chip"
                                style={{
                                    padding: "3px 10px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: "#FDE9CA",
                                    border: "1px solid rgba(201,123,42,0.3)",
                                    color: "#8A4A00",
                                }}
                            >
                                Joindre la page
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowContextBanner(false)}
                                aria-label="Fermer le bandeau"
                                className="cp-sup-icon-btn"
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 6,
                                    background: "transparent",
                                    border: "none",
                                    color: T.ink3,
                                }}
                            >
                                <X size={12} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                )}

                {hasResolvedHistory && !isResolved && (
                    <div
                        style={{
                            margin: "0 0 12px",
                            padding: "10px 12px",
                            borderRadius: T.radiusS,
                            border: `1px solid ${T.line}`,
                            background: T.paperRaised,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            animation: "cpSupSlideDown 0.2s ease both",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                color: T.ink3,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                            }}
                        >
                            <History size={13} aria-hidden="true" />
                            Historique résolu masqué
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowResolvedHistory((v) => !v)}
                            className="cp-sup-chip"
                            style={{
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 600,
                                background: T.brandSoft,
                                border: `1px solid rgba(40,144,248,0.2)`,
                                color: T.brandStrong,
                            }}
                        >
                            {showResolvedHistory ? "Masquer" : "Voir l'historique"}
                        </button>
                    </div>
                )}

                {visibleMessages.map((msg) => (
                    <SupportBubble
                        key={msg.id}
                        message={msg}
                        viewpoint="client"
                        theme="light"
                        isLast={lastClientMessage?.id === msg.id}
                        seen={!msg.id.startsWith("tmp-")}
                    />
                ))}

                {showIntentCard && !isResolved && (
                    <div
                        style={{
                            margin: "8px 0 12px",
                            padding: 16,
                            borderRadius: T.radiusM,
                            border: `1px solid ${T.line}`,
                            background: T.paperRaised,
                            boxShadow: "0 1px 2px rgba(31,43,31,0.04)",
                            animation: "cpSupBubbleIn 0.3s ease both",
                        }}
                    >
                        <p
                            style={{
                                fontSize: 11,
                                color: T.ink3,
                                marginBottom: 12,
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                            }}
                        >
                            Que puis-je faire pour vous ?
                        </p>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8,
                            }}
                        >
                            {SUPPORT_INTENTS.map((intent) => {
                                const style = INTENT_STYLES[intent.id];
                                const Icon = style.Icon;
                                return (
                                    <button
                                        key={intent.id}
                                        type="button"
                                        onClick={() => handleIntentSelect(intent.id)}
                                        className="cp-sup-chip"
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: T.radiusS,
                                            background: style.bg,
                                            border: `1px solid ${style.border}`,
                                            color: style.color,
                                            textAlign: "left",
                                            fontSize: 13,
                                            fontWeight: 600,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <Icon size={16} style={{ flexShrink: 0 }} aria-hidden="true" />
                                        <span>{style.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />

                {newMessageCount > 0 && !isAtBottom && (
                    <div
                        style={{
                            position: "sticky",
                            bottom: 0,
                            display: "flex",
                            justifyContent: "center",
                            pointerEvents: "none",
                        }}
                    >
                        <button
                            type="button"
                            onClick={scrollToBottom}
                            className="cp-sup-chip"
                            style={{
                                pointerEvents: "auto",
                                padding: "6px 14px",
                                borderRadius: 999,
                                background: `linear-gradient(135deg, ${T.brand}, ${T.brandStrong})`,
                                border: "none",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                boxShadow: "0 6px 14px rgba(40,144,248,0.25)",
                                animation: "cpSupBubbleIn 0.2s ease both",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <ArrowDown size={13} aria-hidden="true" />
                            {newMessageCount} nouveau{newMessageCount > 1 ? "x" : ""} message
                            {newMessageCount > 1 ? "s" : ""}
                        </button>
                    </div>
                )}
            </div>

            {/* Resolved banner */}
            {isResolved && (
                <div
                    style={{
                        padding: "12px 16px",
                        background: T.brandSoft,
                        borderTop: `1px solid rgba(40,144,248,0.2)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        animation: "cpSupSlideDown 0.3s ease both",
                        flexShrink: 0,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CheckCircle2 size={16} style={{ color: T.brandStrong }} aria-hidden="true" />
                        <span style={{ fontSize: 13, color: T.brandStrong, fontWeight: 600 }}>
                            Conversation résolue
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleReopen}
                        className="cp-sup-chip"
                        style={{
                            padding: "4px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            background: "#fff",
                            border: `1px solid ${T.brand}`,
                            color: T.brandStrong,
                        }}
                    >
                        Rouvrir
                    </button>
                </div>
            )}

            {/* Quick replies */}
            {showQuickReplies && !isResolved && (
                <div
                    style={{
                        borderTop: `1px solid ${T.lineSoft}`,
                        padding: "12px 16px",
                        background: T.paperSunken,
                        animation: "cpSupSlideUp 0.2s ease both",
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 10,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: T.ink3,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                            }}
                        >
                            Réponses rapides
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowQuickReplies(false)}
                            aria-label="Fermer les réponses rapides"
                            className="cp-sup-icon-btn"
                            style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                background: "none",
                                border: "none",
                                color: T.ink3,
                            }}
                        >
                            <X size={13} aria-hidden="true" />
                        </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {QUICK_REPLIES.map((reply) => (
                            <button
                                key={reply}
                                type="button"
                                onClick={() => handleQuickReply(reply)}
                                className="cp-sup-quick"
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: T.radiusS,
                                    textAlign: "left",
                                    background: T.paperRaised,
                                    border: `1px solid ${T.line}`,
                                    color: T.ink2,
                                    fontSize: 13,
                                }}
                            >
                                {reply}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Composer */}
            {!isResolved && (
                <div
                    style={{
                        borderTop: `1px solid ${T.lineSoft}`,
                        padding: "12px 14px",
                        background: T.paperRaised,
                        flexShrink: 0,
                    }}
                >
                    {selectedIntent && (
                        <div
                            style={{
                                marginBottom: 8,
                                animation: "cpSupSlideDown 0.2s ease both",
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    background: INTENT_STYLES[selectedIntent].bg,
                                    border: `1px solid ${INTENT_STYLES[selectedIntent].border}`,
                                    color: INTENT_STYLES[selectedIntent].color,
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            >
                                {(() => {
                                    const Icon = INTENT_STYLES[selectedIntent].Icon;
                                    return <Icon size={13} aria-hidden="true" />;
                                })()}
                                {INTENT_STYLES[selectedIntent].label}
                                <button
                                    type="button"
                                    onClick={() => setSelectedIntent(null)}
                                    aria-label="Retirer l'intention"
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: INTENT_STYLES[selectedIntent].color,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        padding: 0,
                                        marginLeft: 2,
                                    }}
                                >
                                    <X size={12} aria-hidden="true" />
                                </button>
                            </span>
                        </div>
                    )}

                    {selectedIntent === "RDV" && upcoming.length > 0 && (
                        <div
                            style={{
                                display: "flex",
                                gap: 6,
                                marginBottom: 8,
                                flexWrap: "wrap",
                                animation: "cpSupSlideDown 0.2s ease both",
                            }}
                        >
                            {upcoming.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleMeetingTag(m)}
                                    className="cp-sup-chip"
                                    style={{
                                        padding: "4px 10px",
                                        borderRadius: 999,
                                        fontSize: 11.5,
                                        fontWeight: 500,
                                        background: T.brandSofter,
                                        border: `1px solid rgba(40,144,248,0.22)`,
                                        color: T.brandStrong,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                    }}
                                >
                                    <CalendarDays size={12} aria-hidden="true" />
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {sendError && (
                        <div
                            role="alert"
                            style={{
                                marginBottom: 8,
                                padding: "8px 10px",
                                borderRadius: T.radiusXS,
                                background: T.dangerSoft,
                                border: `1px solid rgba(185,67,62,0.22)`,
                                color: T.danger,
                                fontSize: 11.5,
                                fontWeight: 500,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                animation: "cpSupSlideDown 0.2s ease both",
                            }}
                        >
                            <X size={13} style={{ flexShrink: 0 }} aria-hidden="true" />
                            {sendError} Votre message a été conservé — réessayez.
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setShowQuickReplies((v) => !v)}
                            title="Réponses rapides"
                            aria-label="Afficher les réponses rapides"
                            aria-pressed={showQuickReplies}
                            className="cp-sup-icon-btn"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: T.radiusS,
                                flexShrink: 0,
                                background: showQuickReplies ? T.brandSoft : T.paperSunken,
                                border: `1px solid ${showQuickReplies ? "rgba(40,144,248,0.28)" : T.line}`,
                                color: showQuickReplies ? T.brandStrong : T.ink3,
                            }}
                        >
                            <Zap size={16} aria-hidden="true" />
                        </button>

                        <div
                            style={{
                                flex: 1,
                                borderRadius: T.radiusS,
                                background: T.paperSunken,
                                border: `1px solid ${T.line}`,
                                padding: "8px 12px",
                            }}
                        >
                            <textarea
                                ref={textareaRef}
                                className="cp-sup-composer-input cp-sup-scroll-hidden"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={
                                    selectedIntent === "RDV"
                                        ? "Quel rendez-vous vous pose question ?"
                                        : "Écrivez votre message..."
                                }
                                rows={1}
                                aria-label="Message au support"
                                style={{
                                    width: "100%",
                                    background: "transparent",
                                    border: "none",
                                    resize: "none",
                                    color: T.ink,
                                    fontSize: 13.5,
                                    fontFamily: "inherit",
                                    lineHeight: 1.5,
                                    maxHeight: 120,
                                    overflowY: "auto",
                                }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={!canSend}
                            aria-label="Envoyer"
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: T.radiusS,
                                flexShrink: 0,
                                background: canSend
                                    ? `linear-gradient(135deg, ${T.brand}, ${T.brandStrong})`
                                    : T.paperSunken,
                                border: canSend ? "none" : `1px solid ${T.line}`,
                                color: canSend ? "#fff" : T.ink4,
                                cursor: canSend ? "pointer" : "not-allowed",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 200ms cubic-bezier(.34,1.56,.64,1)",
                                transform: canSend ? "scale(1)" : "scale(0.95)",
                                boxShadow: canSend
                                    ? "0 6px 14px rgba(40,144,248,0.25)"
                                    : "none",
                            }}
                        >
                            <Send size={15} aria-hidden="true" />
                        </button>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 8,
                            gap: 8,
                        }}
                    >
                        <p
                            className="cp-support-root-mono"
                            style={{
                                fontSize: 10.5,
                                color: T.ink4,
                                fontWeight: 500,
                                letterSpacing: "0.02em",
                                margin: 0,
                            }}
                        >
                            Entrée pour envoyer · Maj+Entrée pour saut de ligne
                        </p>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                cursor: "pointer",
                                flexShrink: 0,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={emailNotif}
                                onChange={handleEmailNotifToggle}
                                style={{ cursor: "pointer", accentColor: T.brand }}
                            />
                            <span style={{ fontSize: 10.5, color: T.ink3, fontWeight: 500, whiteSpace: "nowrap" }}>
                                M&apos;avertir par email
                            </span>
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}
