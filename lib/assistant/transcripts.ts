/**
 * Durable assistant transcripts.
 *
 * Separate from `lib/assistant/memory.ts`, which keeps the user's own recent
 * history as a capped, rotating JSON blob on `User.preferences` and drives the
 * history dropdown in the panel. That store is lossy by design (8 sessions) and
 * is not queryable, so it cannot answer "what is the team asking the assistant".
 *
 * This module is the observability log: every turn, with its tool calls and
 * failure code, kept for the manager view. Writes are best-effort — a failure
 * here must never cost the user their answer.
 *
 * TODO: once the panel reads its history from these tables, delete the
 * preferences store rather than maintaining both.
 */

import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_TITLE = 80;
const MAX_CONTENT = 8000;

export interface ToolCallRecord {
    tool: string;
    ok: boolean;
    durationMs: number;
    errorCode?: string;
}

export interface RecordTurnInput {
    userId: string;
    userRole: UserRole;
    clientId: string | null;
    /** Client-supplied id. Untrusted: only reused when it already belongs to this user. */
    conversationId: string;
    question: string;
    answer: string;
    model?: string | null;
    toolCalls?: ToolCallRecord[];
    latencyMs?: number;
    totalTokens?: number;
    errorCode?: string | null;
}

function clamp(value: string, max: number): string {
    const trimmed = value.trim();
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/** First line of the opening question, which is what a human scanning a list wants. */
function titleFrom(question: string): string {
    const firstLine = question.split("\n").find((l) => l.trim()) ?? question;
    return clamp(firstLine, MAX_TITLE) || "Conversation";
}

/**
 * Resolve the conversation row for this turn.
 *
 * The id arrives from the browser, so it is never trusted as a key on its own:
 * it is reused only when a row with that id already belongs to this user.
 * Otherwise a fresh row is created — first with the supplied id (so client and
 * server stay aligned), falling back to a generated one if that id is taken by
 * somebody else's conversation.
 */
async function resolveConversation(input: RecordTurnInput): Promise<string | null> {
    const own = await prisma.assistantConversation.findFirst({
        where: { id: input.conversationId, userId: input.userId },
        select: { id: true },
    });
    if (own) return own.id;

    const data = {
        userId: input.userId,
        userRole: input.userRole,
        clientId: input.clientId,
        title: titleFrom(input.question),
    };

    try {
        const created = await prisma.assistantConversation.create({
            data: { id: input.conversationId, ...data },
            select: { id: true },
        });
        return created.id;
    } catch {
        // Id malformed, or already owned by another user: let Prisma assign one.
        try {
            const created = await prisma.assistantConversation.create({ data, select: { id: true } });
            return created.id;
        } catch (error) {
            console.error("[assistant.transcript] conversation create failed:", error);
            return null;
        }
    }
}

/**
 * Append one user/assistant exchange. Never throws: the caller has already sent
 * the user their answer by the time this runs.
 */
export async function recordAssistantTurn(input: RecordTurnInput): Promise<void> {
    try {
        const conversationId = await resolveConversation(input);
        if (!conversationId) return;

        const now = new Date();
        await prisma.$transaction([
            prisma.assistantMessage.create({
                data: {
                    conversationId,
                    role: "user",
                    content: clamp(input.question, MAX_CONTENT),
                    createdAt: now,
                },
            }),
            prisma.assistantMessage.create({
                data: {
                    conversationId,
                    role: "assistant",
                    content: clamp(input.answer, MAX_CONTENT),
                    // Telemetry lives on the assistant turn: this is what makes
                    // tool usage and failure rates queryable.
                    toolCalls: (input.toolCalls ?? []) as unknown as Prisma.InputJsonValue,
                    model: input.model ?? null,
                    latencyMs: input.latencyMs ?? null,
                    totalTokens: input.totalTokens ?? null,
                    errorCode: input.errorCode ?? null,
                    createdAt: new Date(now.getTime() + 1),
                },
            }),
            prisma.assistantConversation.update({
                where: { id: conversationId },
                data: {
                    messageCount: { increment: 2 },
                    lastMessageAt: now,
                },
            }),
        ]);
    } catch (error) {
        console.error("[assistant.transcript] record failed:", error);
    }
}
