"use client";

import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import {
    ArrowDown,
    ArrowUp,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Copy,
    Loader2,
    Maximize2,
    Minimize2,
    MessageSquarePlus,
    RefreshCw,
    Search,
    Sparkles,
    Square,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAssistantQuickPrompts } from "@/lib/assistant/context";
import Markdown from "./Markdown";

// ============================================
// TYPES
// ============================================

type ChatRole = "user" | "assistant";

interface ToolCallTrace {
    tool: string;
    ok: boolean;
    durationMs: number;
    errorCode?: string;
}

interface ChatMessage {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: string;
    /** Only on assistant turns that ran the tool loop. */
    trace?: { elapsedMs: number; toolCalls: ToolCallTrace[]; model?: string | null };
    isError?: boolean;
}

interface ConversationItem {
    id: string;
    title: string;
    updatedAt: string;
    summary?: string | null;
    messageCount: number;
}

export interface AssistantPanelProps {
    isOpen: boolean;
    onClose: () => void;
    role?: string;
    pathname?: string;
}

// ============================================
// HELPERS
// ============================================

function uid(): string {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeMessage(role: ChatRole, content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
    return { id: uid(), role, content, createdAt: new Date().toISOString(), ...extra };
}

function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days} j`;
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatSeconds(ms: number): string {
    const seconds = ms / 1000;
    return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`;
}

/** Human labels for the read-only tool catalogue. */
const TOOL_LABELS: Record<string, string> = {
    get_my_profile: "Profil & accès",
    get_my_permissions: "Permissions",
    get_my_campaigns: "Campagnes",
    get_mission_status: "Détail mission",
    get_campaign_metrics: "Métriques de performance",
    get_activity_summary: "Activité récente",
    get_my_meetings: "RDV",
    get_prospect_history: "Historique prospect",
    get_list_health: "Santé de liste",
    search_ping_help: "Documentation Ping",
};

function toolLabel(name: string): string {
    return TOOL_LABELS[name] ?? name;
}

// ============================================
// TOOL TRACE
// ============================================

