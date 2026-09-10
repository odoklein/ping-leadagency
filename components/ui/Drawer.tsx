"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// DRAWER COMPONENT
// ============================================

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    side?: "right" | "left";
    showCloseButton?: boolean;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    className?: string;
    contentClassName?: string;
    footer?: React.ReactNode;
    /** Helper link shown above footer (e.g. "Learn more about...") */
    footerHelperLink?: { href: string; label: string };
    /** Center title in header (reference style) */
    headerCentered?: boolean;
    /** If false, drawer behaves as non-modal side panel (no full-screen blocking layer). */
    modal?: boolean;
}

const SIZES = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw]",
};

// Keep in sync with .animate-slide-out-* / .animate-fade-out in globals.css — the panel
// stays mounted for this long after isOpen flips to false so the exit animation can play.
const EXIT_ANIMATION_MS = 160;

let openModalDrawerCount = 0;
let bodyOverflowBeforeDrawers = "";

function lockBodyScroll() {
    if (openModalDrawerCount === 0) {
        bodyOverflowBeforeDrawers = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }
    openModalDrawerCount += 1;
}

function unlockBodyScroll() {
    openModalDrawerCount = Math.max(0, openModalDrawerCount - 1);
    if (openModalDrawerCount === 0) {
        document.body.style.overflow = bodyOverflowBeforeDrawers;
        bodyOverflowBeforeDrawers = "";
    }
}

export function Drawer({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = "lg",
    side = "right",
    showCloseButton = true,
    closeOnOverlay = true,
    closeOnEscape = true,
    className,
    contentClassName,
    footer,
    footerHelperLink,
    headerCentered = false,
    modal = true,
}: DrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const portalContainer = typeof document !== "undefined" ? document.body : null;
    const [isMounted, setIsMounted] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // Derive open/closing state during render rather than in an effect, so the exit
    // animation starts on the same commit that isOpen flips instead of a frame later.
    if (prevIsOpen !== isOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setIsMounted(true);
            setIsClosing(false);
        } else if (isMounted) {
            setIsClosing(true);
        }
    }

    useEffect(() => {
        if (!isClosing) return;
        const timer = window.setTimeout(() => {
            setIsMounted(false);
            setIsClosing(false);
        }, EXIT_ANIMATION_MS);
        return () => window.clearTimeout(timer);
    }, [isClosing]);

    // Handle ESC key
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape" && closeOnEscape) {
                onClose();
            }
        },
        [closeOnEscape, onClose]
    );

    // Lock body scroll while any modal drawer is open. Drawers can be nested or
    // paired, so one drawer closing must not unlock the page behind another.
    useEffect(() => {
        if (isOpen && modal) {
            returnFocusRef.current = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            lockBodyScroll();
        }

        if (isOpen && modal) document.addEventListener("keydown", handleKeyDown);

        return () => {
            if (isOpen && modal) unlockBodyScroll();
            document.removeEventListener("keydown", handleKeyDown);
            if (isOpen && modal) {
                window.requestAnimationFrame(() => returnFocusRef.current?.focus());
            }
        };
    }, [isOpen, modal, handleKeyDown]);

    // Focus trap
    useEffect(() => {
        if (isOpen && modal && portalContainer && drawerRef.current) {
            drawerRef.current.focus();
        }
    }, [isOpen, modal, portalContainer]);

    if (!isMounted || !portalContainer) return null;

    const handleOverlayClickClose = () => {
        if (closeOnOverlay) onClose();
    };

    return createPortal(
        <div className={cn("fixed inset-0 z-[80] flex", modal ? "pointer-events-auto" : "pointer-events-none")}>
            {/* Overlay */}
            {modal && (
                <div
                    className={cn(
                        "absolute inset-0 bg-black/15 backdrop-blur-[1px] cursor-pointer transition-opacity duration-300",
                        isClosing ? "animate-fade-out" : "animate-fade-in"
                    )}
                    onClick={handleOverlayClickClose}
                    aria-hidden="true"
                />
            )}

            {/* Drawer panel */}
            <div
                ref={drawerRef}
                tabIndex={-1}
                role="dialog"
                aria-modal={modal ? "true" : undefined}
                aria-label={title || "Panneau latéral"}
                className={cn(
                    "fixed top-0 bottom-0 w-full flex flex-col bg-white shadow-2xl shadow-black/10 z-[81] outline-none",
                    side === "right"
                        ? cn("right-0", isClosing ? "animate-slide-out-right" : "animate-slide-in-right")
                        : cn("left-0", isClosing ? "animate-slide-out-left" : "animate-slide-in-left"),
                    !modal && "pointer-events-auto",
                    SIZES[size],
                    className
                )}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className={cn(
                        "flex items-center px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10",
                        headerCentered ? "justify-center" : "justify-between"
                    )}>
                        {showCloseButton && !headerCentered && (
                            <div className="flex-1 min-w-0 pr-4" />
                        )}
                        {showCloseButton && headerCentered && (
                            <button
                                onClick={onClose}
                                aria-label="Fermer le panneau"
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 -m-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-150 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                        <div className={cn(
                            "flex-1 min-w-0",
                            headerCentered ? "text-center pr-10" : "pr-4"
                        )}>
                            {title && (
                                <h2 className="text-lg font-semibold text-slate-900 truncate leading-tight">
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                    {description}
                                </p>
                            )}
                        </div>
                        {showCloseButton && !headerCentered && (
                            <button
                                onClick={onClose}
                                aria-label="Fermer le panneau"
                                className="p-2 -m-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-150 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className={cn("flex-1 overflow-y-auto p-6 drawer-scrollbar", contentClassName)}>
                    {children}
                </div>

                {/* Footer helper link */}
                {footerHelperLink && (
                    <div className="px-6 pt-2 pb-1 border-t border-slate-100 bg-slate-50/30">
                        <a
                            href={footerHelperLink.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                            {footerHelperLink.label}
                        </a>
                    </div>
                )}

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        portalContainer
    );
}

// ============================================
// DRAWER SECTION (for organizing content)
// ============================================

interface DrawerSectionProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export function DrawerSection({ title, children, className }: DrawerSectionProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {title && (
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
}

// ============================================
// DRAWER FIELD (for displaying info)
// ============================================

interface DrawerFieldProps {
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export function DrawerField({ label, value, icon, className }: DrawerFieldProps) {
    return (
        <div className={cn("flex items-start gap-3", className)}>
            {icon && (
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {icon}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <div className="text-slate-900 mt-0.5">
                    {value || <span className="text-slate-400 italic">Non renseigné</span>}
                </div>
            </div>
        </div>
    );
}

export default Drawer;
