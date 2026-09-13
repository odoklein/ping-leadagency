import { NextRequest } from "next/server";
import { requireRole, withErrorHandler, successResponse, errorResponse, AuthError } from "@/lib/api-utils";
import { generateClientDailyReport } from "@/lib/reporting/client-daily/generate";
import type { ClientDailyReportPayload } from "@/lib/reporting/client-daily/types";

// Writing the narrative is a single Mistral Large call (~10-25s).
export const maxDuration = 60;

// ============================================
// POST /api/client/reporting/daily/generate
//
// Lazy trigger fired by the reporting page when today's report does not exist
// yet. Idempotent: the unique (clientId, reportDate) row is the lock, so a
// second tab gets status "pending" and polls instead of paying for a second
// generation.
// Body: { force?: boolean } — force re-runs a report already written today.
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(["CLIENT"], request);
    const clientId = (session.user as { clientId?: string })?.clientId;
    if (!clientId) throw new AuthError("Accès non autorisé", 403);

    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    const result = await generateClientDailyReport({ clientId, force });
    if (!result) return errorResponse("Client introuvable", 404);

    const payload: ClientDailyReportPayload & { inFlight: boolean } = {
        reportDate: result.reportDate,
        status: result.status,
        metrics: result.metrics,
        narrative: result.narrative,
        generatedAt: result.generatedAt,
        modelUsed: result.modelUsed,
        isArchive: false,
        inFlight: result.inFlight === true,
    };
    return successResponse(payload);
});
