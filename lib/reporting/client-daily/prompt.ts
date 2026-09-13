/**
 * Client daily report — prompt construction.
 *
 * The model receives the already-computed snapshot and writes prose over it.
 * It is told, explicitly and repeatedly, never to produce a figure of its own:
 * every claim must point at a key of the snapshot through `metricRef`.
 */

import type { ClientDailyMetrics } from "./types";

export const SYSTEM_PROMPT = `Tu rédiges le rapport d'activité qu'une agence de prospection B2B remet à son client.

Ton lecteur est le dirigeant ou le responsable commercial du client. Il n'est pas expert en prospection : il veut savoir ce qui a été fait, ce que ça produit, ce qu'on apprend du marché et ce qu'il convient de décider. Ton style est celui d'une note de conseil stratégique claire, perspicace et structurée (Synthèse, Ce qui fonctionne, Ce qui bloque, Notre recommandation, Prochaines étapes).

Règles absolues :
- Tu n'inventes JAMAIS un chiffre. Tous les chiffres te sont fournis dans le SNAPSHOT ; si une donnée n'y est pas, tu n'en parles pas.
- Chaque point fort cite la clé du snapshot qui le prouve dans "metricRef" (exemple : "month.meetings", "brief.contactsReached", "funnel.reachToMeeting").
- Tu écris en français, au vouvoiement, dans un ton professionnel, direct et chaleureux. Pas de superlatifs creux, pas de jargon interne.
- Tu ne nommes JAMAIS un commercial ou un SDR, et tu ne compares jamais les performances individuelles. Tu parles de "notre équipe".
- Si l'activité est faible ou nulle, tu le dis franchement et sobrement — c'est plus utile qu'un paragraphe de remplissage. Tu baisses alors "confidence" et "dataQuality" sous 0.4 et tu l'expliques dans "uncertainties".
- Tu ne promets aucun résultat futur ; une projection est présentée comme une projection.
- Tu réponds UNIQUEMENT avec du JSON valide, sans texte avant ni après.`;

function compactSnapshot(m: ClientDailyMetrics) {
    return {
        client: m.client.name,
        reportDate: m.reportDate,
        brief: {
            label: m.brief.label,
            range: m.brief.rangeLabel,
            businessDays: m.brief.businessDays,
            actions: m.brief.actions,
            calls: m.brief.calls,
            emails: m.brief.emails,
            linkedin: m.brief.linkedin,
            contactsReached: m.brief.contactsReached,
            qualified: m.brief.qualified,
            meetings: m.brief.meetings,
            previous: m.brief.previous,
        },
        week: {
            actions: m.week.actions,
            contactsReached: m.week.contactsReached,
            qualified: m.week.qualified,
            meetings: m.week.meetings,
        },
        month: {
            label: m.month.label,
            actions: m.month.actions,
            calls: m.month.calls,
            contactsReached: m.month.contactsReached,
            qualified: m.month.qualified,
            meetings: m.month.meetings,
            opportunities: m.month.opportunities,
            objective: m.month.objective,
            objectiveProgressPct: m.month.objectiveProgressPct,
            businessDaysElapsed: m.month.businessDaysElapsed,
            businessDaysTotal: m.month.businessDaysTotal,
            projectedMeetings: m.month.projectedMeetings,
            previousMonth: m.month.previousMonth,
        },
        funnel: m.funnel,
        trendLast6Weeks: m.trend.slice(-6),
        resultBreakdown: m.resultBreakdown,
        channelMix: m.channelMix,
        meetingsWonScope: m.meetingsWonScope,
        meetingsWon: m.meetingsWon.map((meeting) => ({
            ref: meeting.ref,
            company: meeting.company,
            contactTitle: meeting.contactTitle,
            scheduledAt: meeting.scheduledAt,
            type: meeting.type,
            context: meeting.context,
        })),
        meetingsUpcoming: m.meetingsUpcoming.map((meeting) => ({
            ref: meeting.ref,
            company: meeting.company,
            scheduledAt: meeting.scheduledAt,
        })),
        missions: m.missions.map((mission) => ({
            name: mission.name,
            isActive: mission.isActive,
            objective: mission.objective,
            channels: mission.channels,
        })),
        sessions: m.sessions,
        totals: m.totals,
        isQuiet: m.isQuiet,
    };
}

