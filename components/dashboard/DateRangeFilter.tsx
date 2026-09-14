"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type DateRangePreset =
    | "last7"
    | "last4weeks"
    | "lastMonth"
    | "last6months"
    | "last12months"
    | "monthToDate"
    | "quarterToDate"
    | "yearToDate"
    | "allTime";

export interface DateRangeValue {
    preset?: DateRangePreset;
    startDate?: string; // ISO date
    endDate?: string;
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
    { key: "last7", label: "7 derniers jours" },
    { key: "last4weeks", label: "4 dernières semaines" },
    // Rolling 30 days (see getPresetRange), not the previous calendar month —
    // "Mois dernier" read as October when it meant the last 30 days.
    { key: "lastMonth", label: "30 derniers jours" },
    { key: "last6months", label: "6 derniers mois" },
    { key: "last12months", label: "12 derniers mois" },
    { key: "monthToDate", label: "Mois en cours" },
    { key: "quarterToDate", label: "Trimestre en cours" },
    { key: "yearToDate", label: "Année en cours" },
    { key: "allTime", label: "Tout" },
];

/** Format date as YYYY-MM-DD in local time (avoids UTC shift that causes "day before" bug). */
export function toISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as local date (avoids UTC midnight shifting to previous day). */
function parseISODate(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
}

export function getPresetRange(preset: DateRangePreset): { start: Date; end: Date } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (preset) {
        case "last7":
            start.setDate(start.getDate() - 6);
            break;
        case "last4weeks":
            start.setDate(start.getDate() - 4 * 7);
            break;
        case "lastMonth":
            // Rolling 30 days: from today back 30 days (not calendar month 1–30)
            start.setDate(start.getDate() - 30);
            break;
        case "last6months":
            start.setMonth(start.getMonth() - 6);
            break;
        case "last12months":
            start.setFullYear(start.getFullYear() - 1);
            start.setMonth(start.getMonth() + 1);
            break;
        case "monthToDate":
            start.setDate(1);
            break;
        case "quarterToDate":
            const q = Math.floor(start.getMonth() / 3) + 1;
            start.setMonth((q - 1) * 3);
            start.setDate(1);
            break;
        case "yearToDate":
            start.setMonth(0);
            start.setDate(1);
            break;
        case "allTime":
            start.setFullYear(2020, 0, 1);
            break;
        default:
            start.setMonth(start.getMonth() - 1);
    }
    return { start, end };
}

