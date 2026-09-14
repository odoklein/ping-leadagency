/**
 * Support tools.
 *
 * `create_support_ticket` is the first mutating tool in the registry (step 6 of
 * the phased plan). Its blast radius is deliberately tiny: it writes one row to
 * a queue a human then triages, it cannot touch prospection data, and the
 * executor caps it at one successful write per assistant turn.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupportTicket } from "@/lib/support/tickets";
import { AIRequestContext, ToolAuthorizationError } from "../types";
import { resolveMissionScope } from "../scope";
import { defineTool, defineWriteTool, clampLimit, strictArgs } from "../helpers";
import { sanitizeUntrusted } from "../redact";

const CATEGORIES = ["BUG", "QUESTION", "DATA_ISSUE", "ACCESS", "BILLING", "FEATURE_REQUEST", "OTHER"] as const;
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const createTicketArgs = strictArgs({
    subject: z.string().min(3).max(160),
    body: z.string().min(10).max(4000),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    missionId: z.string().min(1).optional(),
});

export const createSupportTicketTool = defineWriteTool({
    name: "create_support_ticket",
    description:
        "Ouvre un ticket de support pour l'utilisateur courant. A utiliser quand l'utilisateur " +
        "signale un bug, une donnee incorrecte, un probleme d'acces, une question de facturation " +
        "ou demande une evolution, ET qu'aucun outil de lecture ne peut resoudre sa demande. " +
        "Toujours reformuler le probleme dans 'body' avec les faits donnes par l'utilisateur. " +
        "Demande confirmation a l'utilisateur avant d'appeler cet outil. Un seul ticket par message.",
    parameters: {
        type: "object",
        properties: {
            subject: { type: "string", description: "Resume court du probleme (max 160 caracteres)." },
            body: {
                type: "string",
                description:
                    "Description complete: ce que l'utilisateur voulait faire, ce qui s'est passe, " +
                    "et tout identifiant ou page mentionne.",
            },
            category: {
                type: "string",
                enum: [...CATEGORIES],
                description: "Nature du probleme. Defaut: OTHER.",
            },
            priority: {
                type: "string",
                enum: [...PRIORITIES],
                description: "Urgence ressentie. Defaut: NORMAL. Reserver URGENT a un blocage total.",
            },
            missionId: { type: "string", description: "Mission concernee, si la demande en vise une." },
        },
        required: ["subject", "body"],
        additionalProperties: false,
    },
    schema: createTicketArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT", "COMMERCIAL", "BUSINESS_DEVELOPER"],
    execute: async (args: z.infer<typeof createTicketArgs>, ctx: AIRequestContext) => {
        // A mission id from the model is untrusted input: throws if out of perimeter.
        if (args.missionId) resolveMissionScope(ctx, args.missionId);

        const ticket = await createSupportTicket({
            // Never from the model: the ticket is always filed as the caller.
            requesterId: ctx.userId,
            subject: args.subject,
            body: args.body,
            category: args.category,
            priority: args.priority,
            missionId: args.missionId ?? null,
            source: "ASSISTANT",
            context: {
                raisedVia: "assistant",
                role: ctx.role,
                // Lets the manager queue link straight to the transcript.
                conversationId: ctx.conversationId ?? null,
            },
        });

        return {
            ticketId: ticket.id,
            subject: ticket.subject,
            category: ticket.category,
            priority: ticket.priority,
            status: ticket.status,
            createdAt: ticket.createdAt,
            deduplicated: ticket.deduplicated,
            note: ticket.deduplicated
                ? "Un ticket identique a deja ete ouvert recemment; il a ete reutilise."
                : "Ticket ouvert. L'equipe support le traitera.",
        };
    },
});

const myTicketsArgs = strictArgs({
    status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED", "CLOSED"]).optional(),
    limit: z.number().int().optional(),
});

export const getMyTickets = defineTool({
    name: "get_my_support_tickets",
    description:
        "Liste les tickets de support ouverts par l'utilisateur courant, avec leur statut. " +
        "A utiliser pour 'ou en est mon ticket', 'j'ai signale un bug la semaine derniere'.",
    parameters: {
        type: "object",
        properties: {
            status: {
                type: "string",
                enum: ["OPEN", "IN_PROGRESS", "WAITING_ON_REQUESTER", "RESOLVED", "CLOSED"],
                description: "Filtrer sur un statut precis.",
            },
            limit: { type: "integer", description: "Nombre max de tickets (1-50, defaut 20)." },
        },
        additionalProperties: false,
    },
    schema: myTicketsArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT", "COMMERCIAL", "BUSINESS_DEVELOPER"],
    execute: async (args: z.infer<typeof myTicketsArgs>, ctx: AIRequestContext) => {
        if (!ctx.isActive) throw new ToolAuthorizationError("Compte desactive.", "inactive_account");

        const tickets = await prisma.supportTicket.findMany({
            // Scope is the caller, always — a ticket list is never widened.
            where: { requesterId: ctx.userId, ...(args.status ? { status: args.status } : {}) },
            select: {
                id: true,
                subject: true,
                category: true,
                priority: true,
                status: true,
                createdAt: true,
                resolvedAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: clampLimit(args.limit),
        });

        return {
            count: tickets.length,
            tickets: tickets.map((t) => ({
                ...t,
                // Subject is requester-authored free text.
                subject: sanitizeUntrusted(t.subject, 160),
            })),
        };
    },
});
