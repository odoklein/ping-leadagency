/**
 * Builds the per-request authorization envelope (`AIRequestContext`).
 *
 * This is the single place where "what can this user reach?" is answered.
 * Every AI tool consumes the result; none of them re-derive it.
 */

import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AIRequestContext, ToolAuthorizationError } from "./types";
import { resolveScope, ScopeInputs } from "./scope";
import { MAX_WRITE_CALLS_PER_REQUEST } from "./helpers";

/**
 * Effective permission codes for a user: role defaults, then per-user overrides.
 * Mirrors `GET /api/users/[id]/permissions`.
 */
export async function getEffectivePermissions(
    userId: string,
    role: UserRole
): Promise<string[]> {
    const [rolePermissions, userPermissions] = await Promise.all([
        prisma.rolePermission.findMany({
            where: { role, granted: true },
            select: { permission: { select: { code: true } } },
        }),
        prisma.userPermission.findMany({
            where: { userId },
            select: { granted: true, permission: { select: { code: true } } },
        }),
    ]);

    const effective = new Set(rolePermissions.map((rp) => rp.permission.code));
    for (const up of userPermissions) {
        if (up.granted) effective.add(up.permission.code);
        else effective.delete(up.permission.code);
    }
    return Array.from(effective);
}

/** Missions the user may read, resolved per role. */
async function fetchScopedMissions(
    userId: string,
    role: UserRole,
    ownClientId: string | null,
    portfolioClientIds: string[]
): Promise<Array<{ id: string; clientId: string }>> {
    const select = { id: true, clientId: true } as const;

    switch (role) {
        case "MANAGER":
            // Global scope — no need to materialize every mission id.
            return [];

        case "SDR":
        case "BOOKER":
            return prisma.mission.findMany({
                where: { sdrAssignments: { some: { sdrId: userId } } },
                select,
            });

        case "CLIENT":
        case "COMMERCIAL":
            if (!ownClientId) return [];
            return prisma.mission.findMany({ where: { clientId: ownClientId }, select });

        case "BUSINESS_DEVELOPER":
            if (portfolioClientIds.length === 0) return [];
            return prisma.mission.findMany({
                where: { clientId: { in: portfolioClientIds } },
                select,
            });

        default:
            return [];
    }
}

/**
 * Resolve the full scope for an authenticated session.
 * Throws when the account is disabled — a valid JWT is not enough.
 */
export async function buildAIRequestContext(
    session: Session
): Promise<AIRequestContext> {
    const sessionUser = session?.user;
    if (!sessionUser?.id) {
        throw new ToolAuthorizationError("Session invalide.", "unauthenticated");
    }

    // Re-read from the DB rather than trusting the 8h-lived JWT: role, tenant and
    // activation can all change mid-session.
    const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
            id: true,
            role: true,
            isActive: true,
            clientId: true,
            interlocuteurId: true,
        },
    });

    if (!user) {
        throw new ToolAuthorizationError("Utilisateur introuvable.", "unauthenticated");
    }
    if (!user.isActive) {
        throw new ToolAuthorizationError("Compte désactivé.", "inactive_account");
    }

    const portfolioClientIds =
        user.role === "BUSINESS_DEVELOPER"
            ? (
                  await prisma.businessDeveloperClient.findMany({
                      where: { bdUserId: user.id, isActive: true },
                      select: { clientId: true },
                  })
              ).map((row) => row.clientId)
            : [];

    const [missions, permissions] = await Promise.all([
        fetchScopedMissions(user.id, user.role, user.clientId, portfolioClientIds),
        getEffectivePermissions(user.id, user.role),
    ]);

    const inputs: ScopeInputs = {
        userId: user.id,
        role: user.role,
        isActive: user.isActive,
        ownClientId: user.clientId,
        interlocuteurId: user.interlocuteurId,
        missions,
        portfolioClientIds,
        permissions,
    };

    return { ...resolveScope(inputs), writeBudgetRemaining: MAX_WRITE_CALLS_PER_REQUEST };
}

/** Compact, model-facing description of the caller's scope. */
export function describeScopeForPrompt(ctx: AIRequestContext): string {
    const lines = [
        `- Rôle: ${ctx.role}`,
        ctx.isGlobalScope
            ? "- Périmètre: agence entière (tous les clients)."
            : `- Périmètre: ${ctx.clientIds.length} client(s), ${ctx.missionIds.length} mission(s).`,
    ];
    if (!ctx.isGlobalScope && ctx.sdrIds.length === 1) {
        lines.push("- Les données d'activité sont limitées à cet utilisateur.");
    }
    if (ctx.role === "COMMERCIAL") {
        lines.push("- Seuls les RDV de son interlocuteur sont visibles.");
    }
    lines.push(`- Données à jour au ${ctx.resolvedAt.toISOString()}.`);
    return `## Périmètre d'accès de l'utilisateur\n${lines.join("\n")}`;
}
