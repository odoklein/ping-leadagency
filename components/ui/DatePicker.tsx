"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// DATE PICKER COMPONENT
// ============================================

interface DatePickerProps {
    value?: string; // ISO date string
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    minDate?: string;
    maxDate?: string;
    className?: string;
}

const DAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const MONTHS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export function DatePicker({
    value,
    onChange,
    label,
    placeholder = "Sélectionner une date...",
    error,
    disabled = false,
    minDate,
    maxDate,
    className,
}: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        if (value) return new Date(value);
        return new Date();
    });
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? new Date(value) : null;

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Get calendar days
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days: (Date | null)[] = [];

        // Add empty slots for days before first of month
        // getDay() returns 0 for Sunday, we need Monday as 0
        const startDay = (firstDay.getDay() + 6) % 7;
        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }

        // Add all days of month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const isDateDisabled = (date: Date) => {
        if (minDate && date < new Date(minDate)) return true;
        if (maxDate && date > new Date(maxDate)) return true;
        return false;
    };

    const isSameDay = (d1: Date | null, d2: Date | null) => {
        if (!d1 || !d2) return false;
        return d1.toDateString() === d2.toDateString();
    };

    const isToday = (date: Date) => {
        return isSameDay(date, new Date());
    };

    const handleSelect = (date: Date) => {
        if (isDateDisabled(date)) return;
        onChange(date.toISOString().split("T")[0]);
        setIsOpen(false);
    };

    const goToPrevMonth = () => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const formatDisplayDate = (date: Date) => {
        return new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(date);
    };

    const days = getDaysInMonth(viewDate);

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-2">
                    {label}
                </label>
            )}

            {/* Trigger */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "w-full flex items-center justify-between gap-2 px-4 py-3",
                    "bg-white border rounded-xl text-left",
                    "transition-all duration-200",
                    error
                        ? "border-red-500"
                        : isOpen
                            ? "border-indigo-500 ring-2 ring-indigo-500/20"
                            : "border-slate-200 hover:border-slate-300",
                    disabled && "opacity-50 cursor-not-allowed bg-slate-50"
                )}
            >
                <span className={cn(
                    selectedDate ? "text-slate-900" : "text-slate-400"
                )}>
                    {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
                </span>
                <Calendar className="w-4 h-4 text-slate-400" />
            </button>

            {error && (
                <p className="text-sm text-red-500 mt-1">{error}</p>
            )}

            {/* Calendar Dropdown */}
            {isOpen && (
                <div className="cp-pop cp-pop-flush absolute w-[300px] mt-2">
                    {/* Header */}
                    <div className="cp-pop-header justify-between">
                        <button
                            type="button"
                            onClick={goToPrevMonth}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-medium text-slate-900">
                            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </span>
                        <button
                            type="button"
                            onClick={goToNextMonth}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 gap-1 p-2 border-b border-slate-100">
                        {DAYS.map(day => (
                            <div key={day} className="text-center text-xs text-slate-400 py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 p-2">
                        {days.map((day, i) => (
                            <div key={i} className="aspect-square">
                                {day && (
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(day)}
                                        disabled={isDateDisabled(day)}
                                        className={cn(
                                            "w-full h-full flex items-center justify-center rounded-lg text-sm transition-colors",
                                            isSameDay(day, selectedDate)
                                                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/25"
                                                : isToday(day)
                                                    ? "bg-indigo-50 text-indigo-600"
                                                    : "text-slate-700 hover:bg-slate-100",
                                            isDateDisabled(day) && "opacity-30 cursor-not-allowed"
                                        )}
                                    >
                                        {day.getDate()}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => {
                                const today = new Date();
                                setViewDate(today);
                                onChange(today.toISOString().split("T")[0]);
                                setIsOpen(false);
                            }}
                            className="text-xs text-indigo-500 hover:text-indigo-600 px-2 py-1 font-medium"
                        >
                            Aujourd&apos;hui
                        </button>
                        {value && (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange("");
                                    setIsOpen(false);
                                }}
                                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                            >
                                Effacer
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default DatePicker;
