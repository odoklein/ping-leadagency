/**
 * Executes one tool call: guard, run, scrub, wrap.
 *
 * Failures are returned, not thrown: a denied or invalid call is fed back to the
 * model as a structured error so it can apologise or retry a different tool,
 * while the caller keeps the audit line.
 */

import {
    AIRequestContext,
    ToolAuthorizationError,
    ToolExecutionResult,
    ToolNotFoundError,
    ToolValidationError,
} from "./types";
import { authorizeToolCall } from "./guard";
import { getTool } from "./registry";
import { wrapToolPayload } from "./redact";

/** Hard cap on tool calls per assistant request (risk R3: amplification). */
export const MAX_TOOL_CALLS_PER_REQUEST = 6;

export interface ToolCallRequest {
    id: string;
    name: string;
    /** Raw JSON string emitted by the model, or an already-parsed object. */
    arguments: string | Record<string, unknown>;
}

function parseArguments(raw: string | Record<string, unknown>): unknown {
    if (typeof raw !== "string") return raw ?? {};
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
        return JSON.parse(trimmed);
    } catch {
        throw new ToolValidationError("Les arguments ne sont pas un JSON valide.");
    }
}

function toErrorPayload(error: unknown): { code: string; message: string } {
    if (
        error instanceof ToolAuthorizationError ||
        error instanceof ToolValidationError ||
        error instanceof ToolNotFoundError
    ) {
        return { code: error.code, message: error.message };
    }
    // Internal failures must not leak stack traces or SQL to the model.
    console.error("[ai.tool] execution failed:", error);
    return { code: "tool_failed", message: "L'outil n'a pas pu s'executer." };
}

export async function executeToolCall(
    call: ToolCallRequest,
    ctx: AIRequestContext
): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    try {
        const tool = getTool(call.name);
        const args = authorizeToolCall(tool, call.name, parseArguments(call.arguments), ctx);
        const data = await tool!.execute(args, ctx);

        return {
            tool: call.name,
            ok: true,
            data,
            durationMs: Date.now() - startedAt,
        };
    } catch (error) {
        return {
            tool: call.name,
            ok: false,
            error: toErrorPayload(error),
            durationMs: Date.now() - startedAt,
        };
    }
}

/** Serialize a result for the `tool` message sent back to the model. */
export function serializeToolResult(result: ToolExecutionResult): string {
    if (!result.ok) {
        return JSON.stringify({
            tool: result.tool,
            error: result.error,
            _note: "Cet outil a echoue ou a ete refuse. Expliquer la limite a l'utilisateur, ne pas inventer de donnees.",
        });
    }
    return wrapToolPayload(result.tool, result.data);
}
