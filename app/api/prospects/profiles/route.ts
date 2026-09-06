// ============================================
// PROSPECT PROFILES API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, withErrorHandler, getPaginationParams, paginatedResponse } from '@/lib/api-utils';

// ============================================
// GET /api/prospects/profiles
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = getPaginationParams(searchParams);

  // Filters
  const status = searchParams.get('status');
  const step = searchParams.get('step');
  const reviewRequired = searchParams.get('reviewRequired');
  const search = searchParams.get('search');

  // Build where clause
  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (step) {
    where.currentStep = step;
  }

  if (reviewRequired === 'true') {
    where.reviewRequired = true;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Get total count
  const total = await prisma.prospectProfile.count({ where });

  // Get profiles
  const profiles = await prisma.prospectProfile.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      assignedMission: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedSdr: {
        select: {
          id: true,
          name: true,
        },
      },
      events: {
        select: {
          id: true,
          eventType: true,
          step: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          events: true,
          decisionLogs: true,
        },
      },
    },
  });

  return paginatedResponse(profiles, total, page, limit);
});
