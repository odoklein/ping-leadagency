/**
 * Product-knowledge lookup. No tenant data, no database — safe for every role.
 * Wraps the existing docs retriever so the model can pull help on demand
 * instead of having it always pre-injected into the prompt.
 */

import { z } from "zod";
import { AIRequestContext } from "../types";
import { defineTool, strictArgs } from "../helpers";
import { buildDocsContext } from "@/lib/assistant/docs/loader";

const helpArgs = strictArgs({
    query: z.string().min(2).max(300),
    pathname: z.string().max(300).optional(),
});

export const searchPingHelp = defineTool({
    name: "search_ping_help",
    description:
        "Recherche dans la documentation produit de Ping (navigation, missions, campagnes, " +
        "listes, email hub, planning, facturation, portail client, workflows SDR). " +
        "A utiliser pour toute question 'comment faire X dans Ping'. Ne contient aucune donnee client.",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string", description: "La question ou les mots-cles a rechercher." },
            pathname: {
                type: "string",
                description: "Page actuellement ouverte, pour prioriser la documentation pertinente.",
            },
        },
        required: ["query"],
        additionalProperties: false,
    },
    schema: helpArgs,
    allowedRoles: [
        "SDR",
        "BOOKER",
        "MANAGER",
        "CLIENT",
        "DEVELOPER",
        "BUSINESS_DEVELOPER",
        "COMMERCIAL",
    ],
    execute: async (args: z.infer<typeof helpArgs>, ctx: AIRequestContext) => {
        const content = buildDocsContext(args.pathname ?? "", args.query, ctx.role);
        if (!content) {
            return {
                found: false,
                content: null,
                hint: "Aucune documentation ne correspond. Repondre depuis les connaissances produit du prompt systeme.",
            };
        }
        return { found: true, content };
    },
});
