import type { MissionStatusValue } from "@/lib/constants/missionStatus";

export interface ListItem {
    id: string;
    name: string;
    type: string;
    _count: { companies: number };
}

export interface CampaignItem {
    id: string;
    name: string;
    icp?: string;
}

export interface Mission {
    id: string;
    name: string;
    channel: "CALL" | "EMAIL" | "LINKEDIN";
    channels?: ("CALL" | "EMAIL" | "LINKEDIN")[];
    objective?: string;
    status?: MissionStatusValue;
    isActive: boolean;
    startDate: string;
    endDate?: string;
    _count: { campaigns: number; lists: number };
    lists?: ListItem[];
    campaigns?: CampaignItem[];
}

export interface PortalUser {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    isActive?: boolean;
    lastSignInAt?: string | null;
    lastSignInIp?: string | null;
    lastSignInCountry?: string | null;
    lastConnectedAt?: string | null;
}

export interface IntBookingLink {
    label: string;
    url: string;
    durationMinutes: number;
}

export interface ContactEntry {
    value: string;
    label: string;
    isPrimary: boolean;
}

export interface ClientInterlocuteur {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
    department?: string;
    territory?: string;
    emails: ContactEntry[];
    phones: ContactEntry[];
    bookingLinks: IntBookingLink[];
    notes?: string;
    isActive: boolean;
    createdAt: string;
    portalUser?: {
        id: string;
        email: string;
        name: string;
        isActive: boolean;
    } | null;
}

export interface Client {
    id: string;
    name: string;
    industry?: string;
    email?: string;
    phone?: string;
    bookingUrl?: string;
    portalShowCallHistory?: boolean;
    portalShowDatabase?: boolean;
    createdAt: string;
    _count: { missions: number; users: number };
    missions?: Mission[];
    users?: PortalUser[];
    interlocuteurs?: ClientInterlocuteur[];
    onboarding?: { onboardingData?: { icp?: string } | null } | null;
    insights?: {
        production: {
            month: string;
            plannedMonthDays: number | null;
            plannedWeekDays: number | null;
            executedDays: number;
            totalActions: number;
            totalCalls: number;
            totalMeetings: number;
        };
        engagement?: {
            id: string;
            dureeMois: number;
            debut: string;
            fin: string;
            statut: string;
            offreTarif: { nom: string };
        } | null;
    };
}

export interface Meeting {
    id: string;
    createdAt: string;
    callbackDate?: string | null;
    meetingType?: "VISIO" | "PHYSIQUE" | "TELEPHONIQUE" | null;
    meetingAddress?: string | null;
    meetingJoinUrl?: string | null;
    meetingPhone?: string | null;
    contact: {
        id: string;
        firstName?: string;
        lastName?: string;
        title?: string;
        email?: string;
        phone?: string | null;
        company: { id: string; name: string; industry?: string };
    };
    campaign: {
        id: string;
        name: string;
        missionId: string;
        mission: { id: string; name: string };
    };
    sdr: { id: string; name: string; email: string };
}

export interface MeetingsData {
    totalMeetings: number;
    byMission: Array<{
        missionId: string;
        missionName: string;
        count: number;
        meetings: Meeting[];
    }>;
    allMeetings: Meeting[];
}

export interface LeexiTranscription {
    id: string;
    title: string;
    date: string;
    duration: number;
    participants: string[];
    transcript?: string;
    recordingUrl?: string;
}

export type SessionType = "Kick-Off" | "Onboarding" | "Validation" | "Reporting" | "Suivi" | "Autre";

export interface SessionTask {
    id: string;
    label: string;
    assignee?: string;
    assigneeRole?: "SDR" | "MANAGER" | "DEV" | "ALWAYS";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate?: string | null;
    doneAt?: string | null;
    taskId?: string | null;
}

export interface ClientSession {
    id: string;
    type: SessionType;
    customTypeLabel?: string;
    date: string;
    leexiId?: string;
    recordingUrl?: string;
    crMarkdown?: string;
    summaryEmail?: string;
    emailSentAt?: string | null;
    projectId?: string | null;
    tasks: SessionTask[];
    createdAt: string;
}

export const ROLE_BADGE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    SDR: { color: "#059669", bg: "rgba(16,185,129,0.12)", label: "SDR" },
    MANAGER: { color: "#2890F8", bg: "rgba(40,144,248,0.12)", label: "Manager" },
    DEV: { color: "#080808", bg: "rgba(8,8,8,0.08)", label: "Dev" },
    ALWAYS: { color: "#475569", bg: "rgba(71,85,105,0.12)", label: "Tous" },
};

export const PRIORITY_INDICATOR: Record<string, { color: string; label: string; bg: string }> = {
    URGENT: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "⚡ Urgent" },
    HIGH: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "↑ Élevée" },
    MEDIUM: { color: "#2890F8", bg: "rgba(40,144,248,0.1)", label: "→ Normale" },
    LOW: { color: "#64748B", bg: "rgba(100,116,139,0.1)", label: "↓ Basse" },
};

