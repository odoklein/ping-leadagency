/**
 * Mission and campaign lookup. Both tools resolve the mission filter through
 * `resolveMissionScope`, which throws on any id outside the caller's perimeter.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AIRequestContext, ToolAuthorizationError } from "../types";
import { resolveMissionScope } from "../scope";
import { clampLimit, defineTool, strictArgs } from "../helpers";
import { sanitizeUntrusted } from "../redact";

const campaignsArgs = strictArgs({
    missionId: z.string().min(1).optional(),
    activeOnly: z.boolean().optional(),
    limit: z.number().int().optional(),
});

export const getMyCampaigns = defineTool({
    name: "get_my_campaigns",
    description:
        "Liste les campagnes accessibles a l'utilisateur, avec leur mission, leur client " +
        "et le volume d'actions. A utiliser pour 'quelles campagnes tournent', " +
        "'sur quoi je travaille', ou pour trouver l'id d'une campagne avant un calcul de metriques.",
    parameters: {
        type: "object",
        properties: {
            missionId: { type: "string", description: "Restreindre a une mission precise." },
            activeOnly: { type: "boolean", description: "Ne garder que les campagnes actives." },
            limit: { type: "integer", description: "Nombre max de campagnes (1-50, defaut 20)." },
        },
        additionalProperties: false,
    },
    schema: campaignsArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT", "BUSINESS_DEVELOPER"],
    execute: async (args: z.infer<typeof campaignsArgs>, ctx: AIRequestContext) => {
        const missionIds = resolveMissionScope(ctx, args.missionId);
        const where: Record<string, unknown> = {};
        if (missionIds !== null) where.missionId = { in: missionIds };
        if (args.activeOnly) where.isActive = true;

        const campaigns = await prisma.campaign.findMany({
            where,
            select: {
                id: true,
                name: true,
                icp: true,
                isActive: true,
                createdAt: true,
                mission: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        client: { select: { id: true, name: true } },
                    },
                },
                _count: { select: { actions: true } },
            },
            orderBy: { createdAt: "desc" },
            take: clampLimit(args.limit),
        });

        return {
            count: campaigns.length,
            campaigns: campaigns.map((c) => ({
                id: c.id,
                // ICP is manager-authored free text: sanitize before it reaches the model.
                name: sanitizeUntrusted(c.name, 160),
                icp: sanitizeUntrusted(c.icp, 300),
                isActive: c.isActive,
                actionsCount: c._count.actions,
                mission: {
                    id: c.mission.id,
                    name: sanitizeUntrusted(c.mission.name, 160),
                    status: c.mission.status,
                },
                client: {
                    id: c.mission.client.id,
                    name: sanitizeUntrusted(c.mission.client.name, 160),
                },
            })),
        };
    },
});

const missionStatusArgs = strictArgs({ missionId: z.string().min(1) });

export const getMissionStatus = defineTool({
    name: "get_mission_status",
    description:
        "Retourne le detail d'une mission: client, statut, canaux, objectif, dates, " +
        "SDR assignes, campagnes et listes. A utiliser pour 'ou en est la mission X'.",
    parameters: {
        type: "object",
        properties: {
            missionId: { type: "string", description: "Identifiant de la mission." },
        },
        required: ["missionId"],
        additionalProperties: false,
    },
    schema: missionStatusArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT", "BUSINESS_DEVELOPER"],
    execute: async (args: z.infer<typeof missionStatusArgs>, ctx: AIRequestContext) => {
        // Throws before any query when the mission is out of perimeter.
        resolveMissionScope(ctx, args.missionId);

        const mission = await prisma.mission.findUnique({
            where: { id: args.missionId },
            select: {
                id: true,
                name: true,
                objective: true,
                status: true,
                isActive: true,
                channel: true,
                channels: true,
                startDate: true,
                endDate: true,
                client: { select: { id: true, name: true } },
                sdrAssignments: {
                    select: { sdr: { select: { id: true, name: true, isActive: true } } },
                },
                campaigns: {
                    select: { id: true, name: true, isActive: true },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
                lists: {
                    where: { isArchived: false },
                    select: { id: true, name: true, type: true, isActive: true },
                    take: 20,
                },
            },
        });

        if (!mission) {
            throw new ToolAuthorizationError("Mission introuvable.", "not_found");
        }

        return {
            id: mission.id,
            name: sanitizeUntrusted(mission.name, 160),
            objective: sanitizeUntrusted(mission.objective, 300),
            status: mission.status,
            isActive: mission.isActive,
            channels: mission.channels?.length ? mission.channels : [mission.channel],
            startDate: mission.startDate,
            endDate: mission.endDate,
            client: {
                id: mission.client.id,
                name: sanitizeUntrusted(mission.client.name, 160),
            },
            sdrs: mission.sdrAssignments.map((a) => ({
                id: a.sdr.id,
                name: sanitizeUntrusted(a.sdr.name, 120),
                isActive: a.sdr.isActive,
            })),
            campaigns: mission.campaigns.map((c) => ({
                id: c.id,
                name: sanitizeUntrusted(c.name, 160),
                isActive: c.isActive,
            })),
            lists: mission.lists.map((l) => ({
                id: l.id,
                name: sanitizeUntrusted(l.name, 160),
                type: l.type,
                isActive: l.isActive,
            })),
        };
    },
});
