"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Bell, Check, Info, AlertTriangle, XCircle, CheckCircle2,
    ChevronRight, Settings, Sparkles, Clock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

// Poll less often and only when tab is visible to reduce /api/notifications load
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (was 1 min)

interface Notification {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

const TYPE_CONFIG = {
    success: {
        icon: CheckCircle2,
        bg: "bg-emerald-50",
        iconColor: "text-emerald-500",
        dot: "bg-emerald-400",
        border: "border-emerald-100",
        glow: "shadow-emerald-100",
    },
    warning: {
        icon: AlertTriangle,
        bg: "bg-amber-50",
        iconColor: "text-amber-500",
        dot: "bg-amber-400",
        border: "border-amber-100",
        glow: "shadow-amber-100",
    },
    error: {
        icon: XCircle,
        bg: "bg-red-50",
        iconColor: "text-red-500",
        dot: "bg-red-400",
        border: "border-red-100",
        glow: "shadow-red-100",
    },
    info: {
        icon: Info,
        bg: "bg-sky-50",
        iconColor: "text-sky-500",
        dot: "bg-sky-400",
        border: "border-sky-100",
        glow: "shadow-sky-100",
    },
};

export function NotificationBell() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
    const [justMarkedAll, setJustMarkedAll] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const getNotificationsPageUrl = () => {
        const role = session?.user?.role;
        if (role === "CLIENT") return "/client/portal/notifications";
        if (role === "SDR" || role === "BUSINESS_DEVELOPER") return "/sdr/notifications";
        if (role === "MANAGER") return "/manager/notifications";
        if (role === "DEVELOPER") return "/developer/notifications";
        return "/sdr/notifications";
    };

