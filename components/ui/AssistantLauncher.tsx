"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import AssistantPanel from "@/components/assistant/AssistantPanel";

/**
 * Top-bar entry point for the AI assistant.
 * Sits next to the other topbar controls and matches their 32px sizing.
 */
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
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[12px] font-semibold transition-colors duration-150 sm:px-2.5",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2890F8]/40 focus-visible:ring-offset-1",
                    isOpen
                        ? "border-[#2890F8] bg-[#E8F2FE] text-[#1A75CE]"
                        : "border-[#E8EBF0] bg-white text-[#5A5A7A] hover:border-[#2890F8]/45 hover:bg-[#E8F2FE] hover:text-[#1A75CE]"
                )}
                title="Assistant Ping (Ctrl/Cmd+Shift+K)"
                aria-label="Ouvrir l'assistant Ping"
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden lg:inline">Assistant</span>
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
