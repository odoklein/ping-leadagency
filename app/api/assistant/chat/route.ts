import { NextRequest } from "next/server";
import { z } from "zod";
import {
    errorResponse,
    requireRole,
    successResponse,
    validateRequest,
    withErrorHandler,
} from "@/lib/api-utils";
import {
    ASSISTANT_PROMPT_VERSION,
    getCaptainAssistantSystemPrompt,
} from "@/lib/assistant/systemPrompt";
import {
    AssistantRuntimeContext,
    buildAssistantRuntimeContextPrompt,
} from "@/lib/assistant/context";
import { prisma } from "@/lib/prisma";
import {
    buildMemoryContextSnippet,
    buildSessionSummary,
    normalizeAssistantMemoryStore,
    upsertConversation,
} from "@/lib/assistant/memory";
import { recordAssistantTurn } from "@/lib/assistant/transcripts";
import { buildManagerLiveDataContext } from "@/lib/assistant/managerLiveData";
import { buildDocsContext } from "@/lib/assistant/docs/loader";
import { MistralError } from "@/lib/ai/mistral";
import {
    ToolAuthorizationError,
    buildAIRequestContext,
    buildToolUsagePrompt,
    describeScopeForPrompt,
    runToolLoop,
} from "@/lib/ai/tools";

const messageSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(8000),
});

const chatRequestSchema = z.object({
    messages: z.array(messageSchema).min(1).max(40),
    context: z
        .object({
            role: z.string().optional(),
            pathname: z.string().optional(),
            missionName: z.string().optional(),
            currentPage: z.string().optional(),
        })
        .optional(),
    sessionId: z.string().max(120).optional(),
    conversationId: z.string().max(120).optional(),
    temperature: z.number().min(0).max(1).optional(),
});

function buildSystemPrompt(parts: {
    runtime?: AssistantRuntimeContext;
    memoryContext?: string;
    scopeContext: string;
    toolContext: string;
}): string {
    const base = getCaptainAssistantSystemPrompt();
    const runtimeContext = buildAssistantRuntimeContextPrompt(parts.runtime);
    const safety = `Additional constraints:
- Keep answers concise and actionable.
- If process-oriented, use numbered steps.
- If unsure about a feature state, say "this is coming soon" instead of inventing behavior.
- Ask at most one clarifying question only when absolutely required.
- Respect role boundaries when describing who can access what.
- Use conversation memory when relevant, but prioritize the most recent user instruction.
- When live operational data is provided in context, answer with concrete facts first (names, counts, missions), then optional guidance.
- Do not replace factual answer with generic "go to this page" instructions if data is already available.`;

    return [
        base,
        runtimeContext,
        parts.scopeContext,
        parts.toolContext,
        parts.memoryContext,
        safety,
    ]
        .filter(Boolean)
        .join("\n\n");
}

