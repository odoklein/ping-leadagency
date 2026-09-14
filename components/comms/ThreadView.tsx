"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
    X,
    ArrowLeft,
    MoreVertical,
    CheckCircle,
    Archive,
    Send,
    Paperclip,
    Loader2,
    CheckCheck,
    Maximize2,
    Minimize2,
    ArrowDown,
    RotateCcw,
} from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { MessageContent } from "./MessageContent";
import { MessageAttachments } from "./MessageAttachments";
import { MessageReactions } from "./MessageReactions";
import { ThreadSummary } from "./ThreadSummary";
import { SuggestionChips } from "./SuggestionChips";
import { TemplatePicker } from "./TemplatePicker";
import type { CommsThreadView, CommsMessageView } from "@/lib/comms/types";

interface ThreadViewProps {
    thread: CommsThreadView;
    onClose: () => void;
    onStatusChange: (status: "OPEN" | "RESOLVED" | "ARCHIVED") => void;
    onSendMessage: (
        content: string,
        opts?: { mentionIds?: string[]; files?: File[] }
    ) => Promise<boolean | void>;
    onReactionToggle?: (messageId: string, emoji: string) => Promise<void>;
    currentUserId: string;
    typingUserName?: string;
    /** When true, parent should hide page header/stats and collapse list for near full-screen chat */
    focusMode?: boolean;
    onFocusModeChange?: (active: boolean) => void;
    isRecipientOnline?: boolean;
    onTyping?: (isTyping: boolean) => void;
}

