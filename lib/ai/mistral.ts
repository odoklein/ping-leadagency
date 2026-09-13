/**
 * Mistral AI API helper.
 * Defaults to 'mistral-small-latest' (or process.env.MISTRAL_MODEL) to ensure
 * compatibility across all subscription tiers (including standard/free tiers).
 */

export const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

export function getMistralModel(overrideModel?: string): string {
    return overrideModel || process.env.MISTRAL_MODEL || 'mistral-small-latest';
}

export interface MistralMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface MistralOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonResponse?: boolean;
}

/**
 * Execute fetch request to Mistral API with tier fallback.
 * If configured model returns 403 tier_not_allowed, automatically retries with mistral-small-latest.
 */
export async function mistralFetch(
    apiKey: string,
    payload: Record<string, unknown>
): Promise<Response> {
    const modelToUse = (payload.model as string) || getMistralModel();
    const body = { ...payload, model: modelToUse };

    let response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok && response.status === 403 && modelToUse !== 'mistral-small-latest') {
        try {
            const errorData = await response.clone().json();
            if (errorData?.type === 'tier_not_allowed' || errorData?.code === '1910' || errorData?.code === 1910) {
                console.warn(`Mistral model "${modelToUse}" restricted by tier. Falling back to "mistral-small-latest"...`);
                body.model = 'mistral-small-latest';
                response = await fetch(MISTRAL_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify(body),
                });
            }
        } catch {
            // Ignore clone/json parsing errors
        }
    }

    return response;
}

// ============================================
// MISTRAL LARGE + FUNCTION CALLING
// ============================================

/**
 * Default model for the tool-calling assistant.
 * Ping standardises on Mistral; Large is the reasoning tier used for anything
 * that has to choose between tools.
 */
export const MISTRAL_LARGE_MODEL = 'mistral-large-latest';

export function getMistralLargeModel(): string {
    return process.env.MISTRAL_LARGE_MODEL || MISTRAL_LARGE_MODEL;
}

export interface MistralToolCall {
    id?: string;
    type?: string;
    function: {
        name: string;
        arguments: string;
    };
}

/** A message in a tool-calling exchange (superset of MistralMessage). */
export interface MistralToolMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: MistralToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface MistralToolSpec {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface MistralChatResult {
    message: {
        role: string;
        content: string | null;
        tool_calls?: MistralToolCall[];
    };
    finishReason?: string;
    model?: string;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
}

/**
 * One round-trip to Mistral chat completions, with optional tools.
 * Throws on a non-2xx response so callers can surface a clean error.
 */
export async function mistralChat(
    apiKey: string,
    params: {
        messages: MistralToolMessage[];
        tools?: MistralToolSpec[];
        toolChoice?: 'auto' | 'none' | 'any';
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<MistralChatResult> {
    const payload: Record<string, unknown> = {
        model: params.model || getMistralLargeModel(),
        messages: params.messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? 1200,
    };

    if (params.tools && params.tools.length > 0) {
        payload.tools = params.tools;
        payload.tool_choice = params.toolChoice ?? 'auto';
    }

    const response = await mistralFetch(apiKey, payload);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message =
            (error as { message?: string; error?: { message?: string } })?.error?.message ||
            (error as { message?: string })?.message ||
            `Mistral request failed (${response.status})`;
        throw new Error(message);
    }

    const result = (await response.json()) as {
        model?: string;
        choices?: Array<{
            finish_reason?: string;
            message?: { role?: string; content?: string | null; tool_calls?: MistralToolCall[] };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = result.choices?.[0];
    if (!choice?.message) {
        throw new Error('Mistral returned an empty choice');
    }

    return {
        message: {
            role: choice.message.role ?? 'assistant',
            content: choice.message.content ?? null,
            tool_calls: choice.message.tool_calls,
        },
        finishReason: choice.finish_reason,
        model: result.model,
        usage: result.usage
            ? {
                promptTokens: result.usage.prompt_tokens,
                completionTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens,
            }
            : undefined,
    };
}
