// GET   /api/support/tickets/[id] — the ticket and its thread
// PATCH /api/support/tickets/[id] — triage (manager) or reply (requester)

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    errorResponse,
    requireRole,
    successResponse,
    validateRequest,
    withErrorHandler,
} from "@/lib/api-utils";
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

const patchSchema = z.object({
    status: z
        .enum(["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED", "CLOSED"])
        .optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    reply: z.string().min(1).max(4000).optional(),
});

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole([...ALL_ROLES], request);
    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        select: {
            id: true,
            subject: true,
            body: true,
            category: true,
            priority: true,
            status: true,
            source: true,
            context: true,
            createdAt: true,
            resolvedAt: true,
            requesterId: true,
            requester: { select: { id: true, name: true, role: true } },
            client: { select: { id: true, name: true } },
            mission: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
            messages: {
                select: {
                    id: true,
                    content: true,
                    isSystem: true,
                    createdAt: true,
                    author: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "asc" },
            },
        },
    });

    if (!ticket) return errorResponse("Ticket introuvable", 404);
    // A requester sees only their own; a manager sees the queue.
    if (session.user.role !== "MANAGER" && ticket.requesterId !== session.user.id) {
        return errorResponse("Ticket introuvable", 404);
    }

    return successResponse(ticket);
});

export const PATCH = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const session = await requireRole([...ALL_ROLES], request);
    const { id } = await params;
    const data = await validateRequest(request, patchSchema);

    const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true, requesterId: true, status: true },
    });
    if (!ticket) return errorResponse("Ticket introuvable", 404);

    const isManager = session.user.role === "MANAGER";
    const isRequester = ticket.requesterId === session.user.id;
    if (!isManager && !isRequester) return errorResponse("Ticket introuvable", 404);

    // Triage fields are manager-only; a requester may only add a reply.
    const wantsTriage =
        data.status !== undefined || data.priority !== undefined || data.assigneeId !== undefined;
    if (wantsTriage && !isManager) {
        return errorResponse("Seul un manager peut modifier le statut d'un ticket", 403);
    }

    const update: Prisma.SupportTicketUpdateInput = {};
    if (data.status !== undefined) {
        update.status = data.status;
        update.resolvedAt =
            data.status === "RESOLVED" || data.status === "CLOSED" ? new Date() : null;
    }
    if (data.priority !== undefined) update.priority = data.priority;
    if (data.assigneeId !== undefined) {
        update.assignee = data.assigneeId
            ? { connect: { id: data.assigneeId } }
            : { disconnect: true };
    }

    await prisma.$transaction(async (tx) => {
        if (Object.keys(update).length > 0) {
            await tx.supportTicket.update({ where: { id }, data: update });
        }
        if (data.reply) {
            await tx.supportTicketMessage.create({
                data: { ticketId: id, authorId: session.user.id, content: data.reply },
            });
        }
        if (data.status && data.status !== ticket.status) {
            await tx.supportTicketMessage.create({
                data: {
                    ticketId: id,
                    authorId: session.user.id,
                    content: `Statut : ${ticket.status} → ${data.status}`,
                    isSystem: true,
                },
            });
        }
    });

    return successResponse({ id });
});
