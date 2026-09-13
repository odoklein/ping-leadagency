import { NextRequest } from "next/server";
import { requireRole, withErrorHandler, successResponse, AuthError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { reportDateToIso } from "@/lib/reporting/client-daily/generate";
import type { ClientReportNarrative } from "@/lib/reporting/client-daily/types";

// ============================================
// GET /api/client/reporting/daily/history?limit=30
// Past reports for the archive rail. Metrics are deliberately not selected —
// only what the rail displays.
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = (session.user as { clientId?: string })?.clientId;
    if (!clientId) throw new AuthError("Accès non autorisé", 403);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "30", 10) || 30, 1), 90);

    const records = await prisma.clientDailyReport.findMany({
        where: { clientId, status: { in: ["completed", "fallback"] } },
        select: { reportDate: true, status: true, narrative: true, updatedAt: true },
        orderBy: { reportDate: "desc" },
        take: limit,
    });

    return successResponse(
        records.map((record) => ({
            reportDate: reportDateToIso(record.reportDate),
            status: record.status,
            headline: (record.narrative as unknown as ClientReportNarrative | null)?.headline ?? "",
            generatedAt: record.updatedAt.toISOString(),
        }))
    );
});
