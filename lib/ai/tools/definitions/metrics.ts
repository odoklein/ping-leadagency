/**
 * Performance metrics. Every query starts from `buildActionScopeWhere`, which
 * binds the Action set to the caller through campaign -> mission -> client.
 */

import { z } from "zod";
import type { ActionResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AIRequestContext } from "../types";
import { buildActionScopeWhere, hasEmptyScope } from "../scope";
import {
    ActivityPeriod,
    defineTool,
    isoDateSchema,
    percent,
    resolveDateRange,
    resolvePeriod,
    strictArgs,
} from "../helpers";

/** Results that count as a booked meeting. */
const MEETING_RESULTS: ActionResult[] = ["MEETING_BOOKED"];
/** Results that count as positive intent short of a meeting. */
const INTEREST_RESULTS: ActionResult[] = ["INTERESTED", "PROJET_A_SUIVRE"];

const metricsArgs = strictArgs({
    missionId: z.string().min(1).optional(),
    sdrId: z.string().min(1).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
});

export const getCampaignMetrics = defineTool({
    name: "get_campaign_metrics",
    description:
        "Calcule les metriques de prospection sur une periode: nombre d'actions, RDV pris, " +
        "taux de conversion, taux d'interet, contacts uniques, temps d'appel et repartition " +
        "par resultat. A utiliser pour 'combien de RDV ce mois-ci', 'quel est notre taux de " +
        "conversion', 'comment performe la mission X'. Periode par defaut: 30 derniers jours.",
    parameters: {
        type: "object",
        properties: {
            missionId: { type: "string", description: "Restreindre a une mission precise." },
            sdrId: { type: "string", description: "Restreindre a un SDR precis." },
            from: { type: "string", description: "Date de debut incluse, format YYYY-MM-DD." },
            to: { type: "string", description: "Date de fin incluse, format YYYY-MM-DD." },
        },
        additionalProperties: false,
    },
    schema: metricsArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT", "BUSINESS_DEVELOPER"],
    execute: async (args: z.infer<typeof metricsArgs>, ctx: AIRequestContext) => {
        const range = resolveDateRange(args.from, args.to);
        const scopeWhere = buildActionScopeWhere(ctx, {
            missionId: args.missionId,
            sdrId: args.sdrId,
        });

        if (hasEmptyScope(ctx)) {
            return { ...emptyMetrics(range), note: "Aucune mission accessible pour cet utilisateur." };
        }

        const where = {
            ...scopeWhere,
            createdAt: { gte: range.from, lte: range.to },
        };

        const [byResult, aggregates, uniqueContacts] = await Promise.all([
            prisma.action.groupBy({ by: ["result"], where, _count: { _all: true } }),
            prisma.action.aggregate({ where, _count: { _all: true }, _sum: { duration: true } }),
            prisma.action.findMany({
                where: { ...where, contactId: { not: null } },
                select: { contactId: true },
                distinct: ["contactId"],
            }),
        ]);

        const resultBreakdown: Record<string, number> = {};
        for (const row of byResult) resultBreakdown[row.result] = row._count._all;

        const totalActions = aggregates._count._all;
        const meetingsBooked = MEETING_RESULTS.reduce(
            (sum, r) => sum + (resultBreakdown[r] ?? 0),
            0
        );
        const interested = INTEREST_RESULTS.reduce(
            (sum, r) => sum + (resultBreakdown[r] ?? 0),
            0
        );

        return {
            period: { from: range.from, to: range.to },
            totalActions,
            meetingsBooked,
            interested,
            uniqueContacts: uniqueContacts.length,
            talkTimeSeconds: aggregates._sum.duration ?? 0,
            conversionRate: percent(meetingsBooked, totalActions),
            interestRate: percent(meetingsBooked + interested, totalActions),
            resultBreakdown,
        };
    },
});

function emptyMetrics(range: { from: Date; to: Date }) {
    return {
        period: { from: range.from, to: range.to },
        totalActions: 0,
        meetingsBooked: 0,
        interested: 0,
        uniqueContacts: 0,
        talkTimeSeconds: 0,
        conversionRate: 0,
        interestRate: 0,
        resultBreakdown: {} as Record<string, number>,
    };
}

const activityArgs = strictArgs({
    period: z.enum(["today", "week", "month"]).optional(),
    sdrId: z.string().min(1).optional(),
    missionId: z.string().min(1).optional(),
});

export const getActivitySummary = defineTool({
    name: "get_activity_summary",
    description:
        "Resume l'activite recente par canal (appels, emails, LinkedIn) sur aujourd'hui, " +
        "la semaine en cours ou le mois en cours. A utiliser pour 'qu'est-ce qui a ete fait " +
        "aujourd'hui', 'combien d'appels cette semaine'.",
    parameters: {
        type: "object",
        properties: {
            period: {
                type: "string",
                enum: ["today", "week", "month"],
                description: "Periode analysee. Defaut: today.",
            },
            sdrId: { type: "string", description: "Restreindre a un SDR precis." },
            missionId: { type: "string", description: "Restreindre a une mission precise." },
        },
        additionalProperties: false,
    },
    schema: activityArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT"],
    execute: async (args: z.infer<typeof activityArgs>, ctx: AIRequestContext) => {
        const period = (args.period ?? "today") as ActivityPeriod;
        const range = resolvePeriod(period);
        const scopeWhere = buildActionScopeWhere(ctx, {
            missionId: args.missionId,
            sdrId: args.sdrId,
        });

        if (hasEmptyScope(ctx)) {
            return {
                period,
                range,
                totalActions: 0,
                byChannel: {},
                meetings: 0,
                talkTimeMinutes: 0,
                note: "Aucune mission accessible pour cet utilisateur.",
            };
        }

        const where = { ...scopeWhere, createdAt: { gte: range.from, lte: range.to } };

        const [byChannel, aggregates, meetings] = await Promise.all([
            prisma.action.groupBy({ by: ["channel"], where, _count: { _all: true } }),
            prisma.action.aggregate({ where, _count: { _all: true }, _sum: { duration: true } }),
            prisma.action.count({ where: { ...where, result: { in: MEETING_RESULTS } } }),
        ]);

        const channels: Record<string, number> = {};
        for (const row of byChannel) channels[row.channel] = row._count._all;

        return {
            period,
            range,
            totalActions: aggregates._count._all,
            byChannel: channels,
            meetings,
            talkTimeMinutes: Math.round((aggregates._sum.duration ?? 0) / 60),
        };
    },
});
