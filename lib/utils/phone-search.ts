import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Strip everything but digits, so "+33 6 12-34.56.78" and "0612345678" compare equal. */
export function digitsOnly(value: string): string {
    return value.replace(/\D/g, '');
}

const PHONE_SEARCH_TABLES = {
    Contact: 'Contact',
    Company: 'Company',
    ProspectProfile: 'ProspectProfile',
} as const;

/**
 * Finds ids of rows in `table` whose `phone` column matches `search` once both
 * sides are reduced to digits only (so formatting differences don't matter).
 * Returns [] without querying if the search doesn't contain enough digits to
 * be a meaningful phone search, so plain name/email searches skip this.
 */
export async function findIdsByPhone(
    table: keyof typeof PHONE_SEARCH_TABLES,
    search: string,
): Promise<string[]> {
    const digits = digitsOnly(search);
    if (digits.length < 4) return [];

    const rows = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM ${Prisma.raw(`"${PHONE_SEARCH_TABLES[table]}"`)} WHERE regexp_replace(phone, '\D', '', 'g') LIKE ${'%' + digits + '%'}`
    );
    return rows.map((r) => r.id);
}