function truncateConversation(
    messages: Array<{ role: "user" | "assistant"; content: string }>
) {
    return messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content.trim(),
    }));
}

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(
        ["SDR", "BOOKER", "MANAGER", "CLIENT", "BUSINESS_DEVELOPER", "DEVELOPER", "COMMERCIAL"],
        request
    );

    const startedAt = Date.now();
    const payload = await validateRequest(request, chatRequestSchema);
    const messages = truncateConversation(payload.messages);
    const latestUserQuestion =
        [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const temperature = payload.temperature ?? 0.3;

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        return errorResponse("Aucun fournisseur IA configure (MISTRAL_API_KEY).", 500);
    }

    // Resolve the caller's data perimeter once. Every tool call is bound to it.
    let aiContext;
    try {
        aiContext = await buildAIRequestContext(session);
    } catch (error) {
        if (error instanceof ToolAuthorizationError) {
            return errorResponse(error.message, 403);
        }
        throw error;
    }

    const fallbackConversationId =
        payload.conversationId ||
        payload.sessionId ||
        (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `conv-${Date.now()}`);

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
    });
    const preferences = ((user?.preferences as Record<string, unknown>) || {});
    const memoryStore = normalizeAssistantMemoryStore(preferences.assistantMemory);
    const conversationId =
        payload.conversationId || memoryStore.activeConversationId || fallbackConversationId;
    const memoryContext = buildMemoryContextSnippet(memoryStore, conversationId);

    // Stamped after the id is resolved so tools can reference the exchange.
    aiContext.conversationId = conversationId;

    const managerLiveContext =
        aiContext.isGlobalScope && latestUserQuestion
            ? await buildManagerLiveDataContext(latestUserQuestion)
            : "";

    // Docs stay pre-injected for the common "how do I…" case; search_ping_help
    // remains available when the model needs to dig further.
    const docsContext = latestUserQuestion
        ? buildDocsContext(
              payload.context?.pathname || "",
              latestUserQuestion,
              session.user.role || ""
          )
        : "";

    const systemPrompt = buildSystemPrompt({
        runtime: payload.context,
        memoryContext: [memoryContext, docsContext, managerLiveContext]
            .filter(Boolean)
            .join("\n\n"),
        scopeContext: describeScopeForPrompt(aiContext),
        toolContext: buildToolUsagePrompt(aiContext),
    });

    try {
        const result = await runToolLoop({
            systemPrompt,
            messages,
            ctx: aiContext,
            apiKey,
            temperature,
        });

        console.info("[assistant.chat]", {
            provider: result.provider,
            model: result.model,
            promptVersion: ASSISTANT_PROMPT_VERSION,
            role: aiContext.role,
            sessionId: payload.sessionId ?? null,
            conversationId,
            iterations: result.iterations,
            toolCalls: result.toolCalls.map((t) => `${t.tool}:${t.ok ? "ok" : t.errorCode}`),
            durationMs: Date.now() - startedAt,
            tokens: result.usage.totalTokens,
        });

        if (latestUserQuestion) {
            const savedStore = upsertConversation(
                memoryStore,
                conversationId,
                [
                    {
                        role: "user",
                        content: latestUserQuestion,
                        createdAt: new Date().toISOString(),
                    },
                    {
                        role: "assistant",
                        content: result.answer,
                        createdAt: new Date().toISOString(),
                    },
                ],
                undefined
            );
            const targetSession = savedStore.sessions.find((s) => s.id === conversationId);
            if (targetSession) {
                targetSession.summary = buildSessionSummary(targetSession.messages);
            }

            // Durable transcript for the manager observability view. Fire and
            // forget: the answer is already on its way to the user.
            void recordAssistantTurn({
                userId: session.user.id,
                userRole: aiContext.role,
                clientId: aiContext.clientId,
                conversationId,
                question: latestUserQuestion,
                answer: result.answer,
                model: result.model,
                toolCalls: result.toolCalls,
                latencyMs: Date.now() - startedAt,
                totalTokens: result.usage.totalTokens,
            });

            // Non-blocking memory save; do not fail response if persistence fails.
            prisma.user
                .update({
                    where: { id: session.user.id },
                    data: {
                        preferences: {
                            ...preferences,
                            assistantMemory: savedStore,
                        },
                    },
                })
                .catch((e) => console.error("Assistant memory save failed:", e));
        }

        return successResponse({
            answer: result.answer,
            provider: result.provider,
            model: result.model,
            usage: result.usage,
            toolCalls: result.toolCalls,
            promptVersion: ASSISTANT_PROMPT_VERSION,
            conversationId,
        });
    } catch (error) {
        // Provider failures (rate limit, tier, outage) are not server bugs: surface
        // the real status and an actionable message instead of a blanket 500.
        if (error instanceof MistralError) {
            console.warn("[assistant.chat] provider error:", error.code, error.message);
            return errorResponse(error.userMessage, error.status === 401 ? 500 : error.status);
        }
        console.error("Assistant chat error:", error);
        return errorResponse(
            error instanceof Error ? error.message : "Assistant request failed",
            500
        );
    }
});