function formatForInput(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

function parseInput(s: string): string | null {
    const match = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return toISO(date);
}

interface DateRangeFilterProps {
    value: DateRangeValue;
    onChange: (value: DateRangeValue) => void;
    onClose?: () => void;
    /** When true, renders as a dropdown panel (e.g. next to a trigger button). */
    isOpen?: boolean;
    className?: string;
}

export function DateRangeFilter({
    value,
    onChange,
    onClose,
    isOpen = true,
    className,
}: DateRangeFilterProps) {
    const [preset, setPreset] = useState<DateRangePreset | null>(() => value.preset ?? null);
    const [startInput, setStartInput] = useState(() =>
        value.startDate ? formatForInput(value.startDate) : ""
    );
    const [endInput, setEndInput] = useState(() =>
        value.endDate ? formatForInput(value.endDate) : ""
    );
    const [leftMonth, setLeftMonth] = useState(() => {
        const d = value.startDate ? parseISODate(value.startDate) : new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selectingEnd, setSelectingEnd] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const endDate = value.endDate ? parseISODate(value.endDate) : new Date();
    const rightMonth = useMemo(() => {
        const next = new Date(leftMonth);
        next.setMonth(next.getMonth() + 1);
        return next;
    }, [leftMonth]);

    const applyPreset = (key: DateRangePreset) => {
        setPreset(key);
        const { start, end } = getPresetRange(key);
        const startStr = toISO(start);
        const endStr = toISO(end);
        setStartInput(formatForInput(startStr));
        setEndInput(formatForInput(endStr));
        onChange({ preset: key, startDate: startStr, endDate: endStr });
    };

    const handleApply = () => {
        const start = parseInput(startInput);
        const end = parseInput(endInput);
        if (start && end && parseISODate(start) <= parseISODate(end)) {
            onChange({ startDate: start, endDate: end, preset: undefined });
            onClose?.();
        } else if (start && end) {
            onChange({ startDate: end, endDate: start, preset: undefined });
            onClose?.();
        }
        onClose?.();
    };

    const handleClear = () => {
        setPreset("allTime");
        setStartInput("");
        setEndInput("");
        const { start, end } = getPresetRange("allTime");
        onChange({ preset: "allTime", startDate: toISO(start), endDate: toISO(end) });
        onClose?.();
    };

    const handleCalendarClick = (year: number, month: number, day: number) => {
        const d = new Date(year, month, day);
        const iso = toISO(d);
        if (!selectingEnd) {
            setStartInput(formatForInput(iso));
            setEndInput(formatForInput(iso));
            setSelectingEnd(true);
            onChange({ startDate: iso, endDate: iso, preset: undefined });
        } else {
            const start = value.startDate || iso;
            if (parseISODate(iso) < parseISODate(start)) {
                setStartInput(formatForInput(iso));
                setEndInput(formatForInput(start));
                onChange({ startDate: iso, endDate: start, preset: undefined });
            } else {
                setEndInput(formatForInput(iso));
                onChange({ startDate: start, endDate: iso, preset: undefined });
            }
            setSelectingEnd(false);
        }
    };

    const startDateParsed = value.startDate ? parseISODate(value.startDate) : null;
    const endDateParsed = value.endDate ? parseISODate(value.endDate) : null;

    if (!isOpen) return null;

    return (
        <div
            ref={containerRef}
            className={cn(
                "bg-white rounded-xl border border-[#E8EBF0] shadow-lg overflow-hidden",
                "w-full max-w-[780px] min-w-[360px]",
                className
            )}
        >
            <div className="flex">
                {/* Left: Presets */}
                <div className="w-[220px] shrink-0 border-r border-[#E8EBF0] bg-[#F9FAFB] py-2">
                    {PRESETS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPreset(p.key)}
                            className={cn(
                                "w-full text-left px-4 py-2 text-[13px] font-medium transition-colors",
                                preset === p.key
                                    ? "bg-[#e6f0fa] text-[#2890F8] font-bold"
                                    : "text-[#12122A] hover:bg-[#F4F6F9]"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Right: Custom range + Calendars */}
                <div className="flex-1 p-4 min-w-0">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="block text-[11px] font-medium text-[#8B8BA7] uppercase tracking-wider mb-1">
                                Début
                            </label>
                            <input
                                type="text"
                                placeholder="JJ / MM / AAAA"
                                value={startInput}
                                onChange={(e) => setStartInput(e.target.value)}
                                className="w-full px-3 py-2 text-[13px] text-[#12122A] bg-white border border-[#E8EBF0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2890F8]/30 focus:border-[#2890F8]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-[#8B8BA7] uppercase tracking-wider mb-1">
                                Fin
                            </label>
                            <input
                                type="text"
                                placeholder="JJ / MM / AAAA"
                                value={endInput}
                                onChange={(e) => setEndInput(e.target.value)}
                                className="w-full px-3 py-2 text-[13px] text-[#12122A] bg-white border border-[#E8EBF0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2890F8]/30 focus:border-[#2890F8]"
                            />
                        </div>
                    </div>

                    {/* Two calendars */}
                    <div className="flex gap-8">
                        <MonthCalendar
                            year={leftMonth.getFullYear()}
                            month={leftMonth.getMonth()}
                            onPrev={() => setLeftMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                            onNext={() => setLeftMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                            startDate={startDateParsed}
                            endDate={endDateParsed}
                            onDayClick={handleCalendarClick}
                        />
                        <MonthCalendar
                            year={rightMonth.getFullYear()}
                            month={rightMonth.getMonth()}
                            onPrev={() => setLeftMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                            onNext={() => setLeftMonth((d) => new Date(d.getFullYear(), d.getMonth() + 2))}
                            startDate={startDateParsed}
                            endDate={endDateParsed}
                            onDayClick={handleCalendarClick}
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#E8EBF0]">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-4 py-2 text-[13px] font-medium text-[#5A5A7A] bg-white border border-[#E8EBF0] rounded-lg hover:bg-[#F4F6F9] transition-colors"
                        >
                            Effacer
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#2890F8] rounded-lg hover:bg-[#1a75ce] transition-colors shadow-sm"
                        >
                            Appliquer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function MonthCalendar({
    year,
    month,
    onPrev,
    onNext,
    startDate,
    endDate,
    onDayClick,
}: {
    year: number;
    month: number;
    onPrev: () => void;
    onNext: () => void;
    startDate: Date | null;
    endDate: Date | null;
    onDayClick: (y: number, m: number, d: number) => void;
}) {
    const grid = useMemo(() => {
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const startPad = first.getDay();
        const daysInMonth = last.getDate();
        const cells: { day: number | null; isCurrent: boolean }[] = [];
        for (let i = 0; i < startPad; i++) cells.push({ day: null, isCurrent: false });
        for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, isCurrent: true });
        return cells;
    }, [year, month]);

    const monthLabel = new Date(year, month).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
    });

    return (
        <div className="flex flex-col min-w-[180px]">
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={onPrev}
                    className="p-1.5 rounded text-[#8B8BA7] hover:bg-[#F4F6F9] hover:text-[#12122A]"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[13px] font-semibold text-[#12122A] capitalize">
                    {monthLabel}
                </span>
                <button
                    type="button"
                    onClick={onNext}
                    className="p-1.5 rounded text-[#8B8BA7] hover:bg-[#F4F6F9] hover:text-[#12122A]"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((w) => (
                    <div
                        key={w}
                        className="text-[11px] font-medium text-[#8B8BA7] py-1.5"
                    >
                        {w}
                    </div>
                ))}
                {grid.map((cell, i) => {
                    if (cell.day === null) {
                        return <div key={`e-${i}`} className="min-h-[32px]" />;
                    }
                    const d = new Date(year, month, cell.day);
                    const isStart =
                        startDate &&
                        startDate.getFullYear() === year &&
                        startDate.getMonth() === month &&
                        startDate.getDate() === cell.day;
                    const isEnd =
                        endDate &&
                        endDate.getFullYear() === year &&
                        endDate.getMonth() === month &&
                        endDate.getDate() === cell.day;
                    const inRange =
                        startDate &&
                        endDate &&
                        d >= startDate &&
                        d <= endDate &&
                        !isStart &&
                        !isEnd;
                    const isToday = (() => {
                        const t = new Date();
                        return (
                            t.getFullYear() === year &&
                            t.getMonth() === month &&
                            t.getDate() === cell.day
                        );
                    })();

                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onDayClick(year, month, cell.day!)}
                            className={cn(
                                "min-w-[32px] min-h-[32px] w-8 h-8 flex items-center justify-center text-[13px] font-medium rounded-md transition-colors",
                                !cell.isCurrent && "text-[#C5C8D4]",
                                cell.isCurrent && "text-[#12122A] hover:bg-[#F4F6F9]",
                                isStart && "bg-[#2890F8] text-white hover:bg-[#1a75ce]",
                                isEnd && "bg-[#2890F8] text-white hover:bg-[#1a75ce]",
                                inRange && "bg-[#e6f0fa] text-[#2890F8]",
                                isToday && !isStart && !isEnd && !inRange && "ring-1 ring-[#2890F8]"
                            )}
                        >
                            {cell.day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
