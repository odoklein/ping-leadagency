"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import AssistantPanel from "@/components/assistant/AssistantPanel";

/** Client-only guard for createPortal, without a setState-in-effect round trip. */
const subscribeNoop = () => () => {};
const useIsMounted = () =>
    useSyncExternalStore(
        subscribeNoop,
        () => true,
        () => false,
    );

/**
 * Floating "Assistant IA" launcher, mounted once per layout so it is available
 * on every route beneath it. Replaces the former support chat FAB.
 *
 * Rendered through a portal to document.body for the same reason the support
 * launcher was: several portal wrappers keep a CSS transform, which would
 * otherwise become the containing block for this position:fixed node and pin it
 * inside the scrolling content.
 */
export default function AssistantFab() {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const mounted = useIsMounted();

    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const isMeta = e.metaKey || e.ctrlKey;
            if (isMeta && e.shiftKey && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    if (status !== "authenticated" || !mounted) return null;

    return createPortal(
        <>
            <div className="cp-assistant-fab-wrap">
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className={cn("cp-assistant-fab", isOpen && "is-open")}
                    aria-label={isOpen ? "Fermer l'assistant IA" : "Ouvrir l'assistant IA"}
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    title="Assistant IA (Ctrl/Cmd+Shift+K)"
                >
                    {isOpen ? (
                        <X className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    ) : (
                        <Sparkles className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    )}
                    {/* Hidden below 640px, where the pill would crowd the viewport;
                        the icon alone still reads, and aria-label carries the name. */}
                    <span className="cp-assistant-fab-label">Assistant IA</span>
                </button>
            </div>

            <AssistantPanel
                isOpen={isOpen}
                onClose={close}
                role={session?.user?.role}
                pathname={pathname}
            />
        </>,
        document.body,
    );
}
