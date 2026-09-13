"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { AlertTriangle, MessageSquare, X } from "lucide-react";
import { SUP_LIGHT, SupportStyles } from "./supportStyles";
import { ClientSupportPanel } from "./ClientSupportPanel";
import type { SupportConversationDetailDTO } from "@/lib/support/types";

/** Poll slowly in the background, briskly while the client is reading the thread. */
const POLL_IDLE_MS = 20_000;
const POLL_ACTIVE_MS = 6_000;
const T = SUP_LIGHT;

/** Client-only guard for createPortal, without a setState-in-effect round trip. */
const subscribeNoop = () => () => {};
const useIsMounted = () =>
    useSyncExternalStore(
        subscribeNoop,
        () => true,
        () => false,
    );

interface FabProps {
    isOpen: boolean;
    unread: number;
    onClick: () => void;
}

function SupportFab({ isOpen, unread, onClick }: FabProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={isOpen ? "Fermer le support" : "Ouvrir le support"}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: isOpen
                    ? T.paperRaised
                    : `linear-gradient(135deg, ${T.brand}, ${T.brandStrong})`,
                border: isOpen ? `1px solid ${T.line}` : "none",
                boxShadow: isOpen ? "0 8px 24px rgba(31,43,31,0.14)" : T.shadowFab,
                cursor: "pointer",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isOpen ? T.brandStrong : "#FFFFFF",
                transition: "all 300ms cubic-bezier(.34,1.56,.64,1)",
                animation: isOpen || unread > 0 ? "none" : "cpSupFabPulse 3s ease-in-out infinite",
            }}
        >
            {!isOpen && (
                <span
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: "50%",
                        border: `2px solid ${T.brand}`,
                        animation: "cpSupStatusPing 2s ease-in-out infinite",
                        opacity: 0.55,
                        pointerEvents: "none",
                    }}
                />
            )}
            {isOpen ? (
                <X size={22} strokeWidth={2.5} aria-hidden="true" />
            ) : (
                <MessageSquare size={22} strokeWidth={2} aria-hidden="true" />
            )}
            {unread > 0 && !isOpen && (
                <span
                    style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        minWidth: 20,
                        height: 20,
                        padding: "0 5px",
                        borderRadius: 999,
                        background: T.danger,
                        border: `2px solid ${T.paper}`,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "cpSupBadgePop 0.3s cubic-bezier(.34,1.56,.64,1) both",
                    }}
                    aria-label={`${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}`}
                >
                    {unread > 9 ? "9+" : unread}
                </span>
            )}
        </button>
    );
}

/**
 * Client portal support launcher + panel. Mounted once from the client layout
 * so the FAB is available on every `/client/*` route without per-page work.
 *
 * Rendered through a portal to document.body: several client-portal wrappers
 * retain a CSS transform, which would otherwise make them the containing block
 * for these position:fixed nodes and pin the FAB inside the scrolling content.
 */
export default function ClientSupportRoot() {
    const { data: session, status } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [conversation, setConversation] =
        useState<SupportConversationDetailDTO | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const mounted = useIsMounted();
    const fabRef = useRef<HTMLDivElement | null>(null);

    const canRender =
        status === "authenticated" &&
        (session?.user?.role === "CLIENT" || session?.user?.role === "COMMERCIAL");

    const fetchConversation = useCallback(
        async (): Promise<SupportConversationDetailDTO | null> => {
            try {
                const res = await fetch("/api/support/conversation");
                if (!res.ok) return null;
                const json = await res.json();
                if (!json?.success) return null;
                return json.data as SupportConversationDetailDTO;
            } catch {
                return null;
            }
        },
        [],
    );

    useEffect(() => {
        if (!canRender) return;
        let cancelled = false;
        fetchConversation().then((next) => {
            if (cancelled) return;
            if (next) setConversation(next);
            setHasFetchedOnce(true);
            setIsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [canRender, fetchConversation]);

    // Polling pauses entirely while the tab is hidden, and speeds up while the
    // panel is open so replies land without the client refreshing.
    useEffect(() => {
        if (!canRender) return;
        let intervalId: number | undefined;

        const tick = async () => {
            const next = await fetchConversation();
            if (!next) return;
            setConversation((current) => {
                if (!current) return next;
                const newer =
                    next.lastMessageAt !== null &&
                    (!current.lastMessageAt ||
                        new Date(next.lastMessageAt).getTime() >
                            new Date(current.lastMessageAt).getTime());
                return newer ? next : { ...current, unreadCount: next.unreadCount };
            });
        };

        const start = () => {
            window.clearInterval(intervalId);
            intervalId = window.setInterval(tick, isOpen ? POLL_ACTIVE_MS : POLL_IDLE_MS);
        };

        const onVisibility = () => {
            if (document.hidden) {
                window.clearInterval(intervalId);
            } else {
                void tick();
                start();
            }
        };

        if (!document.hidden) start();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [canRender, fetchConversation, isOpen]);

    const handleOpen = useCallback(async () => {
        setIsOpen(true);
        const next = await fetchConversation();
        if (next) setConversation(next);
    }, [fetchConversation]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setConversation((current) => (current ? { ...current, unreadCount: 0 } : current));
        fetch("/api/support/conversation/read", { method: "POST" }).catch(() => undefined);
        // Return focus to the launcher so keyboard users are not dropped at page top.
        requestAnimationFrame(() => {
            fabRef.current?.querySelector("button")?.focus();
        });
    }, []);

    const handleConversationUpdate = useCallback((next: SupportConversationDetailDTO) => {
        setConversation(next);
    }, []);

    if (!canRender || !mounted) return null;

    const unread = conversation?.unreadCount ?? 0;

    return createPortal(
        <>
            <SupportStyles />
            <div
                ref={fabRef}
                className="cp-support-root cp-sup-fab-wrap"
                style={{ position: "fixed", bottom: 24, right: 24, zIndex: 2147483000 }}
            >
                <SupportFab
                    isOpen={isOpen}
                    unread={unread}
                    onClick={() => (isOpen ? handleClose() : handleOpen())}
                />
            </div>

            {isOpen && conversation && (
                <ClientSupportPanel
                    conversation={conversation}
                    onClose={handleClose}
                    onConversationUpdate={handleConversationUpdate}
                />
            )}

            {isOpen && !conversation && hasFetchedOnce && !isLoading && (
                <div
                    className="cp-support-root"
                    role="alert"
                    style={{
                        position: "fixed",
                        bottom: 96,
                        right: 24,
                        zIndex: 2147482999,
                        width: 320,
                        maxWidth: "calc(100vw - 32px)",
                        padding: 16,
                        borderRadius: T.radiusM,
                        background: T.paperRaised,
                        border: `1px solid ${T.line}`,
                        color: T.ink,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        boxShadow: T.shadowPanel,
                        animation: "cpSupPanelIn 0.3s ease both",
                    }}
                >
                    <AlertTriangle size={16} style={{ color: T.danger, flexShrink: 0, marginTop: 1 }} />
                    <span>
                        Le support est indisponible pour le moment. Réessayez dans quelques
                        minutes.
                    </span>
                </div>
            )}
        </>,
        document.body,
    );
}
