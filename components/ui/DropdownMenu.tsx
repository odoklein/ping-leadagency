"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// ============================================
// DROPDOWN MENU
// Button-anchored menu that portals to <body> so it is never clipped by
// overflow-hidden ancestors or trapped under a lower stacking context.
// ============================================

export interface DropdownMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "danger";
    disabled?: boolean;
    /** Render a divider above this item */
    divider?: boolean;
}

interface DropdownMenuProps {
    /** The clickable trigger (usually an icon button). */
    trigger: React.ReactNode;
    items: DropdownMenuItem[];
    align?: "left" | "right";
    /** Menu width in px (default 176). */
    width?: number;
    className?: string;
}

export function DropdownMenu({ trigger, items, align = "right", width = 176, className }: DropdownMenuProps) {
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const updateRect = useCallback(() => {
        if (!triggerRef.current) return setRect(null);
        const r = triggerRef.current.getBoundingClientRect();
        const left = align === "right" ? r.right - width : r.left;
        setRect({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    }, [align, width]);

    useLayoutEffect(() => {
        if (open) updateRect();
        else setRect(null);
    }, [open, updateRect]);

    useEffect(() => {
        if (!open) return;
        const onScrollResize = () => updateRect();
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t)) return;
            if (menuRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("scroll", onScrollResize, true);
        window.addEventListener("resize", onScrollResize);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onEsc);
        return () => {
            window.removeEventListener("scroll", onScrollResize, true);
            window.removeEventListener("resize", onScrollResize);
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onEsc);
        };
    }, [open, updateRect]);

    return (
        <span ref={triggerRef} className={cn("relative inline-flex", className)}>
            <span
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
            >
                {trigger}
            </span>
            {open && rect && typeof document !== "undefined" && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    className="cp-pop cp-pop-items"
                    style={{ position: "fixed", top: rect.top, left: rect.left, width }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                    {items.map((item, i) => (
                        <div key={i} className="contents">
                            {item.divider && i > 0 && <div className="cp-pop-separator" />}
                            <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (item.disabled) return;
                                    item.onClick();
                                    setOpen(false);
                                }}
                                disabled={item.disabled}
                                className={cn(
                                    "cp-pop-item",
                                    item.variant === "danger" && "cp-pop-item-danger"
                                )}
                            >
                                {item.icon && <span className="cp-pop-item-icon">{item.icon}</span>}
                                <span className="cp-pop-item-label">{item.label}</span>
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </span>
    );
}

export default DropdownMenu;
