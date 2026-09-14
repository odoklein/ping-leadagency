/**
 * Manager-facing analytics over assistant transcripts.
 *
 * Deliberately aggregate-first: the default view is volumes, roles, tool usage
 * and failures. Message content is only reachable by opening one conversation,
 * so browsing the team's and clients' questions is a explicit act rather than
 * the resting state of the page.
 */

import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AssistantAnalyticsFilters {
    from: Date;
    to: Date;
    role?: UserRole;
    clientId?: string;
}

export interface AssistantOverview {
    period: { from: string; to: string };
    totals: {
        conversations: number;
        messages: number;
        questions: number;
        activeUsers: number;
        failedTurns: number;
        failureRate: number;
        avgLatencyMs: number | null;
        totalTokens: number;
    };
    byRole: Array<{ role: UserRole; conversations: number; questions: number }>;
    byDay: Array<{ day: string; questions: number }>;
    toolUsage: Array<{ tool: string; calls: number; failures: number }>;
    topUsers: Array<{ userId: string; name: string; role: UserRole; questions: number }>;
}

interface ToolCallShape {
    tool?: unknown;
    ok?: unknown;
}

function buildWhere(f: AssistantAnalyticsFilters): Prisma.AssistantConversationWhereInput {
    return {
        createdAt: { gte: f.from, lte: f.to },
        ...(f.role ? { userRole: f.role } : {}),
        ...(f.clientId ? { clientId: f.clientId } : {}),
    };
}

export async function getAssistantOverview(
    f: AssistantAnalyticsFilters
): Promise<AssistantOverview> {
    const where = buildWhere(f);

    const conversations = await prisma.assistantConversation.findMany({
        where,
        select: {
            id: true,
            userId: true,
            userRole: true,
            user: { select: { name: true } },
        },
    });

    const conversationIds = conversations.map((c) => c.id);
    if (conversationIds.length === 0) {
        return {
            period: { from: f.from.toISOString(), to: f.to.toISOString() },
            totals: {
                conversations: 0,
                messages: 0,
                questions: 0,
                activeUsers: 0,
                failedTurns: 0,
                failureRate: 0,
                avgLatencyMs: null,
                totalTokens: 0,
            },
            byRole: [],
            byDay: [],
            toolUsage: [],
            topUsers: [],
        };
    }

    const messages = await prisma.assistantMessage.findMany({
        where: { conversationId: { in: conversationIds } },
        select: {
            conversationId: true,
            role: true,
            toolCalls: true,
            latencyMs: true,
            totalTokens: true,
            errorCode: true,
            createdAt: true,
        },
    });

    const convById = new Map(conversations.map((c) => [c.id, c]));

    let questions = 0;
    let failedTurns = 0;
    let totalTokens = 0;
    let latencySum = 0;
    let latencyCount = 0;
    const byDay = new Map<string, number>();
    const toolUsage = new Map<string, { calls: number; failures: number }>();
    const questionsByUser = new Map<string, number>();

    for (const m of messages) {
        if (m.role === "user") {
            questions += 1;
            const day = m.createdAt.toISOString().slice(0, 10);
            byDay.set(day, (byDay.get(day) ?? 0) + 1);
            const conv = convById.get(m.conversationId);
            if (conv) {
                questionsByUser.set(conv.userId, (questionsByUser.get(conv.userId) ?? 0) + 1);
            }
            continue;
        }

        // Assistant turn: carries the telemetry.
        if (m.errorCode) failedTurns += 1;
        if (m.totalTokens) totalTokens += m.totalTokens;
        if (typeof m.latencyMs === "number") {
            latencySum += m.latencyMs;
            latencyCount += 1;
        }
        if (Array.isArray(m.toolCalls)) {
            for (const raw of m.toolCalls as ToolCallShape[]) {
                const name = typeof raw?.tool === "string" ? raw.tool : null;
                if (!name) continue;
                const entry = toolUsage.get(name) ?? { calls: 0, failures: 0 };
                entry.calls += 1;
                if (raw.ok === false) entry.failures += 1;
                toolUsage.set(name, entry);
            }
        }
    }

    const roleTotals = new Map<UserRole, { conversations: number; questions: number }>();
    for (const c of conversations) {
        const entry = roleTotals.get(c.userRole) ?? { conversations: 0, questions: 0 };
        entry.conversations += 1;
        entry.questions += questionsByUser.get(c.userId) ?? 0;
        roleTotals.set(c.userRole, entry);
    }

    const userMeta = new Map(
        conversations.map((c) => [c.userId, { name: c.user?.name ?? "—", role: c.userRole }])
    );

    return {
        period: { from: f.from.toISOString(), to: f.to.toISOString() },
        totals: {
            conversations: conversations.length,
            messages: messages.length,
            questions,
            activeUsers: new Set(conversations.map((c) => c.userId)).size,
            failedTurns,
            failureRate: questions > 0 ? Math.round((failedTurns / questions) * 1000) / 10 : 0,
            avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
            totalTokens,
        },
        byRole: [...roleTotals.entries()]
            .map(([role, v]) => ({ role, ...v }))
            .sort((a, b) => b.questions - a.questions),
        byDay: [...byDay.entries()]
            .map(([day, questions]) => ({ day, questions }))
            .sort((a, b) => a.day.localeCompare(b.day)),
        toolUsage: [...toolUsage.entries()]
            .map(([tool, v]) => ({ tool, ...v }))
            .sort((a, b) => b.calls - a.calls),
        topUsers: [...questionsByUser.entries()]
            .map(([userId, q]) => ({
                userId,
                name: userMeta.get(userId)?.name ?? "—",
                role: userMeta.get(userId)?.role ?? ("SDR" as UserRole),
                questions: q,
            }))
            .sort((a, b) => b.questions - a.questions)
            .slice(0, 10),
    };
}

