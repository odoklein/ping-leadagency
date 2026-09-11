import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionService } from "@/lib/services/ActionService";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";

// ============================================
// GET /api/manager/prospection/stats
// Returns consolidated KPIs, hourly activity sparkline,
// and live presence metrics across prospection.
// Optional query params:
// - missionId: filter by mission
// - clientId: filter by client
// - sdrId: filter by SDR user
// - channel: CALL | EMAIL | LINKEDIN
// - from: ISO date string
// - to: ISO date string
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "ADMIN", "BUSINESS_DEVELOPER"], request);

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get("missionId") || undefined;
    const clientId = searchParams.get("clientId") || undefined;
    const sdrId = searchParams.get("sdrId") || undefined;
    const channelParam = searchParams.get("channel")?.toUpperCase();
    const channel = (channelParam === "CALL" || channelParam === "EMAIL" || channelParam === "LINKEDIN")
        ? (channelParam as "CALL" | "EMAIL" | "LINKEDIN")
        : undefined;
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    // 1. Fetch aggregate stats from service
    const stats = await actionService.getActionStats({
        missionId,
        clientId,
        sdrId,
        channel,
        from,
        to,
    });

    // 2. Compute hourly sparkline distribution (past 8 hours)
    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    const sparkWhere: any = {
        createdAt: { gte: eightHoursAgo },
    };
    if (missionId) sparkWhere.campaign = { ...(sparkWhere.campaign || {}), missionId };
    if (clientId) sparkWhere.campaign = { ...(sparkWhere.campaign || {}), mission: { clientId } };
    if (sdrId) sparkWhere.sdrId = sdrId;
    if (channel) sparkWhere.channel = channel;

    const recentActions = await prisma.action.findMany({
        where: sparkWhere,
        select: { createdAt: true },
    });

    const hourlySparkData = Array(8).fill(0);
    const nowMs = now.getTime();
    recentActions.forEach(a => {
        const ago = (nowMs - a.createdAt.getTime()) / 3600000;
        const idx = Math.min(7, Math.floor(ago));
        if (idx >= 0) hourlySparkData[7 - idx]++;
    });

    // 3. Live Presence & Activity in the last 20 minutes
    const ACTIVE_WINDOW_MINUTES = 20;
    const activeWindow = new Date(now.getTime() - ACTIVE_WINDOW_MINUTES * 60 * 1000);

    const [recentSdrs, latestAction] = await Promise.all([
        prisma.action.groupBy({
            by: ["sdrId"],
            where: {
                createdAt: { gte: activeWindow },
                ...(missionId ? { campaign: { missionId } } : {}),
                ...(clientId ? { campaign: { mission: { clientId } } } : {}),
            },
            _count: true,
        }),
        prisma.action.findFirst({
            where: {
                ...(missionId ? { campaign: { missionId } } : {}),
                ...(clientId ? { campaign: { mission: { clientId } } } : {}),
            },
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    const activeSdrsCount = recentSdrs.length;
    const isLive = activeSdrsCount > 0;

    return successResponse({
        ...stats,
        hourlySparkData,
        liveStatus: {
            isLive,
            activeSdrsCount,
            lastActionAt: latestAction?.createdAt ? latestAction.createdAt.toISOString() : null,
        },
    });
});
