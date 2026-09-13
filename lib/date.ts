import { DateTime } from "luxon";

export type DateOnly = string; // Format: YYYY-MM-DD
export type UTCDateTime = string; // Format: ISO 8601 UTC

/** Business timezone. All client-facing day grouping must use this, not browser local
 *  time, so the same record never lands on different days across two pages. */
export const DISPLAY_TZ = "Europe/Paris";

/** Day bucket (YYYY-MM-DD) for a timestamp, in business time. */
export function displayDayKey(input: string | Date): DateOnly {
    return DateTime.fromJSDate(new Date(input)).setZone(DISPLAY_TZ).toFormat("yyyy-MM-dd");
}

/** Day bucket N days before today, in business time. */
export function displayDayKeyDaysAgo(days: number): DateOnly {
    return DateTime.now().setZone(DISPLAY_TZ).minus({ days }).toFormat("yyyy-MM-dd");
}

/** Inclusive list of day buckets from `from` to `to`, in business time. */
export function displayDayRange(from: DateOnly, to: DateOnly): DateOnly[] {
    const start = DateTime.fromISO(from, { zone: DISPLAY_TZ }).startOf("day");
    const end = DateTime.fromISO(to, { zone: DISPLAY_TZ }).startOf("day");
    const out: DateOnly[] = [];
    for (let d = start; d <= end; d = d.plus({ days: 1 })) out.push(d.toFormat("yyyy-MM-dd"));
    return out;
}

/**
 * Validates and parses a DateOnly string strictly as YYYY-MM-DD.
 */
export function parseDateOnly(dateString: string): DateOnly {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error(`Invalid DateOnly format: ${dateString}. Expected YYYY-MM-DD.`);
    }
    return dateString;
}

/**
 * Formats a valid YYYY-MM-DD string into a displayable localized format
 * safely without implicit timezone shifting.
 */
export function formatDateOnly(dateString: DateOnly, locale: string = 'fr-FR'): string {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    const [year, month, day] = parts.map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString(locale);
}

/**
 * Validates and strictly parses an ISO string into UTC format.
 */
export function parseUTCDateTime(isoString: string | Date): UTCDateTime {
    const dt = DateTime.fromJSDate(new Date(isoString)).setZone("utc");
    if (!dt.isValid) throw new Error(`Invalid DateTime: ${isoString}`);
    return dt.toISO() as UTCDateTime;
}

/**
 * Converts a UTC ISO string to the local timezone representation.
 */
export function formatLocalDateTime(isoString: string | Date, locale: string = 'fr-FR', timeZone: string = 'Europe/Paris'): string {
    const dt = DateTime.fromJSDate(new Date(isoString)).setZone(timeZone);
    return dt.setLocale(locale).toLocaleString(DateTime.DATETIME_SHORT) || '';
}