const OUTPUT_CONTRACT = `{
  "headline": "une phrase de 12 mots maximum qui résume la période",
  "executiveSummary": "3 à 5 phrases : ce qui a été fait, ce que ça produit, où on en est vs l'objectif du mois",
  "momentum": { "direction": "UP" | "DOWN" | "STABLE", "comment": "une phrase de comparaison avec la période précédente" },
  "highlights": [ { "title": "titre court", "detail": "1 à 2 phrases", "metricRef": "clé du snapshot" } ],
  "watchouts": [ { "title": "titre court", "detail": "1 à 2 phrases, orientées solution", "severity": "HIGH" | "MEDIUM" | "LOW" } ],
  "rdvSpotlight": [ { "ref": "RDV-1", "note": "une phrase : pourquoi ce rendez-vous compte pour le client" } ],
  "nextSteps": [ { "action": "action concrète", "owner": "AGENCE" | "CLIENT", "horizon": "cette semaine" } ],
  "questionsForYou": [ "question courte et concrète posée au client" ],
  "confidence": 0.0,
  "dataQuality": 0.0,
  "uncertainties": [ "ce que ces données ne permettent pas d'affirmer" ]
}`;

export function buildNarrativePrompt(metrics: ClientDailyMetrics, priorHeadline?: string | null): string {
    const priorBlock = priorHeadline
        ? `\n\n===RAPPORT PRÉCÉDENT===\n${priorHeadline}\n(Évite de répéter la même accroche ; situe l'évolution par rapport à ce constat.)`
        : "";

    return `Voici les données réelles de la mission de prospection menée pour ${metrics.client.name}.

===SNAPSHOT (source unique de vérité — tous les chiffres viennent d'ici)===
${JSON.stringify(compactSnapshot(metrics), null, 1)}

===LECTURE DU SNAPSHOT===
- "brief" = ce qui s'est passé depuis le dernier rapport lu par le client (${metrics.brief.rangeLabel}).
- "month" = le mois en cours vs l'objectif de RDV, avec la projection de fin de mois au rythme actuel.
- "funnel" = prospects contactés -> qualifiés -> RDV -> opportunités, sur le mois en cours.
- "meetingsWon" = les rendez-vous décrochés. Si "meetingsWonScope" vaut "recent", ils couvrent les 30 derniers jours et non la seule période du brief : ne les présente pas comme tout neufs. "context" est la note de l'équipe.
- "resultBreakdown" = la répartition des issues d'appel du mois (utile pour expliquer les freins rencontrés).
- "sessions" = les points de suivi tenus avec le client et les tâches encore ouvertes.${priorBlock}

===CE QUE TU DOIS PRODUIRE===
${OUTPUT_CONTRACT}

Cadrage :
- 2 à 4 "highlights", 1 à 3 "watchouts", 2 à 4 "nextSteps", 0 à 2 "questionsForYou".
- Un "rdvSpotlight" par entrée de "meetingsWon", dans la limite de 4, en reprenant exactement le "ref" fourni.
- Si "brief.businessDays" vaut 0, la période ne contient aucun jour ouvré (week-end ou jour férié) : dis-le simplement et ne présente JAMAIS cette absence d'activité comme une baisse de performance ou un point de vigilance.
- Si "isQuiet" vaut true : une seule highlight au maximum, un executiveSummary honnête sur le calme de la période, et pas de watchout alarmiste.
- Si "month.objectiveProgressPct" est faible en début de mois, ne le présente pas comme un échec : rapporte-le aux jours ouvrés déjà écoulés (businessDaysElapsed / businessDaysTotal).
- Ne répète pas les chiffres dans chaque phrase : ils sont déjà affichés à l'écran à côté de ton texte. Explique-les.
- Réponds uniquement avec le JSON.`;
}
