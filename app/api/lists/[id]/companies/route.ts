import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createCompanySchema = z.object({
    name: z.string().min(1, 'Nom de la société requis'),
    industry: z.string().optional(),
    country: z.string().optional(),
    website: z.string().url().optional().or(z.literal('')),
    size: z.string().optional(),
});

// ============================================
// GET /api/lists/[id]/companies - Get list companies with contacts
// ============================================

export const GET = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER', 'SDR'], request);
    const { id } = await params;

    // Selected explicitly rather than `include: { contacts: true }`. That spread
    // every column of every contact — including the customData / createdAt /
    // updatedAt / unsubscribed fields the list page never reads — across the
    // wire for the whole list. These are the fields the table and the drawers
    // actually consume.
    const companies = await prisma.company.findMany({
        where: { listId: id },
        select: {
            id: true,
            name: true,
            industry: true,
            country: true,
            website: true,
            phone: true,
            size: true,
            status: true,
            customData: true,
            listId: true,
            contacts: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    title: true,
                    email: true,
                    phone: true,
                    additionalPhones: true,
                    additionalEmails: true,
                    linkedin: true,
                    status: true,
                    companyId: true,
                },
                orderBy: { createdAt: 'asc' },
            },
            _count: {
                select: { contacts: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return successResponse(companies);
});

// ============================================
// POST /api/lists/[id]/companies - Create new company in list
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id: listId } = await params;
    const data = await validateRequest(request, createCompanySchema);

    // Verify list exists
    const list = await prisma.list.findUnique({
        where: { id: listId },
    });

    if (!list) {
        return errorResponse('Liste non trouvée', 404);
    }

    // Check if company with same name already exists in this list
    const existingCompany = await prisma.company.findFirst({
        where: {
            listId,
            name: data.name,
        },
    });

    if (existingCompany) {
        return errorResponse('Une société avec ce nom existe déjà dans cette liste', 400);
    }

    // Create company
    const company = await prisma.company.create({
        data: {
            name: data.name,
            industry: data.industry || null,
            country: data.country || null,
            website: data.website || null,
            size: data.size || null,
            listId,
            status: 'INCOMPLETE', // Will be updated when contacts are added
        },
        include: {
            contacts: true,
            _count: {
                select: { contacts: true },
            },
        },
    });

    return successResponse(company, 201);
});
