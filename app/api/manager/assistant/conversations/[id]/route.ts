// GET /api/manager/assistant/conversations/[id]
// The explicit drill-down: full transcript of one conversation. Reading a
// person's questions is a deliberate act, not the resting state of the page.

import { NextRequest } from "next/server";
import { errorResponse, requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";
import { getAssistantTranscript } from "@/lib/assistant/analytics";

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(["MANAGER"], request);
    const { id } = await params;
    const transcript = await getAssistantTranscript(id);
    if (!transcript) return errorResponse("Conversation introuvable", 404);
    return successResponse(transcript);
});
