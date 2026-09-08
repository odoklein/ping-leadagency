/**
 * CSV Field Mapping Presets for popular CRM, lead generation, and enrichment tools.
 */

export interface PresetMapping {
    /** Target field key (e.g. "company.name", "contact.email") */
    targetField: string;
    /** CSV column header patterns that match this target field */
    headers: string[];
}

export interface CsvPreset {
    id: string;
    name: string;
    description: string;
    badgeColor?: string;
    mappings: PresetMapping[];
}

export const CSV_PRESETS: CsvPreset[] = [
    {
        id: "apollo",
        name: "Apollo.io",
        description: "Export standard de prospects ou de sociétés depuis Apollo.io",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
        mappings: [
            { targetField: "company.name", headers: ["company", "company name", "company_name", "organization", "account_name"] },
            { targetField: "company.website", headers: ["website", "company website", "company_website", "company_domain", "domain"] },
            { targetField: "company.industry", headers: ["industry", "company industry", "industry_name"] },
            { targetField: "company.country", headers: ["country", "company country", "company_country", "company_location"] },
            { targetField: "company.phone", headers: ["company phone", "corporate phone", "company_phone", "company_phone_number"] },
            { targetField: "company.size", headers: ["# employees", "employees", "number of employees", "company size", "company_size"] },
            { targetField: "contact.firstName", headers: ["first name", "first_name", "firstname"] },
            { targetField: "contact.lastName", headers: ["last name", "last_name", "lastname", "surname"] },
            { targetField: "contact.title", headers: ["title", "job title", "headline", "job_title", "seniority"] },
            { targetField: "contact.email", headers: ["email", "work email", "email address", "contact_email", "primary_email"] },
            { targetField: "contact.phone", headers: ["phone", "mobile phone", "direct phone", "mobile", "phone_number"] },
            { targetField: "contact.linkedin", headers: ["person linkedin url", "linkedin", "linkedin url", "linkedin_url", "contact_linkedin"] },
        ],
    },
    {
        id: "clay",
        name: "Clay / Dropcontact",
        description: "Export enrichi Clay, Dropcontact ou Phantombuster",
        badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
        mappings: [
            { targetField: "company.name", headers: ["company", "company_name", "name", "organization_name", "entreprise"] },
            { targetField: "company.website", headers: ["website", "domain", "company_domain", "clean_website", "site_web"] },
            { targetField: "company.industry", headers: ["industry", "company_industry", "sector", "secteur"] },
            { targetField: "company.country", headers: ["country", "company_country", "pays"] },
            { targetField: "company.phone", headers: ["company_phone", "corporate_phone", "standard_tel", "tel_standard"] },
            { targetField: "company.size", headers: ["company_size", "size", "employee_count", "headcount", "effectif"] },
            { targetField: "contact.firstName", headers: ["first_name", "firstname", "prenom", "clean_first_name"] },
            { targetField: "contact.lastName", headers: ["last_name", "lastname", "nom", "clean_last_name"] },
            { targetField: "contact.title", headers: ["title", "job_title", "function", "poste", "fonction"] },
            { targetField: "contact.email", headers: ["email", "email_clean", "work_email", "mail", "contact_email"] },
            { targetField: "contact.phone", headers: ["phone", "direct_phone", "mobile_phone", "tel_mobile", "telephone"] },
            { targetField: "contact.linkedin", headers: ["linkedin", "linkedin_url", "person_linkedin", "url_linkedin"] },
        ],
    },
    {
        id: "hubspot",
        name: "HubSpot CRM",
        description: "Export de contacts ou entreprises depuis HubSpot",
        badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
        mappings: [
            { targetField: "company.name", headers: ["company name", "nom de l'entreprise", "associated company", "entreprise associée"] },
            { targetField: "company.website", headers: ["company domain name", "nom de domaine de l'entreprise", "website url"] },
            { targetField: "company.industry", headers: ["industry", "secteur d'activité"] },
            { targetField: "company.country", headers: ["country/region", "pays/région", "company country"] },
            { targetField: "company.phone", headers: ["phone number", "numéro de téléphone de l'entreprise", "company phone"] },
            { targetField: "company.size", headers: ["number of employees", "nombre d'employés"] },
            { targetField: "contact.firstName", headers: ["first name", "prénom"] },
            { targetField: "contact.lastName", headers: ["last name", "nom"] },
            { targetField: "contact.title", headers: ["job title", "titre professionnel", "poste"] },
            { targetField: "contact.email", headers: ["email", "adresse e-mail", "adresse email"] },
            { targetField: "contact.phone", headers: ["mobile phone number", "numéro de téléphone portable", "phone number"] },
            { targetField: "contact.linkedin", headers: ["linkedin", "linkedin url"] },
        ],
    },
    {
        id: "salesforce",
        name: "Salesforce CRM",
        description: "Export standard de pistes (Leads) ou comptes (Accounts)",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
        mappings: [
            { targetField: "company.name", headers: ["company", "account name", "company / account"] },
            { targetField: "company.website", headers: ["website", "account website"] },
            { targetField: "company.industry", headers: ["industry"] },
            { targetField: "company.country", headers: ["country", "billing country", "country (lead)"] },
            { targetField: "company.phone", headers: ["company phone", "account phone"] },
            { targetField: "company.size", headers: ["employees", "number of employees"] },
            { targetField: "contact.firstName", headers: ["first name", "prenom"] },
            { targetField: "contact.lastName", headers: ["last name", "nom"] },
            { targetField: "contact.title", headers: ["title", "job title"] },
            { targetField: "contact.email", headers: ["email"] },
            { targetField: "contact.phone", headers: ["mobile", "mobile phone", "phone"] },
            { targetField: "contact.linkedin", headers: ["linkedin", "linkedin url"] },
        ],
    },
    {
        id: "societe_info",
        name: "Societe.info / B2B FR",
        description: "Fichiers B2B légaux français (Societe.info, Infogreffe, Sirene)",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
        mappings: [
            { targetField: "company.name", headers: ["denomination", "nom entreprise", "raison sociale", "nom", "societe", "entreprise"] },
            { targetField: "company.website", headers: ["site web", "site internet", "url", "web", "domaine"] },
            { targetField: "company.industry", headers: ["code naf", "libelle naf", "activite", "secteur"] },
            { targetField: "company.country", headers: ["pays", "pays siege"] },
            { targetField: "company.phone", headers: ["telephone", "tel standard", "telephone siege"] },
            { targetField: "company.size", headers: ["tranche effectif", "effectif", "nb employes"] },
            { targetField: "contact.firstName", headers: ["prenom dirigeant", "prenom", "prenom contact"] },
            { targetField: "contact.lastName", headers: ["nom dirigeant", "nom", "nom contact"] },
            { targetField: "contact.title", headers: ["fonction", "qualite", "poste"] },
            { targetField: "contact.email", headers: ["email", "email direct", "email dirigeant"] },
            { targetField: "contact.phone", headers: ["tel direct", "mobile", "telephone direct"] },
            { targetField: "contact.linkedin", headers: ["linkedin dirigeant", "linkedin"] },
        ],
    },
];

