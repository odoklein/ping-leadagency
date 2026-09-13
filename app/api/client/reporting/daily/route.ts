import { NextRequest } from "next/server";
import { requireRole, withErrorHandler, successResponse, errorResponse, AuthError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { buildClientDailyMetrics } from "@/lib/reporting/client-daily/metrics";
import { reportDateToIso, toReportDateKey } from "@/lib/reporting/client-daily/generate";
import type {
    ClientDailyMetrics,
    ClientDailyReportPayload,
    ClientReportNarrative,
} from "@/lib/reporting/client-daily/types";

// ============================================
// GET /api/client/reporting/daily?date=YYYY-MM-DD
//
// Today: returns the stored report when one exists (so the prose and the
// figures always agree), otherwise fresh metrics with narrative: null — the
// page renders its charts immediately and asks for the narrative separately.
// A past date returns the archived report as it was written that day.
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = (session.user as { clientId?: string })?.clientId;
    if (!clientId) throw new AuthError("Accès non autorisé", 403);

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date")?.trim();

    const todayKey = toReportDateKey();
    const requestedKey = dateParam ? toReportDateKey(dateParam) : todayKey;
    if (Number.isNaN(requestedKey.getTime())) {
        return errorResponse("Date invalide", 400);
    }
    const isArchive = requestedKey.getTime() !== todayKey.getTime();

    const record = await prisma.clientDailyReport.findUnique({
        where: { clientId_reportDate: { clientId, reportDate: requestedKey } },
    });

    if (record && (record.status === "completed" || record.status === "fallback")) {
        const payload: ClientDailyReportPayload = {
            reportDate: reportDateToIso(record.reportDate),
            status: record.status as ClientDailyReportPayload["status"],
            metrics: record.metrics as unknown as ClientDailyMetrics,
            narrative: (record.narrative as unknown as ClientReportNarrative) ?? null,
            generatedAt: record.updatedAt.toISOString(),
            modelUsed: record.modelUsed,
            isArchive,
        };
        return successResponse(payload);
    }

    if (isArchive) {
        return errorResponse("Aucun rapport archivé pour cette date", 404);
    }

    const metrics = await buildClientDailyMetrics({ clientId });
    if (!metrics) return errorResponse("Client introuvable", 404);

    const payload: ClientDailyReportPayload = {
        reportDate: reportDateToIso(requestedKey),
        status: record?.status === "pending" ? "pending" : "absent",
        metrics,
        narrative: null,
        generatedAt: null,
        modelUsed: null,
        isArchive: false,
    };
    return successResponse(payload);
});
