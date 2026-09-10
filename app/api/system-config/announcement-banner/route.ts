import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireAuth,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import { z } from "zod";

const CONFIG_KEY_ACTIVE = "announcementBannerActive";
const CONFIG_KEY_MESSAGE = "announcementBannerMessage";
const CONFIG_KEY_DETAILS = "announcementBannerDetails";
const CONFIG_KEY_AUDIENCE = "announcementBannerAudience";
const CONFIG_KEY_CLIENT_ID = "announcementBannerClientId";

const AUDIENCES = ["ALL", "INTERNAL", "MANAGERS", "CLIENTS", "CLIENT"] as const;
type Audience = (typeof AUDIENCES)[number];

const updateBannerSchema = z
    .object({
        active: z.boolean(),
        message: z.string().trim().max(120, "Le message est trop long (120 caractères max)"),
        details: z.string().trim().max(2000, "Le détail est trop long (2000 caractères max)"),
        audience: z.enum(AUDIENCES),
        clientId: z.string().trim().nullable().optional(),
    })
    .refine((data) => !data.active || data.message.length > 0, {
        message: "Un message est requis pour activer la bannière",
        path: ["message"],
    })
    .refine((data) => data.audience !== "CLIENT" || !!data.clientId, {
        message: "Sélectionnez le client destinataire",
        path: ["clientId"],
    });

/** Who should see the banner, given the audience setting and the viewer. */
function isVisibleTo(
    audience: Audience,
    targetClientId: string | null,
    viewer: { role: string; clientId: string | null }
): boolean {
    switch (audience) {
        case "ALL":
            return true;
        case "INTERNAL":
            return viewer.role !== "CLIENT";
        case "MANAGERS":
            return viewer.role === "MANAGER";
        case "CLIENTS":
            return viewer.role === "CLIENT";
        case "CLIENT":
            return viewer.role === "CLIENT" && !!targetClientId && viewer.clientId === targetClientId;
        default:
            return false;
    }
}

async function readBannerConfig() {
    const records = await prisma.systemConfig.findMany({
        where: {
            key: {
                in: [
                    CONFIG_KEY_ACTIVE,
                    CONFIG_KEY_MESSAGE,
                    CONFIG_KEY_DETAILS,
                    CONFIG_KEY_AUDIENCE,
                    CONFIG_KEY_CLIENT_ID,
                ],
            },
        },
    });
    const valueOf = (key: string) => records.find((r) => r.key === key)?.value?.trim() ?? "";
    const rawAudience = valueOf(CONFIG_KEY_AUDIENCE);
    return {
        active: valueOf(CONFIG_KEY_ACTIVE) === "true",
        message: valueOf(CONFIG_KEY_MESSAGE),
        details: valueOf(CONFIG_KEY_DETAILS),
        audience: (AUDIENCES as readonly string[]).includes(rawAudience)
            ? (rawAudience as Audience)
            : ("ALL" as Audience),
        clientId: valueOf(CONFIG_KEY_CLIENT_ID) || null,
        updatedAt: records.map((r) => r.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    };
}

// GET — any authenticated user: every role's sidebar reads this.
// Managers get the full config (to edit it); everyone else only learns whether a
// banner is visible to them, so a client-targeted message never leaks to others.
export const GET = withErrorHandler(async (request: NextRequest) => {
    const session = await requireAuth(request);
    const config = await readBannerConfig();
    const isManager = session.user.role === "MANAGER";

    const visible =
        config.active &&
        !!config.message &&
        isVisibleTo(config.audience, config.clientId, {
            role: session.user.role,
            clientId: session.user.clientId ?? null,
        });

    if (isManager) {
        return successResponse({
            ...config,
            updatedAt: config.updatedAt?.toISOString() ?? null,
            visible,
        });
    }

    return successResponse({
        visible,
        message: visible ? config.message : "",
        details: visible ? config.details : "",
        updatedAt: visible ? config.updatedAt?.toISOString() ?? null : null,
    });
});

// PUT — managers only.
export const PUT = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    const body = await request.json();
    const parsed = updateBannerSchema.safeParse(body);
    if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message, 400);
    }

    const { active, message, details, audience } = parsed.data;
    const clientId = audience === "CLIENT" ? parsed.data.clientId ?? "" : "";

    if (clientId) {
        const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
        if (!client) return errorResponse("Client introuvable", 404);
    }

    const upsert = (key: string, value: string) =>
        prisma.systemConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });

    await prisma.$transaction([
        upsert(CONFIG_KEY_ACTIVE, String(active)),
        upsert(CONFIG_KEY_MESSAGE, message),
        upsert(CONFIG_KEY_DETAILS, details),
        upsert(CONFIG_KEY_AUDIENCE, audience),
        upsert(CONFIG_KEY_CLIENT_ID, clientId),
    ]);

    return successResponse({ active, message, details, audience, clientId: clientId || null });
});
