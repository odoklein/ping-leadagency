/**
 * Identity and entitlement tools. Always scoped to the caller — these tools
 * take no user id, so there is no way to point them at somebody else.
 */

import { prisma } from "@/lib/prisma";
import { AIRequestContext } from "../types";
import { defineTool, noArgsParameters, noArgsSchema } from "../helpers";

export const getMyProfile = defineTool({
    name: "get_my_profile",
    description:
        "Retourne le profil de l'utilisateur connecte: nom, email, role, client rattache, " +
        "missions accessibles et perimetre de donnees. A utiliser pour repondre a " +
        "'qui suis-je', 'a quelles missions ai-je acces', ou avant un diagnostic d'acces.",
    parameters: noArgsParameters,
    schema: noArgsSchema,
    allowedRoles: [
        "SDR",
        "BOOKER",
        "MANAGER",
        "CLIENT",
        "DEVELOPER",
        "BUSINESS_DEVELOPER",
        "COMMERCIAL",
    ],
    execute: async (_args: Record<string, never>, ctx: AIRequestContext) => {
        const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                timezone: true,
                lastSignInAt: true,
                client: { select: { id: true, name: true } },
            },
        });

        // Managers are global: listing every mission would be noise, not scope.
        const missions = ctx.isGlobalScope
            ? []
            : await prisma.mission.findMany({
                  where: { id: { in: ctx.missionIds } },
                  select: {
                      id: true,
                      name: true,
                      status: true,
                      channels: true,
                      client: { select: { id: true, name: true } },
                  },
                  orderBy: { startDate: "desc" },
                  take: 25,
              });

        return {
            profile: user,
            scope: {
                isGlobalScope: ctx.isGlobalScope,
                clientCount: ctx.isGlobalScope ? "all" : ctx.clientIds.length,
                missionCount: ctx.isGlobalScope ? "all" : ctx.missionIds.length,
                seesOnlyOwnActivity: !ctx.isGlobalScope && ctx.sdrIds.length === 1,
            },
            missions,
        };
    },
});

export const getMyPermissions = defineTool({
    name: "get_my_permissions",
    description:
        "Retourne la liste des codes de permission effectifs de l'utilisateur connecte " +
        "(permissions du role + surcharges individuelles). A utiliser pour expliquer " +
        "pourquoi une page ou une fonctionnalite est inaccessible.",
    parameters: noArgsParameters,
    schema: noArgsSchema,
    allowedRoles: [
        "SDR",
        "BOOKER",
        "MANAGER",
        "CLIENT",
        "DEVELOPER",
        "BUSINESS_DEVELOPER",
        "COMMERCIAL",
    ],
    execute: async (_args: Record<string, never>, ctx: AIRequestContext) => ({
        role: ctx.role,
        // Already resolved once per request — no second round-trip.
        permissions: [...ctx.permissions].sort(),
        count: ctx.permissions.length,
    }),
});
