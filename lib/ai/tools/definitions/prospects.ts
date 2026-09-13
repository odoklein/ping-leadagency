/**
 * Prospect-level reads.
 *
 * Contacts sit four hops from the tenant boundary
 * (Contact -> Company -> List -> Mission -> Client), so reachability is proven
 * by walking that chain inside the query rather than by a separate lookup.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AIRequestContext, ToolAuthorizationError } from "../types";
import { hasEmptyScope, resolveMissionScope, resolveSdrScope } from "../scope";
import { clampLimit, defineTool, strictArgs } from "../helpers";
import { sanitizeUntrusted } from "../redact";
import { computeListHealth } from "@/lib/services/ListHealthService";

/** Mission filter expressed from a Contact, through the full ownership chain. */
function contactMissionWhere(missionIds: string[] | null): Record<string, unknown> {
    if (missionIds === null) return {};
    return { company: { is: { list: { is: { missionId: { in: missionIds } } } } } };
}

const historyArgs = strictArgs({
    contactId: z.string().min(1),
    limit: z.number().int().optional(),
});

export const getProspectHistory = defineTool({
    name: "get_prospect_history",
    description:
        "Retourne l'historique des actions sur un contact prospect: date, canal, resultat, " +
        "SDR, duree et note. A utiliser pour 'qu'a-t-on deja fait avec ce contact', " +
        "'pourquoi ce prospect est bloque'. Les notes sont du texte libre saisi par les SDR.",
    parameters: {
        type: "object",
        properties: {
            contactId: { type: "string", description: "Identifiant du contact." },
            limit: { type: "integer", description: "Nombre max d'actions (1-50, defaut 20)." },
        },
        required: ["contactId"],
        additionalProperties: false,
    },
    schema: historyArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER", "CLIENT"],
    execute: async (args: z.infer<typeof historyArgs>, ctx: AIRequestContext) => {
        if (hasEmptyScope(ctx)) {
            throw new ToolAuthorizationError("Contact hors de votre perimetre d'acces.", "out_of_scope");
        }

        const missionIds = resolveMissionScope(ctx);

        // findFirst (not findUnique) so the ownership chain is part of the query:
        // an out-of-scope contact is indistinguishable from a missing one.
        const contact = await prisma.contact.findFirst({
            where: { id: args.contactId, ...contactMissionWhere(missionIds) },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                title: true,
                status: true,
                company: {
                    select: {
                        id: true,
                        name: true,
                        industry: true,
                        list: { select: { id: true, name: true, missionId: true } },
                    },
                },
            },
        });

        if (!contact) {
            throw new ToolAuthorizationError("Contact introuvable ou hors perimetre.", "out_of_scope");
        }

        const actionWhere: Record<string, unknown> = { contactId: contact.id };
        const sdrIds = resolveSdrScope(ctx);
        if (sdrIds !== null) actionWhere.sdrId = { in: sdrIds };

        const actions = await prisma.action.findMany({
            where: actionWhere,
            select: {
                id: true,
                createdAt: true,
                channel: true,
                result: true,
                note: true,
                duration: true,
                callbackDate: true,
                sdr: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: clampLimit(args.limit),
        });

        return {
            contact: {
                id: contact.id,
                name: sanitizeUntrusted(
                    [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null,
                    120
                ),
                title: sanitizeUntrusted(contact.title, 120),
                status: contact.status,
                company: sanitizeUntrusted(contact.company?.name, 160),
                industry: sanitizeUntrusted(contact.company?.industry, 120),
                listName: sanitizeUntrusted(contact.company?.list?.name, 160),
            },
            actionCount: actions.length,
            actions: actions.map((a) => ({
                id: a.id,
                date: a.createdAt,
                channel: a.channel,
                result: a.result,
                durationSeconds: a.duration,
                callbackDate: a.callbackDate,
                sdrName: sanitizeUntrusted(a.sdr?.name, 120),
                // SDR-authored free text: the highest prompt-injection risk in the payload.
                note: sanitizeUntrusted(a.note, 500),
            })),
        };
    },
});

const listHealthArgs = strictArgs({ listId: z.string().min(1) });

export const getListHealth = defineTool({
    name: "get_list_health",
    description:
        "Analyse la sante d'une liste de prospects: statut, taux de couverture, velocite, " +
        "ETA d'epuisement, alertes de stagnation, repartition des resultats et contributions " +
        "par SDR. A utiliser pour 'cette liste est-elle saine', 'pourquoi la liste n'avance plus'.",
    parameters: {
        type: "object",
        properties: {
            listId: { type: "string", description: "Identifiant de la liste." },
        },
        required: ["listId"],
        additionalProperties: false,
    },
    schema: listHealthArgs,
    allowedRoles: ["SDR", "BOOKER", "MANAGER"],
    execute: async (args: z.infer<typeof listHealthArgs>, ctx: AIRequestContext) => {
        const missionIds = resolveMissionScope(ctx);

        const list = await prisma.list.findFirst({
            where: {
                id: args.listId,
                ...(missionIds === null ? {} : { missionId: { in: missionIds } }),
            },
            select: { id: true, name: true, missionId: true },
        });

        if (!list) {
            throw new ToolAuthorizationError("Liste introuvable ou hors perimetre.", "out_of_scope");
        }

        const health = await computeListHealth(list.id);
        if (!health) {
            throw new ToolAuthorizationError("Liste introuvable.", "not_found");
        }

        return health;
    },
});