export const SESSION_TYPE_COLORS: Record<SessionType, { bg: string; text: string; border: string }> = {
    "Kick-Off": { bg: "bg-blue-50/80", text: "text-[#2890F8]", border: "border-blue-200/60" },
    "Onboarding": { bg: "bg-emerald-50/80", text: "text-emerald-700", border: "border-emerald-200/60" },
    "Validation": { bg: "bg-amber-50/80", text: "text-amber-700", border: "border-amber-200/60" },
    "Reporting": { bg: "bg-indigo-50/80", text: "text-indigo-700", border: "border-indigo-200/60" },
    "Suivi": { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    "Autre": { bg: "bg-slate-50", text: "text-slate-800", border: "border-slate-300" },
};

export const SESSION_MARKDOWN_CLASS =
    "prose prose-sm prose-slate max-w-none text-slate-800 " +
    "[&_h1]:text-slate-950 [&_h1]:font-black [&_h1]:text-xl [&_h1]:mb-3 " +
    "[&_h2]:text-slate-900 [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-5 [&_h2]:mb-2 " +
    "[&_h3]:text-slate-900 [&_h3]:font-semibold [&_h3]:text-sm [&_h3]:mt-3 " +
    "[&_p]:text-slate-700 [&_p]:leading-relaxed [&_li]:text-slate-700 " +
    "[&_strong]:text-slate-950 [&_strong]:font-semibold " +
    "[&_a]:text-[#2890F8] [&_a]:underline [&_a]:underline-offset-2 " +
    "[&_code]:text-slate-900 [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded " +
    "[&_pre]:bg-slate-950 [&_pre]:text-slate-100 [&_blockquote]:border-l-4 [&_blockquote]:border-[#2890F8] [&_blockquote]:pl-4 [&_blockquote]:italic";

export const CHANNEL_LABELS: Record<string, string> = {
    CALL: "Appel",
    EMAIL: "Email",
    LINKEDIN: "LinkedIn",
};

export function generateRandomPassword(length = 14): string {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

export function buildCRPrompt({
    clientName,
    sessionType,
    sessionDate,
    transcript,
    crPublicUrl = "[URL_ESPACE_CLIENT]",
    notifyByEmail = false,
}: {
    clientName: string;
    sessionType: string;
    sessionDate: string;
    transcript: string;
    crPublicUrl?: string;
    notifyByEmail?: boolean;
}): string {
    return `Tu es un assistant expert en relation client B2B pour une agence de prospection commerciale haut de gamme (Ping Lead Agency).
À partir de la transcription intégrale ci-dessous d'une session de type "${sessionType}" avec le client "${clientName}" (${sessionDate}), produis EXACTEMENT deux blocs séparés par le séparateur "---EMAIL_START---".

════════════════════════════════════════
BLOC 1 — COMPTE RENDU COMPLET (markdown)
════════════════════════════════════════
Rédige un compte rendu structuré, détaillé et fidèle au déroulé de la réunion.
- Commence par un titre H1 : "CR du ${sessionDate} — ${clientName} (${sessionType})"
- Utilise des titres H2/H3 pour chaque grande section
- Mets en avant : contexte, points clés, décisions prises, questions ouvertes, prochaines étapes
- Style : fluide, professionnel, précis mais humain
- À la fin, ajoute une section "## Prochaines étapes" avec une liste numérotée claire
- Langue : français

════════════════════════════════════════
BLOC 2 — MAIL DE SYNTHÈSE DIRIGEANTS
════════════════════════════════════════
Rédige un mail extrêmement concis, percutant et professionnel dans l'esprit Ping Lead Agency.
Règles impératives :
- Commence UNIQUEMENT par le prénom du contact principal suivi d'une virgule
- Phrase d'intro naturelle type "Merci pour notre échange, voici l'essentiel à retenir" (varier la tournure à chaque fois)
- Aucun emoji, icône ou smiley
- Points numérotés (max 5), chacun en une phrase directe et actionnable couvrant : sujets clés, prochaines étapes, actions de chaque partie
- Termine par une phrase du type "Retrouve le compte rendu complet ici : ${crPublicUrl}" (varier la tournure)
- Lisible en moins de 30 secondes
- Langue : français
${notifyByEmail
    ? "\n⚠️ NOTE SYSTÈME : Ce mail sera envoyé automatiquement au client après validation. Assure-toi qu'il est prêt à l'envoi."
    : "\n⚠️ NOTE SYSTÈME : Ce mail ne sera PAS envoyé automatiquement. Il sera copié manuellement par l'équipe."}

════════════════════════════════════════
TRANSCRIPTION
════════════════════════════════════════
${transcript}

════════════════════════════════════════
FORMAT DE RÉPONSE OBLIGATOIRE
════════════════════════════════════════
[compte rendu markdown complet ici]

---EMAIL_START---

[mail de synthèse ici]
`;
}

export function getSessionTypeLabel(session: ClientSession): string {
    return session.type === "Autre" && session.customTypeLabel?.trim()
        ? session.customTypeLabel.trim()
        : session.type;
}
