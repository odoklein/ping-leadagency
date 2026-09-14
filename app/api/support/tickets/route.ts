// GET  /api/support/tickets — my tickets, or the whole queue for a manager
// POST /api/support/tickets — raise a ticket from the UI (the assistant uses
//                             the create_support_ticket tool instead)

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    requireRole,
    successResponse,
    validateRequest,
    withErrorHandler,
} from "@/lib/api-utils";
import { createSupportTicket } from "@/lib/support/tickets";
import type { Prisma } from "@prisma/client";

const ALL_ROLES = [
    "SDR",
    "BOOKER",
    "MANAGER",
    "CLIENT",
    "COMMERCIAL",
    "BUSINESS_DEVELOPER",
    "DEVELOPER",
] as const;

const createSchema = z.object({
    subject: z.string().min(3).max(160),
    body: z.string().min(10).max(4000),
    category: z
        .enum(["BUG", "QUESTION", "DATA_ISSUE", "ACCESS", "BILLING", "FEATURE_REQUEST", "OTHER"])
        .optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    missionId: z.string().min(1).optional(),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole([...ALL_ROLES], request);
    const { searchParams } = request.nextUrl;
    const isManager = session.user.role === "MANAGER";
    const scope = searchParams.get("scope");

    // Only a manager may widen past their own tickets, and only by asking.
    const where: Prisma.SupportTicketWhereInput =
        isManager && scope === "all" ? {} : { requesterId: session.user.id };

    const status = searchParams.get("status");
    if (status) where.status = status as Prisma.SupportTicketWhereInput["status"];

    const tickets = await prisma.supportTicket.findMany({
        where,
        select: {
            id: true,
            subject: true,
            category: true,
            priority: true,
            status: true,
            source: true,
            createdAt: true,
            resolvedAt: true,
            requester: { select: { id: true, name: true, role: true } },
            client: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
            _count: { select: { messages: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
    });

    return successResponse(tickets);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole([...ALL_ROLES], request);
    const data = await validateRequest(request, createSchema);

    const ticket = await createSupportTicket({
        // Never from the body: a ticket is always filed as the caller.
        requesterId: session.user.id,
        subject: data.subject,
        body: data.body,
        category: data.category,
        priority: data.priority,
        missionId: data.missionId ?? null,
        source: "WEB",
    });

    return successResponse(ticket, ticket.deduplicated ? 200 : 201);
});
