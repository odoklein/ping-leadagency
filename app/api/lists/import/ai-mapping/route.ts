import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { geminiGenerate } from "@/lib/ai/gemini";
import { openaiChatComplete } from "@/lib/ai/openai";
import { mistralFetch } from "@/lib/ai/mistral";
import { CSV_PRESETS } from "@/lib/csv/presets";

// ============================================
// TYPES
// ============================================

export interface AiMappingSuggestion {
    csvColumn: string;
    targetField: string;
    confidence: number;
    reasoning: string;
    isCustomField?: boolean;
}

export interface AiMappingResponse {
    success: boolean;
    provider: "gemini" | "openai" | "mistral" | "heuristic";
    detectedType: string;
    overview: string;
    suggestions: AiMappingSuggestion[];
    actionSuggestions?: {
        statusColumn?: string;
        dateColumn?: string;
        noteColumn?: string;
    };
}

const CRM_FIELDS_REFERENCE = `
Champs Société standard :
- "company.name" : Nom de l'entreprise ou raison sociale (OBLIGATOIRE)
- "company.website" : Site web, URL ou nom de domaine
- "company.industry" : Secteur d'activité, industrie ou code NAF
- "company.country" : Pays ou région géographique
- "company.phone" : Numéro de téléphone standard ou fixe de la société
- "company.size" : Taille, nombre d'employés ou effectif

Champs Contact standard :
- "contact.firstName" : Prénom du contact
- "contact.lastName" : Nom de famille du contact
- "contact.email" : Adresse email professionnelle ou personnelle
- "contact.phone" : Numéro de téléphone direct ou mobile
- "contact.title" : Fonction, poste, titre ou rôle dans l'entreprise
- "contact.linkedin" : URL du profil LinkedIn individuel

Si une colonne contient une information intéressante mais non standard (ex: SIREN, CA, Chiffre d'affaires, Ville, Adresse, Outils, Technologies, Tags), propose un champ personnalisé sous la forme "company.<nom_en_snake_case>" ou "contact.<nom_en_snake_case>" et marque isCustomField à true.
Si une colonne n'a aucune valeur CRM utile (ex: ID interne, timestamp technique, hash), renvoie une chaîne vide "" pour targetField.
`;