export interface ConversationListItem {
    id: string;
    title: string;
    userName: string;
    userRole: UserRole;
    messageCount: number;
    lastMessageAt: string | null;
    createdAt: string;
    hadFailure: boolean;
}

/** Conversation list for drill-down. Titles only — no message bodies. */
export async function listAssistantConversations(
    f: AssistantAnalyticsFilters,
    limit = 50
): Promise<ConversationListItem[]> {
    const rows = await prisma.assistantConversation.findMany({
        where: buildWhere(f),
        select: {
            id: true,
            title: true,
            userRole: true,
            messageCount: true,
            lastMessageAt: true,
            createdAt: true,
            user: { select: { name: true } },
            messages: { where: { errorCode: { not: null } }, select: { id: true }, take: 1 },
        },
        orderBy: { lastMessageAt: "desc" },
        take: Math.min(Math.max(limit, 1), 100),
    });

    return rows.map((r) => ({
        id: r.id,
        title: r.title,
        userName: r.user?.name ?? "—",
        userRole: r.userRole,
        messageCount: r.messageCount,
        lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        hadFailure: r.messages.length > 0,
    }));
}

/** Full transcript of one conversation — the explicit drill-down step. */
export async function getAssistantTranscript(conversationId: string) {
    const conversation = await prisma.assistantConversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            title: true,
            userRole: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
            messages: {
                select: {
                    id: true,
                    role: true,
                    content: true,
                    toolCalls: true,
                    errorCode: true,
                    latencyMs: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "asc" },
            },
        },
    });
    if (!conversation) return null;

    return {
        id: conversation.id,
        title: conversation.title,
        userName: conversation.user?.name ?? "—",
        userRole: conversation.userRole,
        createdAt: conversation.createdAt.toISOString(),
        messages: conversation.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls,
            errorCode: m.errorCode,
            latencyMs: m.latencyMs,
            createdAt: m.createdAt.toISOString(),
        })),
    };
}
