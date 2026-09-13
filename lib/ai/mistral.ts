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

/** Models the account's tier rejected, learned at runtime and not retried again. */
const tierBlockedModels = new Set<string>();

/** Ordered degradation path when the preferred model is not available to the tier. */
const FALLBACK_MODELS = ['mistral-medium-latest', 'mistral-small-latest'];

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 700;
const MAX_BACKOFF_MS = 3000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `Retry-After` wins when present; otherwise exponential backoff with jitter. */
function backoffDelay(response: Response, attempt: number): number {
    const header = response.headers.get('retry-after');
    if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds >= 0) {
            return Math.min(seconds * 1000, MAX_BACKOFF_MS);
        }
    }
    const exponential = BASE_BACKOFF_MS * 2 ** attempt;
    return Math.min(exponential, MAX_BACKOFF_MS) + Math.random() * 200;
}

async function isTierRejection(response: Response): Promise<boolean> {
    try {
        const data = await response.clone().json();
        return (
            data?.type === 'tier_not_allowed' ||
            data?.code === '1910' ||
            data?.code === 1910 ||
            /tier/i.test(String(data?.message ?? ''))
        );
    } catch {
        return false;
    }
}

async function postOnce(apiKey: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
}

/** One model, retried on rate limits and transient upstream failures. */
async function postWithRetry(apiKey: string, body: Record<string, unknown>): Promise<Response> {
    let response = await postOnce(apiKey, body);

    for (let attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt++) {
        if (response.ok || !RETRYABLE_STATUSES.has(response.status)) return response;

        const delay = backoffDelay(response, attempt);
        console.warn(
            `[mistral] ${response.status} on "${body.model}" — retry ${attempt + 1}/${MAX_ATTEMPTS - 1} in ${Math.round(delay)}ms`
        );
        await sleep(delay);
        response = await postOnce(apiKey, body);
    }

    return response;
}

/**
 * Execute a request against the Mistral API.
 *
 * Handles the two failure modes this account actually hits:
 *  - `tier_not_allowed`: degrade to the next model in the chain, and remember the
 *    rejection so later requests skip the wasted round-trip entirely (that extra
 *    call was itself burning the rate-limit budget).
 *  - `429` / 5xx: retry with `Retry-After`-aware exponential backoff.
 */
export async function mistralFetch(
    apiKey: string,
    payload: Record<string, unknown>
): Promise<Response> {
    const requested = (payload.model as string) || getMistralModel();

    const chain = [requested, ...FALLBACK_MODELS.filter((m) => m !== requested)];
    const candidates = chain.filter((m) => !tierBlockedModels.has(m));
    // Every model blocked: still try the smallest rather than failing without a call.
    const models = candidates.length > 0 ? candidates : ['mistral-small-latest'];

    let lastResponse: Response | null = null;

    for (const model of models) {
        const response = await postWithRetry(apiKey, { ...payload, model });
        if (response.ok) return response;

        if (response.status === 403 && (await isTierRejection(response))) {
            tierBlockedModels.add(model);
            console.warn(`[mistral] model "${model}" is not available on this tier — degrading.`);
            lastResponse = response;
            continue;
        }

        return response;
    }

    return lastResponse as Response;
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

/**
 * A failed Mistral call, carrying enough detail for the caller to choose a
 * status code and a user-facing message instead of a generic 500.
 */
export class MistralError extends Error {
    readonly status: number;
    readonly code: 'rate_limited' | 'unauthorized' | 'tier_not_allowed' | 'upstream' | 'unknown';

    constructor(message: string, status: number) {
        super(message);
        this.name = 'MistralError';
        this.status = status;
        this.code =
            status === 429
                ? 'rate_limited'
                : status === 401
                  ? 'unauthorized'
                  : status === 403
                    ? 'tier_not_allowed'
                    : status >= 500
                      ? 'upstream'
                      : 'unknown';
    }

    /** French message safe to show an end user. */
    get userMessage(): string {
        switch (this.code) {
            case 'rate_limited':
                return "L'assistant est momentanément saturé (limite d'appels du fournisseur IA). Réessayez dans quelques secondes.";
            case 'unauthorized':
                return "La clé API Mistral est invalide ou absente. Contactez un administrateur.";
            case 'tier_not_allowed':
                return "Le modèle Mistral configuré n'est pas disponible sur cet abonnement.";
            case 'upstream':
                return "Le fournisseur IA est indisponible pour le moment. Réessayez dans un instant.";
            default:
                return "L'assistant n'a pas pu répondre. Réessayez.";
        }
    }
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
        const detail =
            (error as { message?: string; error?: { message?: string } })?.error?.message ||
            (error as { message?: string })?.message ||
            `Mistral request failed (${response.status})`;
        throw new MistralError(detail, response.status);
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