function runLocalHeuristicMapping(
    headers: string[],
    sampleRows: Record<string, string>[],
    importType: string
): AiMappingResponse {
    const suggestions: AiMappingSuggestion[] = [];
    const usedTargets = new Set<string>();

    for (const header of headers) {
        const lower = header.toLowerCase().trim();
        const samples = sampleRows.map((r) => (r[header] || "").trim()).filter(Boolean);
        const sampleText = samples.join(" ").toLowerCase();

        let targetField = "";
        let confidence = 50;
        let reasoning = "Détection heuristique basée sur le titre de la colonne";
        let isCustom = false;

        // Check for Email
        if (lower.includes("email") || lower.includes("mail") || samples.some((s) => s.includes("@"))) {
            targetField = "contact.email";
            confidence = 95;
            reasoning = "Contient des adresses email valides";
        }
        // Check for Company Name
        else if (
            (lower.includes("company") || lower.includes("société") || lower.includes("entreprise") || lower.includes("nom entreprise") || lower === "nom" || lower === "name") &&
            !lower.includes("first") && !lower.includes("last") && !lower.includes("prénom") && !usedTargets.has("company.name")
        ) {
            targetField = "company.name";
            confidence = 92;
            reasoning = "Identifié comme le nom principal de la société";
        }
        // Check for First Name
        else if (lower.includes("firstname") || lower.includes("prénom") || lower === "first name" || lower === "prenom") {
            targetField = "contact.firstName";
            confidence = 94;
            reasoning = "Prénom du prospect";
        }
        // Check for Last Name
        else if (lower.includes("lastname") || lower === "nom" || lower === "last name" || lower.includes("surname")) {
            targetField = "contact.lastName";
            confidence = 92;
            reasoning = "Nom de famille du prospect";
        }
        // Check for Website
        else if (lower.includes("website") || lower.includes("site") || lower.includes("url") || lower.includes("domain") || samples.some((s) => /^https?:\/\//i.test(s) || /\.([a-z]{2,8})$/i.test(s))) {
            targetField = "company.website";
            confidence = 90;
            reasoning = "Format de site web ou nom de domaine";
        }
        // Check for Phone
        else if (lower.includes("phone") || lower.includes("téléphone") || lower.includes("tel") || lower.includes("mobile")) {
            if (lower.includes("company") || lower.includes("société") || lower.includes("corporate") || lower.includes("standard")) {
                targetField = "company.phone";
                confidence = 88;
                reasoning = "Ligne téléphonique fixe / standard de l'entreprise";
            } else {
                targetField = "contact.phone";
                confidence = 88;
                reasoning = "Ligne téléphonique directe ou mobile";
            }
        }
        // Check for Job Title
        else if (lower.includes("title") || lower.includes("fonction") || lower.includes("poste") || lower.includes("job") || lower.includes("role")) {
            targetField = "contact.title";
            confidence = 89;
            reasoning = "Poste ou fonction professionnelle";
        }
        // Check for LinkedIn
        else if (lower.includes("linkedin")) {
            targetField = "contact.linkedin";
            confidence = 96;
            reasoning = "Lien vers profil LinkedIn";
        }
        // Check for Industry
        else if (lower.includes("industry") || lower.includes("secteur") || lower.includes("industrie") || lower.includes("naf")) {
            targetField = "company.industry";
            confidence = 85;
            reasoning = "Secteur d'activité ou industrie";
        }
        // Check for Country
        else if (lower.includes("country") || lower.includes("pays") || lower.includes("nation")) {
            targetField = "company.country";
            confidence = 87;
            reasoning = "Localisation géographique";
        }
        // Check for Size
        else if (lower.includes("size") || lower.includes("taille") || lower.includes("employees") || lower.includes("effectif") || lower.includes("headcount")) {
            targetField = "company.size";
            confidence = 86;
            reasoning = "Taille ou tranche d'effectifs de l'entreprise";
        }
        // Check for SIREN / SIRET
        else if (lower.includes("siren") || lower.includes("siret")) {
            targetField = "company.siren";
            confidence = 80;
            reasoning = "Identifiant légal d'entreprise (champ personnalisé)";
            isCustom = true;
        }

        if (targetField && !usedTargets.has(targetField)) {
            if (!isCustom) usedTargets.add(targetField);
        } else if (targetField && usedTargets.has(targetField)) {
            // Already mapped to another column, decrease confidence
            confidence = Math.max(30, confidence - 25);
        }

        suggestions.push({
            csvColumn: header,
            targetField,
            confidence,
            reasoning,
            isCustomField: isCustom,
        });
    }

    return {
        success: true,
        provider: "heuristic",
        detectedType: importType === "companies-only" ? "Répertoire Entreprises" : "Fichier B2B Prospection",
        overview: `Analyse automatique effectuée sur ${headers.length} colonnes. ${suggestions.filter((s) => s.targetField).length} correspondances identifiées.`,
        suggestions,
    };
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "MANAGER") {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const headers = (body.headers as string[]) || [];
        const sampleRows = (body.sampleRows as Record<string, string>[]) || [];
        const importType = (body.importType as string) || "companies-contacts";

        if (headers.length === 0) {
            return NextResponse.json({ success: false, error: "Headers CSV manquants" }, { status: 400 });
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const mistralKey = process.env.MISTRAL_API_KEY;

        const systemPrompt = `Tu es l'expert en ingestion de données et CRM pour Ping Lead Agency.
Ta mission est d'analyser les colonnes d'un fichier CSV (avec les noms des colonnes et des exemples réels de données) et de proposer le mapping parfait vers les champs CRM.

${CRM_FIELDS_REFERENCE}

Format attendu en JSON strict sans aucun formatage Markdown autour :
{
  "detectedType": "Nom du type de fichier (ex: Export Apollo B2B, Répertoire Sirene, Leads LinkedIn)",
  "overview": "Résumé en 1 ou 2 phrases en français sur la qualité et la structure du fichier",
  "suggestions": [
    {
      "csvColumn": "Nom exact de la colonne",
      "targetField": "Le champ cible CRM (ou '' si ignoré)",
      "confidence": 95,
      "reasoning": "Explication courte en français justifiant pourquoi ce champ a été choisi",
      "isCustomField": false
    }
  ],
  "actionSuggestions": {
    "statusColumn": "Nom de la colonne de statut si elle existe, sinon null",
    "dateColumn": "Nom de la colonne de date si elle existe, sinon null",
    "noteColumn": "Nom de la colonne de note si elle existe, sinon null"
  }
}`;

        const sampleSnippet = JSON.stringify(sampleRows.slice(0, 3), null, 2);
        const userPrompt = `Colonnes CSV à mapper :
${headers.map((h, i) => `${i + 1}. "${h}"`).join("\n")}

Exemples de lignes :
${sampleSnippet}

Type d'import sélectionné : ${importType}

Génère la réponse JSON.`;

        // 1) Try Gemini
        if (geminiKey) {
            try {
                const res = await geminiGenerate(geminiKey, systemPrompt, userPrompt, {
                    json: true,
                    temperature: 0.2,
                });
                if (res.text) {
                    const parsed = JSON.parse(res.text) as Omit<AiMappingResponse, "success" | "provider">;
                    return NextResponse.json({
                        success: true,
                        provider: "gemini",
                        detectedType: parsed.detectedType || "Fichier B2B",
                        overview: parsed.overview || "Colonnes analysées avec Google Gemini AI",
                        suggestions: parsed.suggestions || [],
                        actionSuggestions: parsed.actionSuggestions,
                    });
                }
            } catch (err) {
                console.warn("Gemini mapping failed, attempting fallback:", err);
            }
        }

        // 2) Try OpenAI
        if (openaiKey) {
            try {
                const res = await openaiChatComplete(
                    openaiKey,
                    [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    { temperature: 0.2 }
                );
                if (res.text) {
                    const cleanText = res.text.replace(/```json\n?|\n?```/g, "").trim();
                    const parsed = JSON.parse(cleanText) as Omit<AiMappingResponse, "success" | "provider">;
                    return NextResponse.json({
                        success: true,
                        provider: "openai",
                        detectedType: parsed.detectedType || "Fichier B2B",
                        overview: parsed.overview || "Colonnes analysées avec OpenAI",
                        suggestions: parsed.suggestions || [],
                        actionSuggestions: parsed.actionSuggestions,
                    });
                }
            } catch (err) {
                console.warn("OpenAI mapping failed, attempting fallback:", err);
            }
        }

        // 3) Try Mistral
        if (mistralKey) {
            try {
                const res = await mistralFetch(mistralKey, {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature: 0.2,
                    response_format: { type: "json_object" },
                });
                if (res.ok) {
                    const json = await res.json();
                    const content = json.choices?.[0]?.message?.content;
                    if (content) {
                        const parsed = JSON.parse(content) as Omit<AiMappingResponse, "success" | "provider">;
                        return NextResponse.json({
                            success: true,
                            provider: "mistral",
                            detectedType: parsed.detectedType || "Fichier B2B",
                            overview: parsed.overview || "Colonnes analysées avec Mistral AI",
                            suggestions: parsed.suggestions || [],
                            actionSuggestions: parsed.actionSuggestions,
                        });
                    }
                }
            } catch (err) {
                console.warn("Mistral mapping failed, attempting fallback:", err);
            }
        }

        // 4) Deterministic Heuristic Engine Fallback
        const heuristicResult = runLocalHeuristicMapping(headers, sampleRows, importType);
        return NextResponse.json(heuristicResult);
    } catch (error: unknown) {
        console.error("AI mapping endpoint error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur lors de l'analyse IA" },
            { status: 500 }
        );
    }
}
