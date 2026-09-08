import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { parseRdvImportDate } from '@/lib/rdv-import-parse-date';

export type CountryCode = Parameters<typeof isValidPhoneNumber>[1];
const DEFAULT_COUNTRY: CountryCode = 'FR';

/**
 * Normalize and clean a single phone number into E.164 format.
 * Automatically recovers French mobile/landline numbers where Excel stripped the leading zero.
 */
export function normalizeSinglePhone(
    raw: string | null | undefined,
    defaultCountry: CountryCode = DEFAULT_COUNTRY
): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Excel often strips the leading 0 for French numbers (e.g. "612345678" or "142345678")
    let cleaned = trimmed.replace(/[\s.-]/g, '');
    if (/^[1-9]\d{8}$/.test(cleaned)) {
        cleaned = '0' + cleaned;
    }

    try {
        if (isValidPhoneNumber(cleaned, defaultCountry)) {
            return parsePhoneNumber(cleaned, defaultCountry).format('E.164');
        }
        // Fallback: if it starts with + and has 8-15 digits
        if (/^\+\d{8,15}$/.test(cleaned)) {
            return cleaned;
        }
        // Fallback: if it has 10 digits starting with 0 in FR
        if (/^0[1-9]\d{8}$/.test(cleaned)) {
            return `+33${cleaned.substring(1)}`;
        }
        return trimmed;
    } catch {
        return trimmed;
    }
}

/**
 * Split a raw cell containing one or more phone numbers (separated by comma, semicolon, slash, or pipe)
 * and return [primaryPhone, ...additionalPhones].
 */
export function extractPhones(
    raw: string | null | undefined,
    defaultCountry: CountryCode = DEFAULT_COUNTRY
): { primaryPhone: string | null; additionalPhones: string[] } {
    if (!raw) return { primaryPhone: null, additionalPhones: [] };

    const rawParts = raw
        .split(/[;,/|]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    if (rawParts.length === 0) return { primaryPhone: null, additionalPhones: [] };

    const normalizedPhones: string[] = [];
    const seen = new Set<string>();

    for (const part of rawParts) {
        const norm = normalizeSinglePhone(part, defaultCountry);
        if (norm && !seen.has(norm)) {
            seen.add(norm);
            normalizedPhones.push(norm);
        }
    }

    if (normalizedPhones.length === 0) {
        return { primaryPhone: null, additionalPhones: [] };
    }

    return {
        primaryPhone: normalizedPhones[0],
        additionalPhones: normalizedPhones.slice(1),
    };
}

/**
 * Parse date from CSV (French DD/MM/YYYY, ISO, and Excel serial numbers like 45321).
 */
export function parseCsvDate(raw: string | null | undefined): Date | undefined {
    if (!raw) return undefined;
    return parseRdvImportDate(raw);
}

/**
 * Normalize an email address: lowercase, trim, and validate syntax.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return null;
    // Basic RFC 5322 regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(trimmed) ? trimmed : trimmed;
}

/**
 * Normalize website URL and extract root domain for company deduplication.
 */
export function normalizeWebsite(raw: string | null | undefined): { url: string | null; domain: string | null } {
    if (!raw) return { url: null, domain: null };
    let trimmed = raw.trim();
    if (!trimmed) return { url: null, domain: null };

    if (!/^https?:\/\//i.test(trimmed)) {
        trimmed = `https://${trimmed}`;
    }

    try {
        const parsed = new URL(trimmed);
        const hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        return {
            url: trimmed,
            domain: hostname || null,
        };
    } catch {
        // Fallback domain extraction
        const match = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
        return {
            url: trimmed,
            domain: match || null,
        };
    }
}

/**
 * Normalize company name for dedup (lowercase, clean whitespace, remove common French/English legal suffixes).
 */
export function normalizeCompanyName(name: string): string {
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/\b(sas|sarl|sa|snc|eurl|sci|llc|inc|corp|ltd|gmbh)\b\.?/gi, '')
        .trim();
}

/**
 * Safely split a multi-action cell while preserving content inside quotes.
 */
export function splitMultiActionCell(raw: string | undefined | null): string[] {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];

    return trimmed
        .split(/(?:\r?\n|;|\||=>|->|→|»)+/)
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter((part) => part.length > 0);
}