const ToolTrace = memo(function ToolTrace({ trace }: { trace: NonNullable<ChatMessage["trace"]> }) {
    const [expanded, setExpanded] = useState(false);
    const count = trace.toolCalls.length;

    if (count === 0) {
        return (
            <div className="cp-trace-line">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>Réponse directe · {formatSeconds(trace.elapsedMs)}</span>
            </div>
        );
    }

    return (
        <div className="cp-trace">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="cp-trace-toggle"
                aria-expanded={expanded}
            >
                <Search className="h-3 w-3 shrink-0" />
                <span>
                    {count} source{count > 1 ? "s" : ""} consultée{count > 1 ? "s" : ""}
                </span>
                <span className="cp-trace-dot" aria-hidden="true" />
                <span className="cp-trace-time">{formatSeconds(trace.elapsedMs)}</span>
                <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-90")} />
            </button>

            {expanded && (
                <ul className="cp-trace-list">
                    {trace.toolCalls.map((call, i) => (
                        <li key={`${call.tool}-${i}`} className="cp-trace-item">
                            <span className={cn("cp-trace-status", call.ok ? "is-ok" : "is-ko")} aria-hidden="true" />
                            <span className="cp-trace-name">{toolLabel(call.tool)}</span>
                            <span className="cp-trace-meta">
                                {call.ok ? `${call.durationMs} ms` : (call.errorCode ?? "refusé")}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

// ============================================
// MESSAGE ROW
// ============================================

interface MessageRowProps {
    message: ChatMessage;
    isCopied: boolean;
    canRegenerate: boolean;
    onCopy: (message: ChatMessage) => void;
    onRegenerate: () => void;
}

const MessageRow = memo(function MessageRow({
    message,
    isCopied,
    canRegenerate,
    onCopy,
    onRegenerate,
}: MessageRowProps) {
    if (message.role === "user") {
        return (
            <div className="cp-row cp-row-user">
                <div className="cp-bubble-user">{message.content}</div>
            </div>
        );
    }

    return (
        <div className="cp-row cp-row-assistant group">
            {message.trace && <ToolTrace trace={message.trace} />}

            <div className={cn("cp-answer", message.isError && "cp-answer-error")}>
                {message.isError ? <p className="cp-md-p">{message.content}</p> : <Markdown content={message.content} />}
            </div>

            <div className="cp-actions">
                <button type="button" onClick={() => onCopy(message)} className="cp-action" aria-label="Copier la réponse">
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{isCopied ? "Copié" : "Copier"}</span>
                </button>
                {canRegenerate && (
                    <button type="button" onClick={onRegenerate} className="cp-action" aria-label="Régénérer la réponse">
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Régénérer</span>
                    </button>
                )}
            </div>
        </div>
    );
});

// ============================================
// PANEL
// ============================================

export default function AssistantPanel({ isOpen, onClose, role, pathname }: AssistantPanelProps) {
    const [mounted, setMounted] = useState(false);
    const [closing, setClosing] = useState(false);
    const [wide, setWide] = useState(false);

    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [atBottom, setAtBottom] = useState(true);
    const [model, setModel] = useState<string | null>(null);
    const [sessionId] = useState(uid);

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const prompts = useMemo(() => getAssistantQuickPrompts(pathname, role), [pathname, role]);
    const activeConversation = useMemo(
        () => conversations.find((c) => c.id === activeConversationId),
        [conversations, activeConversationId]
    );

    // ── Mount / exit animation ────────────────────────────────────────────────

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            setClosing(false);
            return;
        }
        if (!mounted) return;
        setClosing(true);
        const timer = window.setTimeout(() => {
            setMounted(false);
            setClosing(false);
        }, 180);
        return () => window.clearTimeout(timer);
    }, [isOpen, mounted]);

    // Lock the page behind the panel on mobile only: on desktop it is a side panel.
    useEffect(() => {
        if (!isOpen) return;
        const isMobile = window.matchMedia("(max-width: 639px)").matches;
        if (!isMobile) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showHistory) setShowHistory(false);
                else onClose();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose, showHistory]);

    // ── Data ──────────────────────────────────────────────────────────────────

    const mapHistory = (raw: unknown): ChatMessage[] =>
        ((raw as Array<{ role: ChatRole; content: string; createdAt: string }>) ?? []).map((m) => ({
            id: uid(),
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
        }));

    const loadConversations = useCallback(async (conversationId?: string) => {
        setIsLoadingHistory(true);
        try {
            const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
            const res = await fetch(`/api/assistant/conversations${query}`);
            const json = await res.json();
            if (!json.success) return;
            setConversations(json.data.sessions ?? []);
            setActiveConversationId(json.data.activeConversationId ?? null);
            setMessages(mapHistory(json.data.messages));
        } catch {
            // Keep local state when history cannot be loaded.
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        void loadConversations();
    }, [isOpen, loadConversations]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(() => inputRef.current?.focus(), 140);
        return () => window.clearTimeout(timer);
    }, [isOpen, activeConversationId]);

    useEffect(() => {
        if (!showHistory) return;
        const handler = (e: MouseEvent) => {
            if (historyRef.current && !historyRef.current.contains(e.target as Node)) setShowHistory(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showHistory]);

    // ── Scroll ────────────────────────────────────────────────────────────────

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        const el = scrollerRef.current;
        if (!el) return;
        requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior }));
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    }, []);

    // Follow new content only when the user is already reading the bottom.
    useEffect(() => {
        if (atBottom) scrollToBottom(messages.length > 1 ? "smooth" : "auto");
    }, [messages, isSending, atBottom, scrollToBottom]);

    // ── Elapsed timer ─────────────────────────────────────────────────────────

    useEffect(() => {
        if (!isSending) return;
        const startedAt = Date.now();
        setElapsedMs(0);
        const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
        return () => window.clearInterval(timer);
    }, [isSending]);

    // ── Conversations ─────────────────────────────────────────────────────────

    const createConversation = useCallback(async (): Promise<string | null> => {
        try {
            const res = await fetch("/api/assistant/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "new" }),
            });
            const json = await res.json();
            if (!json.success) return null;
            setActiveConversationId(json.data.conversationId);
            setMessages([]);
            setShowHistory(false);
            void loadConversations(json.data.conversationId);
            inputRef.current?.focus();
            return json.data.conversationId as string;
        } catch {
            return null;
        }
    }, [loadConversations]);

    const switchConversation = useCallback(
        async (conversationId: string) => {
            setShowHistory(false);
            if (conversationId === activeConversationId) return;
            try {
                const res = await fetch("/api/assistant/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "setActive", conversationId }),
                });
                const json = await res.json();
                if (!json.success) return;
                setActiveConversationId(conversationId);
                setMessages(mapHistory(json.data.messages));
                setAtBottom(true);
            } catch {
                // Ignore switch errors.
            }
        },
        [activeConversationId]
    );

    // ── Messaging ─────────────────────────────────────────────────────────────

    const runRequest = useCallback(
        async (history: ChatMessage[], conversationId: string | null) => {
            const controller = new AbortController();
            abortRef.current = controller;
            const startedAt = Date.now();
            setIsSending(true);
            setAtBottom(true);

            try {
                const res = await fetch("/api/assistant/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify({
                        messages: history.map((m) => ({ role: m.role, content: m.content })),
                        context: { role, pathname },
                        sessionId,
                        conversationId: conversationId ?? undefined,
                    }),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error || "La requête a échoué");

                setModel(json.data.model ?? null);
                setMessages((prev) => [
                    ...prev,
                    makeMessage("assistant", json.data.answer, {
                        trace: {
                            elapsedMs: Date.now() - startedAt,
                            toolCalls: (json.data.toolCalls ?? []) as ToolCallTrace[],
                            model: json.data.model ?? null,
                        },
                    }),
                ]);
                if (json.data.conversationId) setActiveConversationId(json.data.conversationId);
                void loadConversations(json.data.conversationId ?? conversationId ?? undefined);
            } catch (error) {
                if ((error as Error)?.name === "AbortError") return;
                const detail = error instanceof Error ? error.message : "erreur inconnue";
                setMessages((prev) => [
                    ...prev,
                    makeMessage("assistant", `Je n'ai pas pu répondre (${detail}). Réessayez dans quelques secondes.`, {
                        isError: true,
                    }),
                ]);
            } finally {
                abortRef.current = null;
                setIsSending(false);
            }
        },
        [loadConversations, pathname, role, sessionId]
    );

    const sendMessage = useCallback(
        async (textFromPrompt?: string) => {
            const text = (textFromPrompt ?? input).trim();
            if (!text || isSending) return;

            let conversationId = activeConversationId;
            if (!conversationId) conversationId = await createConversation();

            const nextMessages = [...messages, makeMessage("user", text)];
            setMessages(nextMessages);
            setInput("");
            if (inputRef.current) inputRef.current.style.height = "auto";

            await runRequest(nextMessages, conversationId);
        },
        [activeConversationId, createConversation, input, isSending, messages, runRequest]
    );

    const regenerate = useCallback(async () => {
        if (isSending) return;
        const lastUserIndex = [...messages].map((m) => m.role).lastIndexOf("user");
        if (lastUserIndex === -1) return;
        const history = messages.slice(0, lastUserIndex + 1);
        setMessages(history);
        await runRequest(history, activeConversationId);
    }, [activeConversationId, isSending, messages, runRequest]);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setIsSending(false);
    }, []);

    const copyMessage = useCallback(async (message: ChatMessage) => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopiedId(message.id);
            window.setTimeout(() => setCopiedId((id) => (id === message.id ? null : id)), 1800);
        } catch {
            // Clipboard can be blocked; nothing to recover.
        }
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
    }, []);

    const lastAssistantId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") return messages[i].id;
        }
        return null;
    }, [messages]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (!mounted || typeof document === "undefined") return null;

    const modelLabel = model?.includes("large")
        ? "Mistral Large"
        : model
          ? model.replace(/-latest$/, "").replace(/-/g, " ")
          : "Mistral";

    return createPortal(
        <div className="cp-panel-root" role="dialog" aria-modal="true" aria-label="Assistant Ping">
            <div
                className={cn("cp-scrim", closing ? "is-closing" : "is-open")}
                onClick={onClose}
                aria-hidden="true"
            />

            <section className={cn("cp-panel", wide && "is-wide", closing ? "is-closing" : "is-open")}>
                {/* ── Header ─────────────────────────────────────────────── */}
                <header className="cp-header">
                    <div className="cp-brand">
                        <span className="cp-brand-mark">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        <span className="cp-brand-text">
                            <span className="cp-brand-title">Assistant Ping</span>
                            <span className="cp-brand-sub">{activeConversation?.title ?? "Nouvelle conversation"}</span>
                        </span>
                    </div>

                    <div className="cp-header-actions">
                        <div className="relative" ref={historyRef}>
                            <button
                                type="button"
                                onClick={() => setShowHistory((v) => !v)}
                                className={cn("cp-icon-btn", showHistory && "is-active")}
                                aria-expanded={showHistory}
                                aria-haspopup="listbox"
                                aria-label="Historique des conversations"
                                title="Historique"
                            >
                                <Clock className="h-4 w-4" />
                                <ChevronDown className={cn("h-3 w-3 transition-transform", showHistory && "rotate-180")} />
                            </button>

                            {showHistory && (
                                <div className="cp-history" role="listbox" aria-label="Conversations">
                                    <div className="cp-history-head">
                                        <span>Conversations</span>
                                        <button type="button" onClick={() => void createConversation()} className="cp-history-new">
                                            <MessageSquarePlus className="h-3 w-3" />
                                            Nouvelle
                                        </button>
                                    </div>
                                    <div className="cp-history-list">
                                        {isLoadingHistory && conversations.length === 0 ? (
                                            <p className="cp-history-empty">Chargement…</p>
                                        ) : conversations.length === 0 ? (
                                            <p className="cp-history-empty">Aucune conversation</p>
                                        ) : (
                                            conversations.map((conv) => (
                                                <button
                                                    key={conv.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={conv.id === activeConversationId}
                                                    onClick={() => void switchConversation(conv.id)}
                                                    className={cn("cp-history-item", conv.id === activeConversationId && "is-active")}
                                                >
                                                    <span className="cp-history-dot" aria-hidden="true" />
                                                    <span className="cp-history-body">
                                                        <span className="cp-history-title">{conv.title}</span>
                                                        <span className="cp-history-meta">
                                                            {formatRelativeTime(conv.updatedAt)} · {conv.messageCount} msg
                                                        </span>
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => void createConversation()}
                            className="cp-icon-btn"
                            aria-label="Nouvelle conversation"
                            title="Nouvelle conversation"
                        >
                            <MessageSquarePlus className="h-4 w-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => setWide((v) => !v)}
                            className="cp-icon-btn cp-only-desktop"
                            aria-label={wide ? "Réduire le panneau" : "Élargir le panneau"}
                            title={wide ? "Réduire" : "Élargir"}
                        >
                            {wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>

                        <button type="button" onClick={onClose} className="cp-icon-btn cp-close" aria-label="Fermer l'assistant">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                {/* ── Thread ─────────────────────────────────────────────── */}
                <div
                    ref={scrollerRef}
                    onScroll={handleScroll}
                    className="cp-thread"
                    role="log"
                    aria-live="polite"
                    aria-label="Conversation avec l'assistant"
                >
                    {messages.length === 0 && !isLoadingHistory && (
                        <div className="cp-welcome">
                            <span className="cp-welcome-mark">
                                <Sparkles className="h-6 w-6" />
                            </span>
                            <h3 className="cp-welcome-title">Comment puis-je vous aider&nbsp;?</h3>
                            <p className="cp-welcome-sub">
                                Interrogez vos données CRM — missions, RDV, performance, listes — ou demandez comment
                                utiliser Ping.
                            </p>
                            <div className="cp-prompts">
                                {prompts.map((prompt) => (
                                    <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} className="cp-prompt">
                                        <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-50" />
                                        <span>{prompt}</span>
                                        <ArrowUp className="cp-prompt-go h-3.5 w-3.5 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.length === 0 && isLoadingHistory && (
                        <div className="cp-loading">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Chargement de la conversation…
                        </div>
                    )}

                    {messages.map((message) => (
                        <MessageRow
                            key={message.id}
                            message={message}
                            isCopied={copiedId === message.id}
                            canRegenerate={!isSending && message.id === lastAssistantId}
                            onCopy={copyMessage}
                            onRegenerate={regenerate}
                        />
                    ))}

                    {isSending && (
                        <div className="cp-row cp-row-assistant">
                            <div className="cp-thinking">
                                <span className="cp-thinking-orb" aria-hidden="true" />
                                <span className="cp-thinking-text">Analyse de vos données</span>
                                <span className="cp-thinking-time">{formatSeconds(elapsedMs)}</span>
                            </div>
                            <div className="cp-skeleton" aria-hidden="true">
                                <span style={{ width: "92%" }} />
                                <span style={{ width: "78%" }} />
                                <span style={{ width: "56%" }} />
                            </div>
                        </div>
                    )}
                </div>

                {!atBottom && messages.length > 0 && (
                    <button type="button" onClick={() => scrollToBottom()} className="cp-jump" aria-label="Aller au dernier message">
                        <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                )}

                {/* ── Composer ───────────────────────────────────────────── */}
                <div className="cp-composer">
                    <div className="cp-composer-box">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void sendMessage();
                                }
                            }}
                            rows={1}
                            placeholder="Posez une question sur vos données…"
                            aria-label="Message à l'assistant"
                            className="cp-input"
                        />
                        <div className="cp-composer-bar">
                            <span className="cp-model">
                                <span className="cp-model-dot" aria-hidden="true" />
                                {modelLabel}
                            </span>
                            <span className="cp-hint">
                                <kbd>Entrée</kbd> envoyer · <kbd>Maj+Entrée</kbd> ligne
                            </span>
                            {isSending ? (
                                <button type="button" onClick={stop} className="cp-send is-stop" aria-label="Arrêter la génération">
                                    <Square className="h-3 w-3 fill-current" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void sendMessage()}
                                    disabled={!input.trim()}
                                    className="cp-send"
                                    aria-label="Envoyer le message"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>,
        document.body
    );
}
