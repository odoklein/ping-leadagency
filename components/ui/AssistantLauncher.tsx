"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import AssistantPanel from "@/components/assistant/AssistantPanel";

export function AssistantLauncher() {
    const [isOpen, setIsOpen] = useState(false);
    const { data: session } = useSession();
    const pathname = usePathname();

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

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={cn(
                    "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                    "border border-slate-200 bg-white text-slate-500",
                    "hover:border-[#2890F8]/40 hover:text-[#2890F8] hover:bg-[#e6f0fa] hover:shadow-md hover:scale-105",
                    "active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2890F8]/40 focus-visible:ring-offset-2",
                    isOpen && "border-[#2890F8] text-[#2890F8] bg-[#e6f0fa] shadow-sm"
                )}
                title="Assistant CRM (Ctrl/Cmd+Shift+K)"
                aria-label="Ouvrir l'assistant CRM (Ctrl+Shift+K)"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                <MessageCircle className="w-4 h-4" />
                {/* Active indicator dot */}
                <span className={cn(
                    "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#2890F8] border border-white transition-all duration-300",
                    isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0"
                )} />
            </button>

            <AssistantPanel
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                role={session?.user?.role}
                pathname={pathname}
            />
        </>
    );
}

export default AssistantLauncher;