/**
 * Given a list of CSV headers, attempt to detect the best matching preset.
 * Returns the matching preset and confidence score (0 to 100).
 */
export function detectBestPreset(headers: string[]): { preset: CsvPreset; matchedCount: number; confidence: number } | null {
    if (!headers || headers.length === 0) return null;

    const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
    let bestPreset: CsvPreset | null = null;
    let maxMatches = 0;

    for (const preset of CSV_PRESETS) {
        let matches = 0;
        for (const mapping of preset.mappings) {
            const hasMatch = mapping.headers.some((pattern) =>
                normalizedHeaders.includes(pattern)
            );
            if (hasMatch) matches++;
        }

        if (matches > maxMatches && matches >= 3) {
            maxMatches = matches;
            bestPreset = preset;
        }
    }

    if (!bestPreset) return null;

    const confidence = Math.min(100, Math.round((maxMatches / Math.max(headers.length, 5)) * 100));
    return {
        preset: bestPreset,
        matchedCount: maxMatches,
        confidence,
    };
}

/**
 * Apply a preset to a list of CSV headers and return a mapping of csvColumn -> targetField.
 */
export function applyPresetMappings(
    presetId: string,
    headers: string[]
): Record<string, string> {
    const preset = CSV_PRESETS.find((p) => p.id === presetId);
    if (!preset) return {};

    const result: Record<string, string> = {};
    const usedTargets = new Set<string>();

    for (const header of headers) {
        const lowerHeader = header.trim().toLowerCase();
        for (const mapping of preset.mappings) {
            if (usedTargets.has(mapping.targetField)) continue;
            if (mapping.headers.includes(lowerHeader)) {
                result[header] = mapping.targetField;
                usedTargets.add(mapping.targetField);
                break;
            }
        }
    }

    return result;
}
