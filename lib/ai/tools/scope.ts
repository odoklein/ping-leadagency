/**
 * Pure resource-scope logic.
 *
 * Nothing here touches the database, so every rule below is unit-testable
 * without a Postgres connection. `context.ts` does the I/O and feeds the raw
 * records into `resolveScope()`.
 */

import type { UserRole } from "@prisma/client";
import { AIRequestContext, ToolAuthorizationError } from "./types";

/** Roles allowed to read agency-wide, across every tenant. */
export const GLOBAL_SCOPE_ROLES: UserRole[] = ["MANAGER"];

/** Raw records `context.ts` reads from the DB before scope is computed. */
export interface ScopeInputs {
    userId: string;
    role: UserRole;
    isActive: boolean;
    /** `User.clientId` — set for CLIENT and (usually) COMMERCIAL users. */
    ownClientId: string | null;
    /** `User.interlocuteurId` — set for COMMERCIAL users. */
    interlocuteurId: string | null;
    /** Missions reachable by this user: `{ id, clientId }`. */
    missions: Array<{ id: string; clientId: string }>;
    /** Client ids from an explicit portfolio (BUSINESS_DEVELOPER). */
    portfolioClientIds: string[];
    /** Effective permission codes. */
    permissions: string[];
    resolvedAt?: Date;
}

function unique(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

/**
 * Turn raw membership records into the immutable scope envelope.
 *
 * Fail-closed: any role not explicitly handled gets an empty scope, which makes
 * every scoped query return nothing rather than everything.
 */
export function resolveScope(input: ScopeInputs): AIRequestContext {
    const base = {
        userId: input.userId,
        role: input.role,
        isActive: input.isActive,
        clientId: input.ownClientId,
        interlocuteurId: input.interlocuteurId,
        permissions: [...input.permissions],
        resolvedAt: input.resolvedAt ?? new Date(),
    };

    const missionIds = unique(input.missions.map((m) => m.id));
    const missionClientIds = unique(input.missions.map((m) => m.clientId));

    switch (input.role) {
        case "MANAGER":
            return {
                ...base,
                clientIds: [],
                missionIds: [],
                sdrIds: [],
                isGlobalScope: true,
            };

        case "CLIENT":
            return {
                ...base,
                clientIds: unique([input.ownClientId]),
                missionIds,
                // A client reads its own campaigns' results, whichever SDR produced them.
                sdrIds: [],
                isGlobalScope: false,
            };

        case "SDR":
        case "BOOKER":
            return {
                ...base,
                clientIds: missionClientIds,
                missionIds,
                sdrIds: [input.userId],
                isGlobalScope: false,
            };

        case "BUSINESS_DEVELOPER":
            return {
                ...base,
                clientIds: unique(input.portfolioClientIds),
                missionIds,
                sdrIds: [],
                isGlobalScope: false,
            };

        case "COMMERCIAL":
            return {
                ...base,
                clientIds: unique([input.ownClientId]),
                missionIds,
                sdrIds: [],
                isGlobalScope: false,
            };

        // DEVELOPER and anything added to UserRole later: no business-data scope.
        default:
            return {
                ...base,
                clientIds: [],
                missionIds: [],
                sdrIds: [],
                isGlobalScope: false,
            };
    }
}

// ============================================
// SCOPE GUARDS
// ============================================

/**
 * Narrow a requested mission id against the caller's scope.
 *
 * - global scope + no request  → `null` (no mission filter)
 * - global scope + request     → that single mission
 * - scoped + no request        → every mission in scope (possibly `[]` = nothing)
 * - scoped + out-of-scope id   → throws
 */
export function resolveMissionScope(
    ctx: AIRequestContext,
    requestedMissionId?: string | null
): string[] | null {
    if (requestedMissionId) {
        if (!ctx.isGlobalScope && !ctx.missionIds.includes(requestedMissionId)) {
            throw new ToolAuthorizationError(
                "Mission hors de votre périmètre d'accès.",
                "out_of_scope"
            );
        }
        return [requestedMissionId];
    }
    return ctx.isGlobalScope ? null : ctx.missionIds;
}

/** Same contract as `resolveMissionScope`, for client ids. */
export function resolveClientScope(
    ctx: AIRequestContext,
    requestedClientId?: string | null
): string[] | null {
    if (requestedClientId) {
        if (!ctx.isGlobalScope && !ctx.clientIds.includes(requestedClientId)) {
            throw new ToolAuthorizationError(
                "Client hors de votre périmètre d'accès.",
                "out_of_scope"
            );
        }
        return [requestedClientId];
    }
    return ctx.isGlobalScope ? null : ctx.clientIds;
}

/**
 * Which SDR's activity the caller may read.
 * Non-global callers with a personal scope can never widen it to someone else.
 */
export function resolveSdrScope(
    ctx: AIRequestContext,
    requestedSdrId?: string | null
): string[] | null {
    if (requestedSdrId) {
        if (!ctx.isGlobalScope && !ctx.sdrIds.includes(requestedSdrId)) {
            throw new ToolAuthorizationError(
                "Données d'un autre utilisateur hors de votre périmètre d'accès.",
                "out_of_scope"
            );
        }
        return [requestedSdrId];
    }
    if (ctx.isGlobalScope) return null;
    // Empty sdrIds (CLIENT, BD) means "not filtered by SDR" — the client/mission
    // filter already bounds the query.
    return ctx.sdrIds.length > 0 ? ctx.sdrIds : null;
}

/**
 * Build the Prisma `where` fragment that binds an Action query to the caller.
 * Always goes through campaign → mission, the real tenant chain.
 */
export function buildActionScopeWhere(
    ctx: AIRequestContext,
    options: { missionId?: string | null; sdrId?: string | null } = {}
): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    const missionIds = resolveMissionScope(ctx, options.missionId);
    if (missionIds !== null) {
        where.campaign = { is: { missionId: { in: missionIds } } };
    }

    const sdrIds = resolveSdrScope(ctx, options.sdrId);
    if (sdrIds !== null) {
        where.sdrId = { in: sdrIds };
    }

    if (ctx.role === "COMMERCIAL") {
        // Hard floor: a commercial only ever sees their own interlocuteur's meetings.
        where.interlocuteurId = ctx.interlocuteurId ?? "__none__";
    }

    return where;
}

/** True when the caller provably has access to nothing. Lets tools answer fast. */
export function hasEmptyScope(ctx: AIRequestContext): boolean {
    return (
        !ctx.isGlobalScope &&
        ctx.clientIds.length === 0 &&
        ctx.missionIds.length === 0
    );
}
