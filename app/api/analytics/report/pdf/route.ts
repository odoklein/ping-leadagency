import { NextRequest, NextResponse } from "next/server";
import {
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { getChromiumExecutablePath } from "@/lib/pdf-chromium";
import { getAnalyticsReportData } from "../get-report-data";
import { getAnalyticsReportHtml } from "../report-template";
import { mistralFetch } from "@/lib/ai/mistral";
import { uploadReportPdf } from "@/lib/storage/supabase-report-storage";

// ============================================
// GET /api/analytics/report/pdf
// Query: from, to, missionIds[]?, sdrIds[]?, clientIds[]?
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER", "DEVELOPER"], request);

    if (process.env.ENABLE_ANALYTICS_PDF !== "1" || !process.env.CHROMIUM_PACK_URL) {
        return NextResponse.json(
            {
                success: false,
                error: "L’export PDF analytique est désactivé pour accélérer les déploiements.",
            },
            { status: 503 }
        );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.trim();
    const to = searchParams.get("to")?.trim();
    const missionIds = searchParams.getAll("missionIds[]");
    const sdrIds = searchParams.getAll("sdrIds[]");
    const clientIds = searchParams.getAll("clientIds[]");
    const listIds = searchParams.getAll("listIds[]");

    if (!from || !to) {
        return NextResponse.json(
            { success: false, error: "from et to sont requis" },
            { status: 400 }
        );
    }

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateFrom.setHours(0, 0, 0, 0);
    dateTo.setHours(23, 59, 59, 999);

    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
        return NextResponse.json(
            { success: false, error: "Dates invalides" },
            { status: 400 }
        );
    }

    if (dateFrom > dateTo) {
        return NextResponse.json(
            { success: false, error: "La date de début doit être avant la date de fin" },
            { status: 400 }
        );
    }

    const raw = await getAnalyticsReportData({
        from,
        to,
        missionIds,
        sdrIds,
        clientIds,
        listIds,
    });

    // AI summary
    let aiSummary = "Aucune donnée suffisante pour générer une analyse.";
    const templateData = {
        ...raw,
        aiSummary,
    };
    const html = getAnalyticsReportHtml(templateData);

    const puppeteer = await import("puppeteer-core");
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const browser = await puppeteer.default.launch({
        headless: true,
        args: chromium.args,
        executablePath: await getChromiumExecutablePath(),
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
        });
        const filename = `rapport-analytics-${from}-${to}.pdf`;
        const buffer = Buffer.from(pdfBuffer);

        // Upload to Supabase Storage when configured (avoids download errors, keeps history)
        const stored = await uploadReportPdf(buffer, filename);
        if (stored) {
            return NextResponse.json({
                success: true,
                url: stored.url,
                filename,
            });
        }

        // Fallback: return PDF binary directly
        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": String(buffer.length),
            },
        });
    } finally {
        await browser.close();
    }
});
