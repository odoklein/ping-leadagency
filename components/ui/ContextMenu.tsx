"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Edit, Trash2, Eye, Copy, Download, MoreHorizontal } from "lucide-react";

// ============================================
// TYPES
// ============================================

interface ContextMenuItem {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "danger";
    disabled?: boolean;
    divider?: boolean;
}

interface ContextMenuProps {
    items: ContextMenuItem[];
    position: { x: number; y: number } | null;
    onClose: () => void;
}

// ============================================
// CONTEXT MENU COMPONENT
// ============================================

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        if (position) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [position, onClose]);

    if (!mounted || !position) return null;

    // Calculate position to keep menu in viewport
    const menuWidth = 200;
    const menuHeight = items.length * 40;
    const adjustedX = Math.min(position.x, window.innerWidth - menuWidth - 20);
    const adjustedY = Math.min(position.y, window.innerHeight - menuHeight - 20);

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            className="cp-pop cp-pop-items fixed min-w-[184px]"
            style={{ left: adjustedX, top: adjustedY }}
        >
            {items.map((item, index) => (
                <div key={index} className="contents">
                    {item.divider && index > 0 && <div className="cp-pop-separator" />}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            if (!item.disabled) {
                                item.onClick();
                                onClose();
                            }
                        }}
                        disabled={item.disabled}
                        className={
                            item.variant === "danger"
                                ? "cp-pop-item cp-pop-item-danger"
                                : "cp-pop-item"
                        }
                    >
                        {item.icon && <span className="cp-pop-item-icon">{item.icon}</span>}
                        <span className="cp-pop-item-label">{item.label}</span>
                    </button>
                </div>
            ))}
        </div>,
        document.body
    );
}

// ============================================
// HOOK FOR CONTEXT MENU
// ============================================

export function useContextMenu() {
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [contextData, setContextData] = useState<any>(null);

    const handleContextMenu = (e: React.MouseEvent, data?: any) => {
        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setContextData(data);
    };

    const close = () => {
        setPosition(null);
        setContextData(null);
    };

    return {
        position,
        contextData,
        handleContextMenu,
        close,
    };
}
