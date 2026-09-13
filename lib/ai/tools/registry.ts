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

/** Phase 1 catalogue: read-only, no side effects. */
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
