/**
 * Meeting (RDV) lookup.
 *
 * COMMERCIAL users get an extra hard filter on `interlocuteurId`, applied inside
 * `buildActionScopeWhere` rather than here, so it cannot be forgotten.
 */

import { z } from "zod";
import type { ActionResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AIRequestContext } from "../types";
import { buildActionScopeWhere, hasEmptyScope } from "../scope";
import { clampLimit, defineTool, isoDateSchema, resolveDateRange, strictArgs } from "../helpers";
import { sanitizeUntrusted } from "../redact";

const MEETING_RESULTS: ActionResult[] = ["MEETING_BOOKED", "MEETING_CANCELLED"];

const meetingsArgs = strictArgs({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    confirmationStatus: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
    missionId: z.string().min(1).optional(),
    limit: z.number().int().optional(),
});

export const getMyMeetings = defineTool({
    name: "get_my_meetings",
    description:
        "Liste les RDV accessibles a l'utilisateur sur une periode: date, contact, societe, " +
        "mission, type de RDV et statut de confirmation. A utiliser pour 'quels RDV ai-je', " +
        "'mes RDV de la semaine', 'un RDV a disparu'. La periode porte sur la date du RDV.",
    parameters: {
        type: "object",
        properties: {
            from: { type: "string", description: "Debut de periode, format YYYY-MM-DD." },
            to: { type: "string", description: "Fin de periode, format YYYY-MM-DD." },
            confirmationStatus: {
                type: "string",
                enum: ["PENDING", "CONFIRMED", "CANCELLED"],
                description: "Filtrer sur le statut de confirmation manager.",
            },
            missionId: { type: "string", description: "Restreindre a une mission precise." },
            limit: { type: "integer", description: "Nombre max de RDV (1-50, defaut 20)." },
        },
        additionalProperties: false,
    },
    schema: meetingsArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT", "COMMERCIAL"],
    execute: async (args: z.infer<typeof meetingsArgs>, ctx: AIRequestContext) => {
        if (hasEmptyScope(ctx)) {
            return { count: 0, meetings: [], note: "Aucune mission accessible pour cet utilisateur." };
        }

        const range = resolveDateRange(args.from, args.to);
        const where: Record<string, unknown> = {
            ...buildActionScopeWhere(ctx, { missionId: args.missionId }),
            result: { in: MEETING_RESULTS },
            // MEETING_BOOKED stores the scheduled meeting date in callbackDate.
            callbackDate: { gte: range.from, lte: range.to },
        };
        if (args.confirmationStatus) where.confirmationStatus = args.confirmationStatus;

        const meetings = await prisma.action.findMany({
            where,
            select: {
                id: true,
                result: true,
                callbackDate: true,
                createdAt: true,
                meetingType: true,
                meetingCategory: true,
                confirmationStatus: true,
                cancellationReason: true,
                sdr: { select: { id: true, name: true } },
                contact: {
                    select: { id: true, firstName: true, lastName: true, title: true },
                },
                company: { select: { id: true, name: true } },
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        mission: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { callbackDate: "asc" },
            take: clampLimit(args.limit),
        });

        return {
            count: meetings.length,
            period: { from: range.from, to: range.to },
            meetings: meetings.map((m) => ({
                id: m.id,
                result: m.result,
                scheduledAt: m.callbackDate,
                bookedAt: m.createdAt,
                meetingType: m.meetingType,
                meetingCategory: m.meetingCategory,
                confirmationStatus: m.confirmationStatus,
                cancellationReason: m.cancellationReason,
                sdrName: sanitizeUntrusted(m.sdr?.name, 120),
                contactName: sanitizeUntrusted(
                    [m.contact?.firstName, m.contact?.lastName].filter(Boolean).join(" ") || null,
                    120
                ),
                contactTitle: sanitizeUntrusted(m.contact?.title, 120),
                companyName: sanitizeUntrusted(m.company?.name, 160),
                missionName: sanitizeUntrusted(m.campaign?.mission?.name, 160),
            })),
        };
    },
});
