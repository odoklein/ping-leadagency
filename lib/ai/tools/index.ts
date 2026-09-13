/**
 * Public surface of the AI authorization / tool layer.
 *
 * Import from here, not from the internal modules, so the boundary stays
 * reviewable in one place.
 */

export type {
    AIRequestContext,
    ToolDefinition,
    ToolExecutionResult,
    JsonSchemaObject,
} from "./types";
export {
    ToolAuthorizationError,
    ToolNotFoundError,
    ToolValidationError,
} from "./types";

export { buildAIRequestContext, describeScopeForPrompt, getEffectivePermissions } from "./context";
export {
    GLOBAL_SCOPE_ROLES,
    buildActionScopeWhere,
    hasEmptyScope,
    resolveClientScope,
    resolveMissionScope,
    resolveScope,
    resolveSdrScope,
} from "./scope";
export type { ScopeInputs } from "./scope";

export { authorizeToolCall, checkToolAccess, listAccessibleTools, parseToolArguments } from "./guard";
export { AI_TOOLS, getTool, getToolsForContext, toMistralTools } from "./registry";
export {
    MAX_TOOL_CALLS_PER_REQUEST,
    executeToolCall,
    serializeToolResult,
} from "./executor";
export { MAX_LOOP_ITERATIONS, buildToolUsagePrompt, runToolLoop } from "./loop";
export type { ToolLoopInput, ToolLoopOutput } from "./loop";
export { REDACTED, sanitizeUntrusted, scrubSensitive, wrapToolPayload } from "./redact";
