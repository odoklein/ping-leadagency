import { NextRequest } from 'next/server';
import { successResponse, requireRole, withErrorHandler } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

// ============================================
// GET /api/analyse-ia/history
// Returns paginated list of past weekly analyses
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || undefined;

    const where: any = {};
    if (status) where.status = status;

    const [analyses, total] = await Promise.all([
        prisma.weeklyAnalysis.findMany({
            where,
            orderBy: { weekStart: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                weekStart: true,
                weekEnd: true,
                label: true,
                status: true,
                confidenceScore: true,
                dataQualityScore: true,
                missionIds: true,
                clientIds: true,
                sdrIds: true,
                recommendations: true,
                expectedImpacts: true,
                trendAlerts: true,
                dataSnapshot: true,
                executiveSummary: true,
                priorAnalysisId: true,
                recommendationOutcomes: true,
                createdAt: true,
                durationMs: true,
                tokensUsed: true,
            },
        }),
        prisma.weeklyAnalysis.count({ where }),
    ]);

    return successResponse({
        analyses,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    });
});
