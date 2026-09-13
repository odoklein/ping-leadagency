"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared building blocks for the client report artifacts.
 * Colours come exclusively from the --elan-* tokens: the previous PDF broke
 * because it hardcoded a palette that the theme later dropped.
 */

export function SectionTitle({
    icon,
    title,
    subtitle,
    action,
}: {
    icon?: ReactNode;
    title: string;
    subtitle?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex items-end justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
                {icon && (
                    <div className="w-8 h-8 rounded-lg bg-[var(--elan-paper-2)] border border-[var(--elan-line)] flex items-center justify-center text-[var(--elan-ink)] shrink-0">
                        {icon}
                    </div>
                )}
                <div>
                    <h2 className="text-sm font-bold text-[var(--elan-ink)] uppercase tracking-wider">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-xs text-[var(--elan-slate)] mt-0.5">{subtitle}</p>
                    )}
                </div>
            </div>
            {action}
        </div>
    );
}

export function ArtifactCard({
    className,
    children,
    padded = true,
}: {
    className?: string;
    children: ReactNode;
    padded?: boolean;
}) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-[var(--elan-line)] bg-[var(--elan-surface)] shadow-[var(--elan-shadow-sm)]",
                "break-inside-avoid",
                padded && "p-5 md:p-6",
                className
            )}
        >
            {children}
        </div>
    );
}

/** Signed variation pill. Neutral when the delta is unknown. */
export function DeltaPill({
    value,
    suffix = "%",
    className,
}: {
    value: number | null | undefined;
    suffix?: string;
    className?: string;
}) {
    if (value == null) return null;
    const isUp = value > 0;
    const isFlat = value === 0;
    const Icon = isFlat ? ArrowRight : isUp ? ArrowUpRight : ArrowDownRight;
    const color = isFlat
        ? "var(--elan-slate)"
        : isUp
          ? "var(--elan-success)"
          : "var(--elan-danger)";

    return (
        <span
            className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums rounded-full px-1.5 py-0.5",
                className
            )}
            style={{ color, background: "var(--elan-paper-2)" }}
        >
            <Icon className="w-3 h-3" />
            {isUp ? "+" : ""}
            {value}
            {suffix}
        </span>
    );
}

export function AiBadge({ label = "Généré par IA" }: { label?: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[rgba(40,144,248,0.28)] bg-[rgba(40,144,248,0.09)] text-[var(--elan-amber-deep)]">
            <Sparkles className="w-3 h-3" />
            {label}
        </span>
    );
}

/** Placeholder shown while the narrative is being written. */
export function NarrativeSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn("space-y-2.5", className)} aria-hidden>
            {Array.from({ length: lines }).map((_, index) => (
                <div
                    key={index}
                    className="h-3 rounded-full skeleton-shimmer"
                    style={{ width: `${100 - index * 12}%` }}
                />
            ))}
        </div>
    );
}

export function QuietNote({ children }: { children: ReactNode }) {
    return (
        <p className="text-sm text-[var(--elan-slate)] italic leading-relaxed">{children}</p>
    );
}

/** Percentage formatted the French way, one decimal at most. */
export function formatPct(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded.toLocaleString("fr-FR")} %`;
}

export function formatDateTime(iso: string, withTime = false): string {
    const date = new Date(iso);
    // A meeting stored without an hour lands on midnight — showing "00:00"
    // would read as a real time, so drop it.
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        ...(withTime && hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
}

export function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
