/**
 * Shared plumbing for tool definitions.
 */

import { z } from "zod";
import { JsonSchemaObject, ToolDefinition } from "./types";

/**
 * Hard cap on *mutating* tool calls per assistant request. Reads are cheap to
 * retry; writes are not. One user message creates at most one ticket, however
 * many times the model asks.
 *
 * Lives here rather than in executor.ts so `context.ts` can seed the budget
 * without importing the executor (which would close an import cycle through the
 * registry and every tool definition).
 */
export const MAX_WRITE_CALLS_PER_REQUEST = 1;

/**
 * Declare a tool. Keeps the model-facing JSON Schema and the server-side Zod
 * schema side by side so they cannot drift apart unnoticed.
 */
export function defineTool<TArgs, TResult>(
    definition: Omit<ToolDefinition<TArgs, TResult>, "mutates">
): ToolDefinition<TArgs, TResult> {
    return { ...definition, mutates: false };
}

/**
 * Declare a tool with side effects. Deliberately a separate constructor from
 * `defineTool` so every write in the system is greppable by name, and so a read
 * tool can never become a write tool by editing one word.
 */
export function defineWriteTool<TArgs, TResult>(
    definition: Omit<ToolDefinition<TArgs, TResult>, "mutates">
): ToolDefinition<TArgs, TResult> {
    return { ...definition, mutates: true };
}

/** Zod object that rejects unknown keys — the model must not smuggle extras. */
export function strictArgs<T extends z.ZodRawShape>(shape: T) {
    return z.object(shape).strict();
}

/** Empty-argument tools still get a schema, so the guard path stays uniform. */
export const noArgsSchema = z.object({}).strict();

export const noArgsParameters: JsonSchemaObject = {
    type: "object",
    properties: {},
    additionalProperties: false,
};

export const isoDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu: YYYY-MM-DD");

/** Absolute ceiling on rows any single tool may return. */
export const MAX_ROWS = 50;

export function clampLimit(limit: number | undefined, fallback = 20): number {
    if (!limit || Number.isNaN(limit)) return fallback;
    return Math.min(MAX_ROWS, Math.max(1, Math.floor(limit)));
}

export interface DateRange {
    from: Date;
    to: Date;
}

/**
 * Resolve an optional YYYY-MM-DD range, defaulting to the last 30 days.
 * `to` is inclusive of the whole day.
 */
export function resolveDateRange(from?: string, to?: string): DateRange {
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    const start = from
        ? new Date(`${from}T00:00:00.000Z`)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Plage de dates invalide.");
    }
    return { from: start, to: end };
}

export type ActivityPeriod = "today" | "week" | "month";

/** Period presets, anchored on UTC day boundaries. */
export function resolvePeriod(period: ActivityPeriod): DateRange {
    const now = new Date();
    const startOfDay = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    if (period === "today") return { from: startOfDay, to: now };
    if (period === "week") {
        // ISO week: Monday-anchored.
        const dayOfWeek = (startOfDay.getUTCDay() + 6) % 7;
        const monday = new Date(startOfDay.getTime() - dayOfWeek * 86400000);
        return { from: monday, to: now };
    }
    return {
        from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        to: now,
    };
}

export function percent(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
}
