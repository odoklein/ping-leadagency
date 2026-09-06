"use client";

import React, { useEffect, useLayoutEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    LogOut,
    ChevronsLeft,
    Menu,
    X,
    Search,
    Command,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarProvider";
import { usePermissions } from "@/lib/permissions/PermissionProvider";
import { NavSection, NavItem, ROLE_CONFIG } from "@/lib/navigation/config";
import { UserRole } from "@prisma/client";
import { formatCallbackDate } from "@/lib/utils/parseDateFromNote";
import { ManagerSupportSidebarEntry } from "@/components/support/ManagerSupportSidebarEntry";
import { ElanLogo } from "@/components/brand/ElanLogo";

interface GlobalSidebarProps {
    navigation: NavSection[];
}

function isPathActive(pathname: string, href: string): boolean {
    if (!href) return false;
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

/**
 * Sidebar tooltip, rendered into <body>.
 *
 * It cannot live inside the nav item: `.cp-sidebar` is `overflow: hidden` (it
 * has to be, so nav labels don't spill out while the width animates on
 * collapse) and `.cp-nav` is `overflow-x: hidden`. Both clip an absolutely
 * positioned child placed outside the sidebar's width, no matter its z-index —
 * which is why these tooltips were invisible. Same reasoning, and the same
 * fix, as components/ui/DropdownMenu.tsx.
 */
function NavTooltip({
    anchor,
    variant,
    children,
}: {
    anchor: HTMLElement;
    variant: "compact" | "detailed";
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        // On touch, "hover" is a tap that never un-taps, and the sidebar is an
        // overlay rather than a rail — a tooltip there would just get stuck.
        if (!window.matchMedia("(hover: hover) and (min-width: 1024px)").matches) return;

        const place = () => {
            const rect = anchor.getBoundingClientRect();
            const height = ref.current?.offsetHeight ?? 0;

            // The compact tooltip is centred on the item; the detailed one hangs
            // from just below its top edge, matching the old CSS `top: 6px`.
            const raw = variant === "compact" ? rect.top + rect.height / 2 : rect.top + 6;
            // `translateY(-50%)` moves the compact variant up by half its height,
            // so its usable bounds are offset by that much.
            const half = variant === "compact" ? height / 2 : 0;
            const min = 8 + half;
            const max = window.innerHeight - height + half - 8;

            setPos({
                left: rect.right + 8,
                top: max < min ? min : Math.min(Math.max(raw, min), max),
            });
        };

        place();
        // `.cp-nav` scrolls independently of the document, so the listener has to
        // be in the capture phase to hear scrolls on any ancestor.
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        return () => {
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
        };
    }, [anchor, variant]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            ref={ref}
            className={cn(
                "cp-tooltip-portal",
                variant === "compact" && "cp-tooltip-portal-centered"
            )}
            // Rendered but hidden until measured, so `offsetHeight` is readable
            // on the first pass and the tooltip never flashes at the wrong spot.
            style={{
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                visibility: pos ? undefined : "hidden",
            }}
        >
            {children}
        </div>,
        document.body
    );
}

function SidebarNavItem({
    item,
    isExpanded,
    onMobileClose,
    depth = 0,
}: {
    item: NavItem;
    isExpanded: boolean;
    onMobileClose?: () => void;
    depth?: number;
}) {
    const pathname = usePathname();
    const { hasPermission, isLoading } = usePermissions();

    const isHidden = !isLoading && item.permission && !hasPermission(item.permission);

    const hasChildren = Boolean(item.children?.length);
    const isActive = isPathActive(pathname, item.href);
    const isChildActive =
        hasChildren &&
        item.children!.some((c) => isPathActive(pathname, c.href));

    const shouldShowChildren = hasChildren && isExpanded;
    const [isOpen, setIsOpen] = useState(false);
    const showChildren = isOpen || isActive || isChildActive;

    // The hovered/focused link element, used as the tooltip's anchor.
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    if (isHidden) return null;

    const content = (
        <>
            <div
                className={cn(
                    "cp-nav-icon-wrap",
                    (isActive || isChildActive) && "cp-nav-icon-active"
                )}
            >
                <item.icon
                    className="w-[16px] h-[16px]"
                    strokeWidth={isActive || isChildActive ? 2 : 1.75}
                />
            </div>

            <div
                className={cn(
                    "cp-nav-label",
                    isExpanded ? "cp-nav-label-visible" : "cp-nav-label-hidden"
                )}
            >
                <span className="truncate">{item.label}</span>
            </div>

            {item.badge != null && item.badge !== "" && (
                <div
                    className={cn(
                        "cp-nav-badge",
                        isExpanded ? "" : "cp-nav-badge-collapsed"
                    )}
                >
                    {Number(item.badge) > 99 ? "99+" : item.badge}
                </div>
            )}

            {isExpanded && item.badgeDetail && (
                <span className="cp-nav-detail">{item.badgeDetail}</span>
            )}

        </>
    );

    // Which tooltip this item gets: the label when the rail is collapsed, or the
    // "what is this page for" explanation when it is expanded.
    const tooltipVariant: "compact" | "detailed" | null = !isExpanded
        ? "compact"
        : item.description
        ? "detailed"
        : null;

    const hoverProps = tooltipVariant
        ? {
              onMouseEnter: (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget),
              onMouseLeave: () => setAnchor(null),
              onFocus: (e: React.FocusEvent<HTMLElement>) => setAnchor(e.currentTarget),
              onBlur: () => setAnchor(null),
          }
        : {};

    const tooltip =
        anchor && tooltipVariant ? (
            <NavTooltip anchor={anchor} variant={tooltipVariant}>
                {tooltipVariant === "compact" ? (
                    <div className="cp-tooltip-inner">
                        {item.label}
                        {item.badge != null && item.badge !== "" && (
                            <span className="cp-tooltip-badge">{item.badge}</span>
                        )}
                    </div>
                ) : (
                    <div className="cp-tooltip-inner cp-tooltip-inner-detailed">
                        <span className="cp-tooltip-detail-title">{item.label}</span>
                        <span className="cp-tooltip-detail-desc">{item.description}</span>
                    </div>
                )}
            </NavTooltip>
        ) : null;

    const cls = cn(
        "cp-nav-item",
        isActive && "cp-nav-item-active",
        !isActive && isChildActive && "cp-nav-item-parent-active",
        depth > 0 && "cp-nav-item-child"
    );

    // Navigating away leaves no mouseleave behind, so dismiss on click too.
    const handleClick = () => {
        setAnchor(null);
        onMobileClose?.();
    };

    const renderLink = (extraClass?: string) => {
        if (item.openInNewTab) {
            return (
                <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleClick}
                    className={cn(cls, extraClass)}
                    {...hoverProps}
                >
                    {content}
                </a>
            );
        }
        return (
            <Link
                href={item.href}
                onClick={handleClick}
                className={cn(cls, extraClass)}
                {...hoverProps}
            >
                {content}
            </Link>
        );
    };

    if (!shouldShowChildren) {
        return (
            <>
                {renderLink()}
                {tooltip}
            </>
        );
    }

    // Parent with collapsible children: link + chevron toggle side-by-side.
    return (
        <>
            <div className="cp-nav-parent-row">
                {renderLink("cp-nav-parent-link")}
                <button
                    type="button"
                    aria-label={showChildren ? "Réduire" : "Développer"}
                    aria-expanded={showChildren}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOpen((v) => !v);
                    }}
                    className={cn(
                        "cp-nav-chevron",
                        showChildren && "cp-nav-chevron-open"
                    )}
                >
                    <ChevronRight className="w-3 h-3" />
                </button>
            </div>
            {tooltip}
            <div
                className={cn(
                    "cp-nav-children-wrap",
                    showChildren && "cp-nav-children-wrap-open"
                )}
                aria-hidden={!showChildren}
            >
                <div className="cp-nav-children">
                    {item.children!.map((child) => (
                        <SidebarNavItem
                            key={child.href}
                            item={child}
                            isExpanded={true}
                            onMobileClose={onMobileClose}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}

function SidebarSection({
    section,
    isExpanded,
    onMobileClose,
    isFirst,
}: {
    section: NavSection;
    isExpanded: boolean;
    onMobileClose?: () => void;
    isFirst?: boolean;
}) {
    const { hasPermission, isLoading } = usePermissions();

    const visibleItems = section.items.filter(
        (item) => !item.permission || isLoading || hasPermission(item.permission)
    );

    if (visibleItems.length === 0) return null;

    const isAdminSection = Boolean(section.dividerBefore && !section.title);

    return (
        <div className={cn("cp-nav-section", isAdminSection && "cp-nav-section-admin")}>
            {((section.dividerBefore && !isFirst) || (section.title && !isFirst)) && (
                <div className="cp-section-divider" />
            )}
            {section.title && (
                <div
                    className={cn(
                        "cp-section-title",
                        !isExpanded && "cp-section-title-collapsed"
                    )}
                >
                    {isExpanded ? (
                        <span>{section.title}</span>
                    ) : (
                        <div className="cp-section-dot" />
                    )}
                </div>
            )}

            <div className="cp-nav-items">
                {visibleItems.map((item) => (
                    <SidebarNavItem
                        key={item.href}
                        item={item}
                        isExpanded={isExpanded}
                        onMobileClose={onMobileClose}
                    />
                ))}
            </div>
        </div>
    );
}

const RAPPELS_HREF = "/sdr/callbacks";
const COMMS_HREFS = [
    "/manager/comms",
    "/sdr/comms",
    "/bd/comms",
    "/developer/comms",
    "/client/comms",
];

export function GlobalSidebar({ navigation }: GlobalSidebarProps) {
    const { data: session } = useSession();
    const {
        isCollapsed,
        isMobileOpen,
        isExpanded,
        toggleCollapsed,
        closeMobile,
        setHovering,
        openSearch,
    } = useSidebar();
    const [callbacksCount, setCallbacksCount] = useState<number | null>(null);
    const [nextCallbackDate, setNextCallbackDate] = useState<string | null>(
        null
    );
    const [commsUnreadCount, setCommsUnreadCount] = useState<number>(0);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const userRole = session?.user?.role as UserRole | undefined;
    const roleConfig = userRole ? ROLE_CONFIG[userRole] : null;

    useEffect(() => {
        let cancelled = false;
        const loadUnreadCount = async () => {
            try {
                const res = await fetch("/api/comms/inbox/stats");
                const json = await res.json();
                if (cancelled) return;
                setCommsUnreadCount((json?.totalUnread ?? 0) as number);
            } catch {
                if (!cancelled) setCommsUnreadCount(0);
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") void loadUnreadCount();
        };

        void loadUnreadCount();
        const interval = window.setInterval(loadUnreadCount, 30_000);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        if (userRole !== "SDR" && userRole !== "BUSINESS_DEVELOPER") return;
        let cancelled = false;
        (async () => {
            try {
                // For SDRs: show only callbacks from their assigned mission in the badge
                // For BDs: show all callbacks from their assigned missions
                const endpoint = userRole === "SDR" 
                    ? "/api/sdr/callbacks/count?assignedOnly=true"
                    : "/api/sdr/callbacks/count";
                const res = await fetch(endpoint);
                const json = await res.json();
                if (cancelled || !json.success) return;
                setCallbacksCount(json.count ?? 0);
                if (json.nextCallbackDate) {
                    const next = new Date(json.nextCallbackDate);
                    setNextCallbackDate(`Proch. ${formatCallbackDate(next)}`);
                } else {
                    setNextCallbackDate(null);
                }
            } catch {
                if (!cancelled) {
                    setCallbacksCount(0);
                    setNextCallbackDate(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userRole]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                userMenuRef.current &&
                !userMenuRef.current.contains(e.target as Node)
            ) {
                setShowUserMenu(false);
            }
        }
        if (showUserMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [showUserMenu]);

    const effectiveNavigation = useMemo(() => {
        const hasRappels = callbacksCount !== null || nextCallbackDate;
        const hasComms = commsUnreadCount > 0;
        if (!hasRappels && !hasComms) return navigation;
        return navigation.map((section) => ({
            ...section,
            items: section.items.map((item) => {
                if (item.href === RAPPELS_HREF && hasRappels) {
                    return {
                        ...item,
                        badge:
                            callbacksCount != null
                                ? String(callbacksCount)
                                : undefined,
                        badgeDetail: nextCallbackDate ?? undefined,
                        badgeVariant: "rappels" as const,
                    };
                }
                if (COMMS_HREFS.includes(item.href) && hasComms) {
                    return {
                        ...item,
                        badge: String(commsUnreadCount),
                        badgeVariant: "comms" as const,
                    };
                }
                return item;
            }),
        }));
    }, [navigation, callbacksCount, nextCallbackDate, commsUnreadCount]);

    const userName = session?.user?.name ?? "";
    const userEmail = session?.user?.email ?? "";
    const userInitial = userName.charAt(0).toUpperCase() || "U";

    return (
        <>
            {isMobileOpen && (
                <div
                    className="cp-overlay"
                    onClick={closeMobile}
                    aria-hidden="true"
                />
            )}

            <aside
                className={cn(
                    "cp-sidebar",
                    isCollapsed && !isHoveringState(isExpanded, isCollapsed)
                        ? "cp-sidebar-collapsed"
                        : "cp-sidebar-expanded",
                    isCollapsed &&
                        isHoveringState(isExpanded, isCollapsed) &&
                        "cp-sidebar-hover-expanded",
                    isMobileOpen
                        ? "cp-sidebar-mobile-open"
                        : "cp-sidebar-mobile-closed"
                )}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
            >
                {/* Header */}
                <div className="cp-sidebar-header">
                    <Link
                        href="/"
                        className={cn(
                            "cp-brand",
                            !isExpanded && "cp-brand-collapsed"
                        )}
                    >
                        <ElanLogo
                            compact={!isExpanded}
                            className={cn(isExpanded ? "text-[30px]" : "text-[28px]")}
                        />
                    </Link>

                    {isExpanded && (
                        <button
                            onClick={toggleCollapsed}
                            className="cp-collapse-btn"
                            aria-label="Reduire la barre laterale"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        onClick={closeMobile}
                        className="cp-mobile-close"
                        aria-label="Fermer le menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Quick Search Trigger */}
                {isExpanded ? (
                    <button
                        type="button"
                        className="cp-search-trigger"
                        onClick={openSearch}
                    >
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <span className="cp-search-text">Rechercher...</span>
                        <kbd className="cp-kbd">
                            <Command className="w-2.5 h-2.5" />K
                        </kbd>
                    </button>
                ) : (
                    <button
                        type="button"
                        className="cp-search-trigger-mini"
                        onClick={openSearch}
                        aria-label="Rechercher"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                )}

                {/* Navigation */}
                <nav className="cp-nav">
                    {effectiveNavigation.map((section, idx) => (
                        <SidebarSection
                            key={idx}
                            section={section}
                            isExpanded={isExpanded}
                            onMobileClose={closeMobile}
                            isFirst={idx === 0}
                        />
                    ))}
                </nav>

                {/* Footer */}
                <div className="cp-sidebar-footer" ref={userMenuRef}>
                    {/* Manager-only support entry (sits above the profile) */}
                    {userRole === "MANAGER" && (
                        <ManagerSupportSidebarEntry isExpanded={isExpanded} />
                    )}

                    {/* Collapse toggle (when expanded, shows at bottom) */}
                    {!isExpanded && (
                        <button
                            onClick={toggleCollapsed}
                            className="cp-expand-btn"
                            aria-label="Agrandir la barre laterale"
                        >
                            <ChevronsLeft className="w-4 h-4 rotate-180" />
                        </button>
                    )}

                    {/* User popover menu */}
                    {showUserMenu && (
                        <div className="cp-user-menu">
                            <div className="cp-user-menu-header">
                                <p className="text-[13px] font-semibold text-slate-900 truncate">
                                    {userName}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                    {userEmail}
                                </p>
                            </div>
                            <div className="cp-user-menu-divider" />
                            <div className="cp-user-menu-items">
                                {roleConfig && (
                                    <div className="cp-user-menu-role">
                                        <div className="w-2 h-2 rounded-[2px] bg-[#FF9E1B]" />
                                        <span>{roleConfig.label}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() =>
                                        signOut({ callbackUrl: "/login" })
                                    }
                                    className="cp-user-menu-item cp-user-menu-item-danger"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Deconnexion</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* User button */}
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className={cn(
                            "cp-user-btn",
                            !isExpanded && "cp-user-btn-collapsed"
                        )}
                    >
                        <div className="cp-avatar">
                            <span>{userInitial}</span>
                            <div className="cp-avatar-status" />
                        </div>
                        {isExpanded && (
                            <div className="cp-user-info">
                                <p className="cp-user-name">{userName}</p>
                                <p className="cp-user-role">
                                    {roleConfig?.label ?? "User"}
                                </p>
                            </div>
                        )}
                        {isExpanded && (
                            <ChevronRight
                                className={cn(
                                    "w-3.5 h-3.5 text-slate-400 transition-transform duration-200",
                                    showUserMenu && "rotate-90"
                                )}
                            />
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
}

function isHoveringState(
    isExpanded: boolean,
    isCollapsed: boolean
): boolean {
    return isExpanded && isCollapsed;
}

export function MobileMenuButton() {
    const { toggleMobile } = useSidebar();

    return (
        <button
            onClick={toggleMobile}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Menu"
        >
            <Menu className="w-5 h-5" />
        </button>
    );
}

export default GlobalSidebar;
