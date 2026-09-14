// GET /api/manager/assistant/conversations
// Conversation list for drill-down: titles and metadata only, no message bodies.

import { NextRequest } from "next/server";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";
import { listAssistantConversations } from "@/lib/assistant/analytics";
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

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);
    const { searchParams } = request.nextUrl;
    const toParam = searchParams.get("to");
    const fromParam = searchParams.get("from");
    const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();
    const from = fromParam
        ? new Date(`${fromParam}T00:00:00.000Z`)
        : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const roleParam = searchParams.get("role");
    const role =
        roleParam && ROLES.includes(roleParam as UserRole) ? (roleParam as UserRole) : undefined;

    return successResponse(
        await listAssistantConversations({
            from,
            to,
            role,
            clientId: searchParams.get("clientId") || undefined,
        })
    );
});
