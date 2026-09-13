/**
 * Authorization guard — the single choke point between the model's intent and
 * Ping's data.
 *
 * Every check here is pure: it reads the pre-resolved `AIRequestContext` and the
 * tool definition, and returns allow/deny. No I/O, so it is fully unit-testable
 * and cannot be made to fail open by a slow or unreachable database.
 */

import { z } from "zod";
import {
    AIRequestContext,
    AnyToolDefinition,
    ToolAuthorizationError,
    ToolDefinition,
    ToolNotFoundError,
    ToolValidationError,
} from "./types";

export interface AccessDecision {
    allowed: boolean;
    reason?: string;
    code?: string;
}

/**
 * Role + permission + account-state check.
 * Order matters: cheapest and most fundamental denial first.
 */
export function checkToolAccess(
    tool: AnyToolDefinition,
    ctx: AIRequestContext
): AccessDecision {
    if (!ctx.isActive) {
        return { allowed: false, code: "inactive_account", reason: "Compte desactive." };
    }

    if (tool.mutates !== false) {
        // Belt and braces: this phase is read-only by construction.
        return {
            allowed: false,
            code: "write_disabled",
            reason: "Les actions d'ecriture ne sont pas activees.",
        };
    }

    if (!tool.allowedRoles.includes(ctx.role)) {
        return {
            allowed: false,
            code: "role_denied",
            reason: `Le role ${ctx.role} n'a pas acces a cet outil.`,
        };
    }

    const missing = (tool.requiredPermissions ?? []).filter(
        (code) => !ctx.permissions.includes(code)
    );
    if (missing.length > 0) {
        return {
            allowed: false,
            code: "permission_denied",
            reason: `Permission(s) manquante(s): ${missing.join(", ")}.`,
        };
    }

    return { allowed: true };
}

/**
 * Parse tool arguments against the server-side schema.
 * The model's JSON is untrusted input like any other request body.
 */
export function parseToolArguments<TArgs>(
    tool: ToolDefinition<TArgs, unknown>,
    rawArgs: unknown
): TArgs {
    const result = tool.schema.safeParse(rawArgs ?? {});
    if (!result.success) {
        const detail = result.error.issues
            .map((issue: z.ZodIssue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`)
            .join(", ");
        throw new ToolValidationError(`Arguments invalides pour ${tool.name}: ${detail}`);
    }
    return result.data;
}

/**
 * Full pre-execution gate: existence, access, argument validation.
 * Throws on denial so callers cannot forget to check a boolean.
 */
export function authorizeToolCall<TArgs>(
    tool: ToolDefinition<TArgs, unknown> | undefined,
    name: string,
    rawArgs: unknown,
    ctx: AIRequestContext
): TArgs {
    if (!tool) {
        throw new ToolNotFoundError(name);
    }

    const decision = checkToolAccess(tool, ctx);
    if (!decision.allowed) {
        throw new ToolAuthorizationError(
            decision.reason ?? "Acces refuse.",
            decision.code ?? "forbidden"
        );
    }

    return parseToolArguments(tool, rawArgs);
}

/** Tools this context may see at all — used to build the model's tool list. */
export function listAccessibleTools(
    tools: AnyToolDefinition[],
    ctx: AIRequestContext
): AnyToolDefinition[] {
    return tools.filter((tool) => checkToolAccess(tool, ctx).allowed);
}