    const loadNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications");
            const json = await res.json();
            if (json.success) {
                setNotifications(json.data.notifications);
                setUnreadCount(json.data.unreadCount);
            }
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    }, []);

    // Initial load + poll only when tab is visible (reduces requests in background tabs)
    useEffect(() => {
        loadNotifications();

        let intervalId: ReturnType<typeof setInterval> | null = null;
        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
        const startPolling = () => {
            stopPolling();
            intervalId = setInterval(loadNotifications, POLL_INTERVAL_MS);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                loadNotifications();
                startPolling();
            } else {
                stopPolling();
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        if (document.visibilityState === "visible") {
            startPolling();
        }

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            stopPolling();
        };
    }, [loadNotifications]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id: string, link: string | null) => {
        try {
            await fetch(`/api/notifications/${id}`, { method: "PATCH" });
            setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            if (link) { setIsOpen(false); router.push(link); }
        } catch (error) { console.error("Failed to mark as read", error); }
    };

    const markAllAsRead = async () => {
        try {
            await fetch("/api/notifications", { method: "PATCH" });
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            setJustMarkedAll(true);
            setTimeout(() => setJustMarkedAll(false), 2000);
        } catch (error) { console.error("Failed to mark all as read", error); }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `il y a ${diffMins}min`;
        if (diffHours < 24) return `il y a ${diffHours}h`;
        if (diffDays < 7) return `il y a ${diffDays}j`;
        return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    };

    const displayed = (activeTab === "unread"
        ? notifications.filter(n => !n.isRead)
        : notifications
    ).slice(0, 6);

    return (
        <>
            <style>{`
                @keyframes bellWiggle {
                    0%, 100% { transform: rotate(0deg); }
                    15%       { transform: rotate(12deg); }
                    30%       { transform: rotate(-10deg); }
                    45%       { transform: rotate(6deg); }
                    60%       { transform: rotate(-4deg); }
                    75%       { transform: rotate(2deg); }
                }
                @keyframes notifItemIn {
                    from { opacity:0; transform: translateX(-8px); }
                    to   { opacity:1; transform: translateX(0); }
                }
                @keyframes badgePop {
                    0%   { transform: scale(0); }
                    70%  { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
                .bell-animate { animation: bellWiggle 0.5s ease; }
            `}</style>

            <div className="relative" ref={containerRef}>
                {/* ── Bell Button ── */}
                <button
                    id="notification-bell-btn"
                    onClick={() => {
                        const next = !isOpen;
                        setIsOpen(next);
                        if (next) loadNotifications();
                    }}
                    className={cn(
                        "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                        "border focus:outline-none",
                        isOpen
                            ? "bg-[#e6f0fa] border-[#2890F8]/30 text-[#2890F8] shadow-sm"
                            : "bg-white border-slate-200 text-slate-500 hover:border-[#2890F8]/30 hover:text-[#2890F8] hover:bg-[#e6f0fa] hover:shadow-sm"
                    )}
                    aria-label="Notifications"
                >
                    <Bell className={cn("w-4 h-4 transition-transform duration-200", isOpen && "scale-90")} />

                    {/* Unread badge */}
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9px] font-black text-white leading-none"
                            style={{
                                background: "linear-gradient(135deg, #2890F8, #1a75ce)",
                                animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                                boxShadow: "0 0 0 2px white",
                            }}>
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>

                {/* ── Dropdown Panel ── */}
                {isOpen && (
                    <div className="cp-pop cp-pop-flush cp-pop-origin-tr absolute right-0 mt-2.5 w-[380px] max-w-[calc(100vw-1.5rem)]">
                        {/* ── Header ── */}
                        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-[#e6f0fa] flex items-center justify-center">
                                        <Bell className="w-3.5 h-3.5 text-[#2890F8]" />
                                    </div>
                                    <span className="font-bold text-[15px] text-slate-800">Notifications</span>
                                    {unreadCount > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#e6f0fa] text-[#2890F8]">
                                            {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {unreadCount > 0 && (
                                        <button onClick={markAllAsRead}
                                            className={cn(
                                                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200",
                                                justMarkedAll
                                                    ? "bg-emerald-100 text-emerald-600"
                                                    : "text-[#2890F8] hover:bg-[#e6f0fa]"
                                            )}>
                                            {justMarkedAll ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                                            {justMarkedAll ? "Fait !" : "Tout lire"}
                                        </button>
                                    )}
                                    <Link href="/manager/notifications"
                                        onClick={() => setIsOpen(false)}
                                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors duration-150">
                                        <Settings className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                {(["all", "unread"] as const).map((tab) => (
                                    <button key={tab} onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-150",
                                            activeTab === tab
                                                ? "bg-white text-slate-800 shadow-sm"
                                                : "text-slate-400 hover:text-slate-600"
                                        )}>
                                        {tab === "all" ? "Toutes" : (
                                            <span className="flex items-center justify-center gap-1">
                                                Non lues
                                                {unreadCount > 0 && (
                                                    <span className="w-4 h-4 rounded-full bg-red-400 text-white text-[9px] flex items-center justify-center font-black">
                                                        {unreadCount > 9 ? "9+" : unreadCount}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Notification List ── */}
                        <div className="overflow-y-auto max-h-[380px]"
                            style={{ scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}>
                            {displayed.length === 0 ? (
                                <div className="py-10 px-6 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
                                        <Bell className="w-7 h-7 text-slate-200" />
                                    </div>
                                    <p className="text-[13px] font-semibold text-slate-600 mb-1">
                                        {activeTab === "unread" ? "Tout est lu ✨" : "Aucune notification"}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {activeTab === "unread"
                                            ? "Vous avez lu toutes vos notifications."
                                            : "Revenez plus tard pour voir les mises à jour."}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    {displayed.map((n, idx) => {
                                        const cfg = TYPE_CONFIG[n.type];
                                        const Icon = cfg.icon;
                                        return (
                                            <div
                                                key={n.id}
                                                onClick={() => markAsRead(n.id, n.link)}
                                                className={cn(
                                                    "relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150 group border-b border-slate-50 last:border-0",
                                                    !n.isRead
                                                        ? "bg-violet-50/40 hover:bg-violet-50/70"
                                                        : "hover:bg-slate-50/80"
                                                )}
                                                style={{
                                                    animation: `notifItemIn 0.25s ease ${idx * 0.04}s both`,
                                                }}
                                            >
                                                {/* Unread stripe */}
                                                {!n.isRead && (
                                                    <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-violet-500" />
                                                )}

                                                {/* Icon */}
                                                <div className={cn(
                                                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border",
                                                    cfg.bg, cfg.border
                                                )}>
                                                    <Icon className={cn("w-4 h-4", cfg.iconColor)} />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={cn(
                                                            "text-[12px] leading-snug line-clamp-1",
                                                            !n.isRead ? "font-bold text-slate-800" : "font-semibold text-slate-600"
                                                        )}>
                                                            {n.title}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            {!n.isRead && (
                                                                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                                                            )}
                                                            <span className="text-[10px] text-slate-300 whitespace-nowrap">{formatDate(n.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                                                        {n.message}
                                                    </p>
                                                    {!n.isRead && (
                                                        <div className="flex items-center gap-1 mt-1.5">
                                                            <Clock className="w-2.5 h-2.5 text-slate-300" />
                                                            <span className="text-[10px] text-slate-300">{formatDate(n.createdAt)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Arrow */}
                                                {n.link && (
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-200 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Footer ── */}
                        <div className="px-4 py-3" style={{ borderTop: "1px solid #F1F5F9", background: "linear-gradient(to bottom, #FAFBFF, white)" }}>
                            <Link
                                href={getNotificationsPageUrl()}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-[12px] font-bold text-violet-600 hover:text-violet-800 hover:bg-violet-50 transition-all duration-150 group"
                            >
                                <span>Voir toutes les notifications</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
