/**
 * The tool registry — the exhaustive list of what the AI is allowed to do.
 *
 * If a capability is not in this array, the model cannot reach it. Adding an
 * entry is the only way to widen the AI's surface, which makes this file the
 * review checkpoint for every future expansion.
 */

import type { MistralToolSpec } from "@/lib/ai/mistral";
import { AIRequestContext, AnyToolDefinition } from "./types";
import { listAccessibleTools } from "./guard";
import { getMyPermissions, getMyProfile } from "./definitions/profile";
import { getMissionStatus, getMyCampaigns } from "./definitions/missions";
import { getActivitySummary, getCampaignMetrics } from "./definitions/metrics";
import { getMyMeetings } from "./definitions/meetings";
import { getListHealth, getProspectHistory } from "./definitions/prospects";
import { searchPingHelp } from "./definitions/knowledge";
import { createSupportTicketTool, getMyTickets } from "./definitions/support";

/**
 * The catalogue. Reads are the default; the WRITE section below is the entire
 * mutating surface of the assistant and should stay short enough to review at a
 * glance. Every write tool is built with `defineWriteTool`, so `grep
 * defineWriteTool lib/ai/tools/definitions` lists them all.
 */
export const AI_TOOLS: AnyToolDefinition[] = [
    // Identity & entitlements
    getMyProfile,
    getMyPermissions,
    // Structure
    getMyCampaigns,
    getMissionStatus,
    // Performance
    getCampaignMetrics,
    getActivitySummary,
    // Operations
    getMyMeetings,
    getProspectHistory,
    getListHealth,
    // Product knowledge
    searchPingHelp,
    // Support (read)
    getMyTickets,

    // ── WRITE ────────────────────────────────────────────────────────────────
    // Side effects live here and nowhere else. Capped at
    // MAX_WRITE_CALLS_PER_REQUEST successful calls per assistant turn.
    createSupportTicketTool,
];

const BY_NAME = new Map(AI_TOOLS.map((tool) => [tool.name, tool]));

if (BY_NAME.size !== AI_TOOLS.length) {
    throw new Error("Duplicate tool name in AI_TOOLS registry");
}

export function getTool(name: string): AnyToolDefinition | undefined {
    return BY_NAME.get(name);
}

export function getToolsForContext(ctx: AIRequestContext): AnyToolDefinition[] {
    return listAccessibleTools(AI_TOOLS, ctx);
}

/** Mistral function-calling schema for the tools this caller may use. */
export function toMistralTools(ctx: AIRequestContext): MistralToolSpec[] {
    return getToolsForContext(ctx).map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as unknown as Record<string, unknown>,
        },
    }));
}
