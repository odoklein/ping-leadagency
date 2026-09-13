/**
 * Authorization / resource-scope foundation for the Ping AI assistant.
 *
 * Core principle: the AI model NEVER touches Prisma. It can only name a tool
 * from the registry; the guard then decides whether that tool may run, and the
 * tool resolves its own data through an explicitly scoped query.
 */

import { z } from "zod";
import type { UserRole } from "@prisma/client";

// ============================================
// REQUEST SCOPE
// ============================================

/**
 * The complete, pre-resolved authorization envelope for one assistant request.
 * Built once per request by `buildAIRequestContext()` and passed to every tool.
 *
 * Scope invariant:
 *   `isGlobalScope === false` means the user may ONLY see data reachable from
 *   `clientIds` / `missionIds` / `sdrIds`. An empty array means "nothing",
 *   never "everything".
 */
export interface AIRequestContext {
    userId: string;
    role: UserRole;
    isActive: boolean;

    /** Own tenant for CLIENT/COMMERCIAL users; null for internal roles. */
    clientId: string | null;
    /** Every client this user may read. Ignored when `isGlobalScope`. */
    clientIds: string[];
    /** Every mission this user may read. Ignored when `isGlobalScope`. */
    missionIds: string[];
    /** Whose action data this user may read. Ignored when `isGlobalScope`. */
    sdrIds: string[];
    /** COMMERCIAL users only see meetings booked for their interlocuteur. */
    interlocuteurId: string | null;

    /** MANAGER only. Cross-tenant read across the whole agency. */
    isGlobalScope: boolean;

    /** Effective permission codes (RolePermission + UserPermission overrides). */
    permissions: string[];

    /** Resolution timestamp — surfaced to the model so it can date its answer. */
    resolvedAt: Date;
}

// ============================================
// TOOLS
// ============================================

/** JSON Schema fragment passed to Mistral's function-calling API. */
export interface JsonSchemaObject {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
    /** Snake_case name the model calls. Must be unique in the registry. */
    name: string;
    /** Shown to the model. Say what it returns AND when to use it. */
    description: string;
    /** Wire contract advertised to the model. */
    parameters: JsonSchemaObject;
    /** Server-side contract. Strict: unknown keys are rejected. */
    schema: z.ZodType<TArgs>;
    /** Roles allowed to invoke this tool at all. */
    allowedRoles: UserRole[];
    /** Effective permission codes required on top of the role check. */
    requiredPermissions?: string[];
    /** Read-only is the only supported mode in this phase. */
    mutates: false;
    /** Must never call Prisma without applying scope from `ctx`. */
    execute: (args: TArgs, ctx: AIRequestContext) => Promise<TResult>;
}

/**
 * A tool of unknown argument/result shape.
 *
 * `execute` is contravariant in its argument, so a heterogeneous registry cannot
 * be typed with `unknown` — the per-tool Zod schema is what actually narrows the
 * arguments before `execute` ever runs (see `guard.parseToolArguments`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any, any>;

// ============================================
// ERRORS
// ============================================

export class ToolAuthorizationError extends Error {
    readonly code: string;
    constructor(message: string, code = "forbidden") {
        super(message);
        this.name = "ToolAuthorizationError";
        this.code = code;
    }
}

export class ToolValidationError extends Error {
    readonly code = "invalid_arguments";
    constructor(message: string) {
        super(message);
        this.name = "ToolValidationError";
    }
}

export class ToolNotFoundError extends Error {
    readonly code = "unknown_tool";
    constructor(name: string) {
        super(`Unknown tool: ${name}`);
        this.name = "ToolNotFoundError";
    }
}

// ============================================
// EXECUTION RESULT
// ============================================

export interface ToolExecutionResult {
    tool: string;
    ok: boolean;
    /** Scrubbed + sanitized payload, safe to hand back to the model. */
    data?: unknown;
    error?: { code: string; message: string };
    durationMs: number;
}
