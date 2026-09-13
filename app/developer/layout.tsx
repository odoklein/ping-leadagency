"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import {
    LayoutDashboard,
    FolderKanban,
    CheckSquare,
    Mail,
    Network,
    Settings,
    LogOut,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { AssistantLauncher } from "@/components/ui/AssistantLauncher";
import { ElanLogo } from "@/components/brand/ElanLogo";

const NAV_ITEMS = [
    { href: "/developer/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/developer/projects", icon: FolderKanban, label: "Projets" },
    { href: "/developer/tasks", icon: CheckSquare, label: "Tâches" },
    { href: "/developer/integrations", icon: Mail, label: "Intégrations" },
    { href: "/developer/system", icon: Network, label: "Système" },
    { href: "/developer/settings", icon: Settings, label: "Paramètres" },
];

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (status === "loading") return;
        if (status === "unauthenticated") {
            router.push("/login");
        } else if (status === "authenticated" && session?.user?.role !== "DEVELOPER") {
            router.push("/unauthorized");
        }
    }, [session, status, router]);

    if (status === "loading" || !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-[var(--elan-amber)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Chargement...</p>
                </div>
            </div>
        );
    }

    if (session?.user?.role !== "DEVELOPER") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8]">
                <div className="w-10 h-10 border-3 border-[var(--elan-amber)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f8f8] flex">
            {/* Premium Sidebar */}
            <aside className="w-64 bg-[#080808] flex flex-col shadow-xl border-r border-white/5">
                {/* Premium Brand Header */}
                <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <ElanLogo className="text-[28px]" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-[var(--elan-amber)] px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                            Dev
                        </span>
                    </div>
                </div>

                {/* Premium Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto dev-scrollbar">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "dev-nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "active text-[var(--elan-amber)] bg-[var(--elan-amber)]/10"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn(
                                    "w-5 h-5 transition-transform duration-200",
                                    isActive && "scale-110"
                                )} />
                                <span className="flex-1">{item.label}</span>
                                {isActive && (
                                    <ChevronRight className="w-4 h-4 text-[var(--elan-amber)]/70" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Premium User Section */}
                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/5 mb-3">
                        <div className="relative">
                            <div className="dev-avatar w-10 h-10 bg-[var(--elan-amber)] text-white font-bold text-sm flex items-center justify-center rounded-lg">
                                {session?.user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {session?.user?.name}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{session?.user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
                    >
                        <LogOut className="w-4 h-4" />
                        Déconnexion
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto flex flex-col">
                {/* Premium Header */}
                <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/80 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="font-medium text-slate-900">Développeur</span>
                        <span>/</span>
                        <span className="capitalize">{pathname.split("/").pop()?.replace("-", " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <AssistantLauncher />
                        <NotificationBell />
                    </div>
                </header>
                <div className="max-w-6xl mx-auto p-6 w-full">{children}</div>
            </main>
        </div>
    );
}