export function ThreadView({
    thread,
    onClose,
    onStatusChange,
    onSendMessage,
    onReactionToggle,
    currentUserId,
    typingUserName,
    focusMode,
    onFocusModeChange,
    isRecipientOnline,
    onTyping,
}: ThreadViewProps) {
    const [messageContent, setMessageContent] = useState(() => {
        if (typeof window === "undefined") return "";
        return window.sessionStorage.getItem(`comms-draft:${thread.id}`) ?? "";
    });
    const [mentionIds, setMentionIds] = useState<string[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);
    const previousMessageCountRef = useRef(0);
    const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const mentionOptions = thread.participants.map((p) => ({
        id: p.userId,
        name: p.userName,
    }));

    const notifyTyping = useCallback(
        (isTyping: boolean) => {
            if (!onTyping) return;

            if (typingDebounceRef.current) {
                clearTimeout(typingDebounceRef.current);
                typingDebounceRef.current = null;
            }
            if (typingStopRef.current) {
                clearTimeout(typingStopRef.current);
                typingStopRef.current = null;
            }
            if (isTyping) {
                typingDebounceRef.current = setTimeout(() => {
                    typingDebounceRef.current = null;
                    onTyping(true);
                    typingStopRef.current = setTimeout(() => {
                        typingStopRef.current = null;
                        onTyping(false);
                    }, 2500);
                }, 300);
            } else {
                onTyping(false);
            }
        },
        [onTyping]
    );

    useEffect(() => {
        return () => {
            if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
            if (typingStopRef.current) clearTimeout(typingStopRef.current);
            if (onTyping) onTyping(false);
        };
    }, [thread.id, onTyping]);

    useEffect(() => {
        if (messageContent.trim()) {
            window.sessionStorage.setItem(`comms-draft:${thread.id}`, messageContent);
        } else {
            window.sessionStorage.removeItem(`comms-draft:${thread.id}`);
        }
    }, [messageContent, thread.id]);

    const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTo({ top: container.scrollHeight, behavior });
        isNearBottomRef.current = true;
        setShowJumpToLatest(false);
    }, []);

    useEffect(() => {
        const previousCount = previousMessageCountRef.current;
        const nextCount = thread.messages.length;
        const latestMessage = thread.messages[nextCount - 1];
        let frame: number | undefined;

        if (previousCount === 0) {
            frame = requestAnimationFrame(() => scrollToLatest("auto"));
        } else if (nextCount > previousCount) {
            if (isNearBottomRef.current || latestMessage?.author.id === currentUserId) {
                frame = requestAnimationFrame(() => scrollToLatest("smooth"));
            } else {
                setShowJumpToLatest(true);
            }
        }

        previousMessageCountRef.current = nextCount;
        return () => {
            if (frame !== undefined) cancelAnimationFrame(frame);
        };
    }, [thread.messages, currentUserId, scrollToLatest]);

    const handleSend = async () => {
        const trimmed = messageContent.trim();
        if ((!trimmed && files.length === 0) || isSending) return;

        notifyTyping(false);
        setIsSending(true);
        try {
            const sent = await onSendMessage(trimmed, {
                mentionIds: mentionIds.length > 0 ? mentionIds : undefined,
                files: files.length > 0 ? files : undefined,
            });
            if (sent !== false) {
                setMessageContent("");
                setMentionIds([]);
                setFiles([]);
                window.sessionStorage.removeItem(`comms-draft:${thread.id}`);
            }
        } finally {
            setIsSending(false);
        }
    };

    // Helper to get display title for thread
    const getThreadTitle = () => {
        if (thread.channelType === "DIRECT") {
            const otherParticipant = thread.participants.find(p => p.userId !== currentUserId);
            if (otherParticipant) {
                return otherParticipant.userName;
            }
            if (thread.subject.startsWith("Message avec ")) {
                return thread.subject.replace("Message avec ", "");
            }
        }
        return thread.subject;
    };

    const threadTitle = getThreadTitle();

    return (
        <div className="flex h-full w-full min-w-0 flex-col rounded-xl bg-white shadow-[0_1px_2px_rgba(12,59,56,0.04)] dark:bg-[#151c2a]">
            <header className="h-14 border-b border-[#EFEEE9] dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-[#151c2a] z-10 shrink-0 rounded-t-xl">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C3B38]/25 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
                        aria-label="Retour aux discussions"
                    >
                        <ArrowLeft className="size-4" />
                    </button>
                    <div className="size-8 rounded-full bg-[#0C3B38] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {threadTitle.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[#12122A] dark:text-white truncate text-[13px]">{threadTitle}</h3>
                            {isRecipientOnline && (
                                <span className="relative flex h-2 w-2 items-center justify-center shrink-0" title="En ligne">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-[#8B8BA7] truncate">
                            {thread.participants.length > 2
                                ? `${thread.participants.length} participants`
                                : isRecipientOnline
                                    ? "En ligne"
                                    : thread.channelType === "DIRECT"
                                        ? "Hors ligne"
                                        : thread.channelName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                    {onFocusModeChange && (
                        <button
                            type="button"
                            onClick={() => onFocusModeChange(!focusMode)}
                            className={cn(
                                "p-2 rounded-lg transition-all duration-200",
                                focusMode
                                    ? "text-[#0C3B38] bg-[#0C3B38]/10"
                                    : "text-slate-400 hover:text-[#0C3B38] hover:bg-[#0C3B38]/5"
                            )}
                            title={focusMode ? "Quitter le mode focus" : "Ouvrir le mode focus"}
                            aria-label={focusMode ? "Quitter le mode focus" : "Ouvrir le mode focus"}
                        >
                            {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowMenu(!showMenu)}
                            className={cn(
                                "p-2 rounded-lg transition-all duration-200",
                                showMenu
                                    ? "bg-slate-100 dark:bg-slate-800 text-[#12122A] dark:text-slate-300"
                                    : "text-slate-400 hover:text-[#12122A] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                            aria-label="Actions de la discussion"
                            aria-expanded={showMenu}
                            aria-haspopup="menu"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>
                        {showMenu && (
                            <>
                                <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setShowMenu(false)} aria-label="Fermer le menu" />
                                <div className="cp-pop cp-pop-items cp-pop-origin-tr absolute right-0 top-full mt-1.5 w-56" role="menu">
                                    {thread.status === "OPEN" ? (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => { onStatusChange("RESOLVED"); setShowMenu(false); }}
                                            className="cp-pop-item"
                                        >
                                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                                            <span>Marquer comme résolue</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => { onStatusChange("OPEN"); setShowMenu(false); }}
                                            className="cp-pop-item"
                                        >
                                            <RotateCcw className="w-4 h-4 text-emerald-600" />
                                            <span>Rouvrir la discussion</span>
                                        </button>
                                    )}
                                    {thread.status !== "ARCHIVED" && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => { onStatusChange("ARCHIVED"); setShowMenu(false); }}
                                            className="cp-pop-item"
                                        >
                                            <Archive className="w-4 h-4 text-[#8B8BA7]" />
                                            <span>Archiver</span>
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <button type="button" onClick={onClose} className="hidden p-2 text-slate-400 hover:text-[#12122A] dark:hover:text-white hover:bg-slate-50 rounded-lg transition-all duration-200 md:inline-flex" aria-label="Fermer la discussion" title="Fermer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {typingUserName && (
                <div className="flex items-center gap-2 px-5 py-2 bg-[#F4F0E8]/50 dark:bg-slate-800/50 border-b border-[#ECE5D8]/60 dark:border-slate-800" role="status" aria-live="polite">
                    <div className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 bg-[#0C3B38] rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#0C3B38] rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#0C3B38] rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: "300ms" }} />
                    </div>
                    <p className="text-[12px] text-[#0C3B38] dark:text-emerald-400 font-semibold">{typingUserName} écrit…</p>
                </div>
            )}

            {thread.messages.length >= 5 && <ThreadSummary threadId={thread.id} />}

            <div className="relative flex-1 min-h-0 bg-[#FCFCFA] dark:bg-slate-900/50">
            <div
                ref={messagesContainerRef}
                onScroll={(event) => {
                    const element = event.currentTarget;
                    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
                    const isNearBottom = distanceFromBottom < 96;
                    isNearBottomRef.current = isNearBottom;
                    if (isNearBottom && showJumpToLatest) setShowJumpToLatest(false);
                }}
                className="h-full overflow-y-auto px-4 py-6 space-y-1 sm:px-10 lg:px-16"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#D4D0C8 transparent" }}
                aria-live="polite"
            >
                {thread.messages.length > 0 && (
                    <div className="flex justify-center py-2">
                        <span className="text-[11px] font-semibold text-[#8B8BA7] bg-[#ECE5D8]/60 dark:bg-slate-800 px-3 py-1 rounded-full">
                            {format(new Date(thread.messages[0].createdAt), "EEEE d MMMM", { locale: fr })}
                        </span>
                    </div>
                )}
                {thread.messages.map((message, index) => {
                    const isOwn = message.author.id === currentUserId;
                    const prevMessage = index > 0 ? thread.messages[index - 1] : null;
                    const sameAuthor = !!(prevMessage && prevMessage.author.id === message.author.id);
                    const showAvatar = !sameAuthor;
                    const currentDate = new Date(message.createdAt).toDateString();
                    const prevDate = prevMessage ? new Date(prevMessage.createdAt).toDateString() : null;
                    const showDateSeparator = prevDate && currentDate !== prevDate;

                    return (
                        <div key={message.id}>
                            {showDateSeparator && (
                                <div className="flex justify-center py-3">
                                    <span className="text-[11px] font-semibold text-[#8B8BA7] bg-[#ECE5D8]/60 dark:bg-slate-800 px-3 py-1 rounded-full">
                                        {format(new Date(message.createdAt), "EEEE d MMMM", { locale: fr })}
                                    </span>
                                </div>
                            )}
                            <MessageBubble
                                message={message}
                                isOwn={isOwn}
                                showAvatar={showAvatar}
                                sameAuthor={sameAuthor}
                                currentUserId={currentUserId}
                                onReactionToggle={onReactionToggle}
                            />
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            {showJumpToLatest && (
                <button
                    type="button"
                    onClick={() => scrollToLatest()}
                    className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0C3B38] shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C3B38]/25 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-300"
                >
                    <ArrowDown className="size-3.5" /> Nouveaux messages
                </button>
            )}
            </div>

            {thread.status === "OPEN" && !thread.isBroadcast && (
                <div className="px-4 pb-4 pt-3 bg-white dark:bg-[#151c2a] border-t border-[#EFEEE9] dark:border-slate-800 shrink-0 rounded-b-xl">
                    <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
                        {!messageContent && thread.messages.length > 0 && (
                            <div className="flex gap-2 mb-1">
                                <SuggestionChips threadId={thread.id} onSelect={setMessageContent} />
                                <TemplatePicker onSelect={setMessageContent} />
                            </div>
                        )}
                        <MessageAttachments files={files} onChange={setFiles} disabled={isSending} />
                        <div className="relative bg-white dark:bg-slate-900 border border-[#DCDDD6] dark:border-slate-700 rounded-[10px] focus-within:ring-2 focus-within:ring-[#0C3B38]/10 focus-within:border-[#0C3B38]/40 transition-all duration-200">
                            <RichTextEditor
                                value={messageContent}
                                onChange={(v, ids) => {
                                    setMessageContent(v);
                                    setMentionIds(ids);
                                    if (thread.status === "OPEN" && !thread.isBroadcast) notifyTyping(true);
                                }}
                                onBlur={() => notifyTyping(false)}
                                onSubmit={handleSend}
                                placeholder="Écrire un message... @mention pour notifier"
                                disabled={isSending}
                                mentionOptions={mentionOptions}
                                minRows={1}
                                maxRows={5}
                            />
                            <div className="flex justify-between items-center px-3 pb-1.5 pt-1 border-t border-[#F0EFEA] dark:border-slate-800">
                                <div className="flex items-center gap-2 text-[11px] text-[#8B8BA7]">
                                    <span className="hidden sm:inline">Visible par tous les participants</span>
                                    <span className="hidden md:inline text-slate-300">⌘ Entrée</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={(!messageContent.trim() && files.length === 0) || isSending}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C3B38]/30 focus-visible:ring-offset-2 active:translate-y-px",
                                            (messageContent.trim() || files.length > 0)
                                                ? "bg-[#0C3B38] hover:bg-[#0A322F] text-white shadow-[#0C3B38]/20"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                        )}
                                    >
                                        {isSending ? (
                                            <><Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" /> Envoi...</>
                                        ) : (
                                            <>Envoyer <Send className="w-3.5 h-3.5" /></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {thread.status !== "OPEN" && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {thread.status === "RESOLVED" ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Archive className="w-5 h-5 text-slate-400" />}
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Cette discussion est {thread.status === "RESOLVED" ? "résolue" : "archivée"}
                        </span>
                        <button
                            type="button"
                            onClick={() => onStatusChange("OPEN")}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0C3B38] transition-colors hover:bg-[#0C3B38]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C3B38]/25 dark:text-emerald-300"
                        >
                            <RotateCcw className="size-3.5" /> Rouvrir
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function MessageBubble({
    message,
    isOwn,
    showAvatar,
    sameAuthor,
    currentUserId,
    onReactionToggle,
}: {
    message: CommsMessageView;
    isOwn: boolean;
    showAvatar: boolean;
    sameAuthor: boolean;
    currentUserId: string;
    onReactionToggle?: (messageId: string, emoji: string) => Promise<void>;
}) {
    if (message.type === "SYSTEM") {
        return (
            <div className="flex justify-center py-2">
                <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">
                    {message.content}
                </span>
            </div>
        );
    }

    const hasReadReceipt = isOwn && message.readBy && message.readBy.length > 0;

    return (
        <div className={cn("flex gap-2.5 group", sameAuthor && "mt-0.5", isOwn ? "flex-row-reverse" : "flex-row")}>
            {showAvatar ? (
                <div className={cn("size-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 shadow-sm", isOwn ? "bg-gradient-to-br from-[#0C3B38] to-[#25745f] text-white" : "bg-gradient-to-br from-[#ECE5D8] to-[#DBE4DF] text-[#3A3A5A]")}>
                    {message.author.initials}
                </div>
            ) : <div className="size-7 flex-shrink-0 w-[26px]" />}

            <div className={cn("flex flex-col gap-0.5 max-w-[min(78%,680px)]", isOwn && "items-end")}>
                {showAvatar && (
                    <div className={cn("flex items-baseline gap-1.5 px-0.5", isOwn && "flex-row-reverse")}>
                        <span className="text-[12px] font-bold text-[#12122A] dark:text-white">{isOwn ? "Vous" : message.author.name}</span>
                        <span className="text-[11px] text-[#8B8BA7] flex items-center gap-0.5">
                            {format(new Date(message.createdAt), "HH:mm", { locale: fr })}
                            {(message as { isOptimistic?: boolean }).isOptimistic && (
                                <span className="flex items-center gap-0.5 text-[#0C3B38]"><Loader2 className="w-2.5 h-2.5 animate-spin" /> Envoi…</span>
                            )}
                        </span>
                    </div>
                )}
                <div className={cn(
                    "px-3 py-2 text-[12px] leading-relaxed",
                    (message as { isOptimistic?: boolean }).isOptimistic && "opacity-80",
                    isOwn
                        ? "bg-[#0C3B38] text-white rounded-[10px] rounded-tr-md"
                        : "bg-white dark:bg-slate-800 border border-[#EAE9E3] dark:border-slate-700 text-[#12122A] dark:text-slate-200 rounded-[10px] rounded-tl-md"
                )}>
                    <MessageContent content={message.content} isOwn={isOwn} className={isOwn ? "text-white" : ""} />
                    {message.isEdited && <span className={cn("text-[10px] ml-2", isOwn ? "text-white/50" : "text-[#8B8BA7]")}>(modifié)</span>}
                </div>
                {hasReadReceipt && (
                    <span className="text-[11px] font-medium text-[#8B8BA7] flex items-center gap-1">Lu <CheckCheck className="w-3.5 h-3.5" /></span>
                )}
                {message.type === "TEXT" && !(message as { isOptimistic?: boolean }).isOptimistic && (
                    <MessageReactions
                        messageId={message.id}
                        reactions={message.reactions ?? []}
                        currentUserId={currentUserId}
                        onToggle={(msgId, emoji) => onReactionToggle?.(msgId, emoji) ?? Promise.resolve()}
                        className={cn(
                            "transition-opacity",
                            (message.reactions?.length ?? 0) === 0 && "opacity-50 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                        )}
                    />
                )}
                {message.attachments.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                        {message.attachments.map((att) => (
                            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 text-[12px] font-medium px-3 py-2 rounded-lg transition-all duration-200", isOwn ? "bg-white/15 text-white/90 hover:bg-white/25" : "bg-[#F4F0E8] text-[#3A3A5A] hover:bg-[#ECE5D8]")}>
                                <Paperclip className="w-3.5 h-3.5" /> {att.filename}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const MemoizedThreadView = memo(ThreadView);
export default MemoizedThreadView;
