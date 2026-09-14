"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ============================================
// PROFILE MENU
// Sidebar footer identity block: a two-line trigger (name + role) with the
// avatar, and a popover listing account actions.
//
// The popover portals to <body> for the same reason NavTooltip does in
// GlobalSidebar: `.cp-sidebar` is `overflow: hidden` so the rail can animate
// its width without nav labels spilling out. An in-flow popover survives that
// while the rail is open, but collapses to the 56px rail width once it isn't.
// ============================================

export interface ProfileMenuItem {
    label: string;
    /** Right-aligned badge, e.g. the role name. */
    value?: string;
    /** `accent` paints the badge in brand blue; `neutral` keeps it quiet. */
    valueTone?: "accent" | "neutral";
    icon?: React.ReactNode;
    href?: string;
    onClick?: () => void;
    /** Danger items are pulled below a separator and painted red. */
    variant?: "default" | "danger";
}

interface ProfileMenuProps {
    name: string;
    email: string;
    /** Secondary line under the name on the trigger (usually the role label). */
    role?: string;
    items: ProfileMenuItem[];
    /** False while the sidebar shows as a narrow rail — avatar only. */
    isExpanded: boolean;
    /** Hides the green presence dot when the user is not connected. */
    isOnline?: boolean;
    className?: string;
}

const MENU_WIDTH = 268;
const GAP = 8;

/** The brand bend — mirrors open/closed instead of spinning like a chevron. */
function BendIndicator({ isOpen }: { isOpen: boolean }) {
    return (
        <svg
            width="12"
            height="24"
            viewBox="0 0 12 24"
            fill="none"
            className={cn("cp-profile-bend", isOpen && "cp-profile-bend-open")}
            aria-hidden="true"
        >
            <path
                d="M2 4C6 8 6 16 2 20"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    );
}

function initialsOf(name: string, email: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return email.charAt(0).toUpperCase() || "U";
}

export function ProfileMenu({
    name,
    email,
    role,
    items,
    isExpanded,
    isOnline = true,
    className,
}: ProfileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const initials = initialsOf(name, email);
    const primary = items.filter((item) => item.variant !== "danger");
    const danger = items.filter((item) => item.variant === "danger");

    const place = useCallback(() => {
        const anchor = triggerRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const height = menuRef.current?.offsetHeight ?? 0;

        // Anchored above the trigger — it sits at the bottom of the sidebar.
        // Only flip below when there genuinely isn't room above.
        const above = rect.top - GAP - height;
        const top = above >= GAP ? above : Math.min(rect.bottom + GAP, window.innerHeight - height - GAP);

        setPos({
            top: Math.max(GAP, top),
            left: Math.max(GAP, Math.min(rect.left, window.innerWidth - MENU_WIDTH - GAP)),
        });
    }, []);

    // Runs before paint, so a reopen re-measures over the previous position
    // without ever showing it. `pos` is deliberately not cleared on close —
    // the menu unmounts, and stale coordinates are overwritten right here.
    useLayoutEffect(() => {
        if (isOpen) place();
    }, [isOpen, place]);

    useEffect(() => {
        if (!isOpen) return;

        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        const onReflow = () => place();

        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", onReflow, true);
        window.addEventListener("resize", onReflow);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onReflow, true);
            window.removeEventListener("resize", onReflow);
        };
    }, [isOpen, place]);

    const renderItem = (item: ProfileMenuItem) => {
        const inner = (
            <>
                {item.icon && <span className="cp-pop-item-icon">{item.icon}</span>}
                <span className="cp-pop-item-label">{item.label}</span>
                {item.value && (
                    <span
                        className={cn(
                            "cp-pop-badge",
                            item.valueTone === "neutral"
                                ? "cp-pop-badge-neutral"
                                : "cp-pop-badge-accent"
                        )}
                    >
                        {item.value}
                    </span>
                )}
            </>
        );

        const itemClass = cn(
            "cp-pop-item",
            item.variant === "danger" && "cp-pop-item-danger"
        );

        if (item.href) {
            return (
                <Link
                    key={item.label}
                    href={item.href}
                    role="menuitem"
                    className={itemClass}
                    onClick={() => setIsOpen(false)}
                >
                    {inner}
                </Link>
            );
        }

        return (
            <button
                key={item.label}
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                    setIsOpen(false);
                    item.onClick?.();
                }}
            >
                {inner}
            </button>
        );
    };

    return (
        <div className={cn("cp-profile", className)}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={isExpanded ? undefined : `Compte de ${name}`}
                className={cn(
                    "cp-profile-trigger",
                    !isExpanded && "cp-profile-trigger-collapsed",
                    isOpen && "cp-profile-trigger-open"
                )}
            >
                <span className="cp-profile-avatar">
                    {initials}
                    {isOnline && <span className="cp-profile-presence" />}
                </span>

                {isExpanded && (
                    <>
                        <span className="cp-profile-identity">
                            <span className="cp-profile-name">{name}</span>
                            {role && <span className="cp-profile-role">{role}</span>}
                        </span>
                        <BendIndicator isOpen={isOpen} />
                    </>
                )}
            </button>

            {isOpen &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        aria-label="Menu du compte"
                        className="cp-pop cp-pop-rise"
                        style={{
                            position: "fixed",
                            width: MENU_WIDTH,
                            // Kept off-screen for the first paint so `place()`
                            // can measure the real height before showing it.
                            top: pos?.top ?? -9999,
                            left: pos?.left ?? -9999,
                            visibility: pos ? "visible" : "hidden",
                        }}
                    >
                        <div className="cp-pop-header">
                            <span className="cp-profile-avatar cp-profile-avatar-lg">{initials}</span>
                            <span className="cp-profile-menu-identity">
                                <span className="cp-pop-title">{name}</span>
                                <span className="cp-pop-sub">{email}</span>
                            </span>
                        </div>

                        {primary.length > 0 && (
                            <div className="cp-pop-items">{primary.map(renderItem)}</div>
                        )}

                        {danger.length > 0 && (
                            <>
                                <div className="cp-pop-separator" />
                                <div className="cp-pop-items">{danger.map(renderItem)}</div>
                            </>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
}

export default ProfileMenu;
