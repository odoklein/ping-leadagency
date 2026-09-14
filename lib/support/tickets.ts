/**
 * Support ticket service.
 *
 * Distinct from `lib/support/service.ts`, which drives SupportConversation —
 * the single perpetual chat thread each client has. A ticket is a discrete,
 * trackable issue with its own status, assignee and resolution, and anyone can
 * raise one (clients, SDRs, managers), not just clients.
 */

import { prisma } from "@/lib/prisma";
import type {
    SupportTicketCategory,
    SupportTicketPriority,
    SupportTicketSource,
    SupportTicketStatus,
} from "@prisma/client";

/** Anything longer is the requester pasting a log; keep the row readable. */
const MAX_SUBJECT = 160;
const MAX_BODY = 4000;

/**
 * Two tickets with the same subject from the same person inside this window are
 * treated as one. The assistant can be asked twice, and a retrying tool loop
 * must not leave the manager queue with duplicates.
 */
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export interface CreateTicketInput {
    requesterId: string;
    subject: string;
    body: string;
    category?: SupportTicketCategory;
    priority?: SupportTicketPriority;
    source?: SupportTicketSource;
    missionId?: string | null;
    context?: Record<string, unknown> | null;
}

export interface CreatedTicket {
    id: string;
    subject: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    status: SupportTicketStatus;
    createdAt: Date;
    /** True when an identical recent ticket was returned instead of a new one. */
    deduplicated: boolean;
}

function clamp(value: string, max: number): string {
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Create a ticket, or return the requester's identical recent one.
 *
 * `clientId` is resolved from the requester rather than taken from the caller:
 * the tenant a ticket belongs to is never something the AI (or a request body)
 * gets to assert.
 */
export async function createSupportTicket(
    input: CreateTicketInput
): Promise<CreatedTicket> {
    const subject = clamp(input.subject, MAX_SUBJECT);
    const body = clamp(input.body, MAX_BODY);

    if (!subject) throw new Error("Le sujet du ticket est vide.");
    if (!body) throw new Error("La description du ticket est vide.");

    const requester = await prisma.user.findUnique({
        where: { id: input.requesterId },
        select: { id: true, clientId: true, isActive: true },
    });
    if (!requester || !requester.isActive) {
        throw new Error("Demandeur introuvable ou inactif.");
    }

    const existing = await prisma.supportTicket.findFirst({
        where: {
            requesterId: requester.id,
            subject,
            status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER"] },
            createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
        },
        select: {
            id: true,
            subject: true,
            category: true,
            priority: true,
            status: true,
            createdAt: true,
        },
    });
    if (existing) return { ...existing, deduplicated: true };

    const ticket = await prisma.supportTicket.create({
        data: {
            requesterId: requester.id,
            clientId: requester.clientId,
            missionId: input.missionId ?? null,
            subject,
            body,
            category: input.category ?? "OTHER",
            priority: input.priority ?? "NORMAL",
            source: input.source ?? "WEB",
            context: (input.context ?? undefined) as never,
            messages: {
                create: {
                    authorId: requester.id,
                    content: body,
                },
            },
        },
        select: {
            id: true,
            subject: true,
            category: true,
            priority: true,
            status: true,
            createdAt: true,
        },
    });

    return { ...ticket, deduplicated: false };
}
