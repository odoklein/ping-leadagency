import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";

// ============================================
// GET /api/manager/prospection/live-status
// Returns live prospection stats for the Cockpit sidebar indicator:
// - isLive: boolean (actions logged within last 20 minutes)
// - activeSdrsCount: number of distinct SDRs prospecting in last 20 mins
// - callsToday: total actions logged today
// - meetingsToday: total MEETING_BOOKED logged today
// - interestedToday: total INTERESTED logged today
// - lastActionAt: ISO timestamp of the latest action
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "ADMIN", "BUSINESS_DEVELOPER"], request);

    const now = new Date();
    // Start of current day in local server time
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Active window: actions in the last 20 minutes
    const ACTIVE_WINDOW_MINUTES = 20;
    const activeWindow = new Date(now.getTime() - ACTIVE_WINDOW_MINUTES * 60 * 1000);

    const [todayGroup, recentSdrs, latestAction] = await Promise.all([
        prisma.action.groupBy({
            by: ["result"],
            where: {
                createdAt: { gte: startOfDay },
            },
            _count: true,
        }),
        prisma.action.groupBy({
            by: ["sdrId"],
            where: {
                createdAt: { gte: activeWindow },
            },
            _count: true,
        }),
        prisma.action.findFirst({
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    let callsToday = 0;
    let meetingsToday = 0;
    let interestedToday = 0;

    for (const row of todayGroup) {
        callsToday += row._count;
        if (row.result === "MEETING_BOOKED") {
            meetingsToday += row._count;
        } else if (row.result === "INTERESTED") {
            interestedToday += row._count;
        }
    }

    const activeSdrsCount = recentSdrs.length;
    const isLive = activeSdrsCount > 0;

    return successResponse({
        isLive,
        activeSdrsCount,
        callsToday,
        meetingsToday,
        interestedToday,
        lastActionAt: latestAction?.createdAt ? latestAction.createdAt.toISOString() : null,
    });
});
