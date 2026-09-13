/**
 * Parsing helpers for LLM responses.
 *
 * Even with response_format: json_object, models occasionally wrap the payload
 * in a markdown fence or add a stray sentence around it. These helpers recover
 * the JSON instead of failing the whole generation.
 */

/**
 * Parse JSON out of a raw model completion.
 * Tries strict JSON first, then a ```json fence, then the outermost braces.
 * Throws if none of those yield valid JSON.
 */
export function safeParseJsonFromModel(content: string): unknown {
    const trimmed = content.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        // Handle fenced markdown: ```json ... ```
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fenced?.[1]) {
            return JSON.parse(fenced[1].trim());
        }

        // Last resort: parse between first "{" and last "}"
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            const candidate = trimmed.slice(firstBrace, lastBrace + 1);
            return JSON.parse(candidate);
        }
        throw new Error('INVALID_JSON');
    }
}
