// GET /api/manager/assistant/overview
// Aggregate assistant usage across the agency. MANAGER only: this reads across
// every tenant, so it is never exposed to a client or SDR role.

import { NextRequest } from "next/server";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";
import { getAssistantOverview } from "@/lib/assistant/analytics";
import type { UserRole } from "@prisma/client";

const ROLES: UserRole[] = [
    "SDR",
    "BOOKER",
    "MANAGER",
    "CLIENT",
    "COMMERCIAL",
    "BUSINESS_DEVELOPER",
    "DEVELOPER",
];

/** Defaults to the last 30 days when no explicit range is given. */
export function parseAssistantRange(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const toParam = searchParams.get("to");
    const fromParam = searchParams.get("from");
    const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();
    const from = fromParam
        ? new Date(`${fromParam}T00:00:00.000Z`)
        : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const roleParam = searchParams.get("role");
    return {
        from,
        to,
        role: roleParam && ROLES.includes(roleParam as UserRole) ? (roleParam as UserRole) : undefined,
        clientId: searchParams.get("clientId") || undefined,
    };
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    return successResponse(await getAssistantOverview(parseAssistantRange(request)));
});
