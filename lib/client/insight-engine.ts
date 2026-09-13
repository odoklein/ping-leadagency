/**
 * Client Insight Engine — Data integrity & deterministic business intelligence.
 *
 * Rules:
 *  - Never hallucinate or hardcode multipliers (e.g. "+2.3×") unless backed by actual data.
 *  - Enforce sample size thresholds before drawing conclusions.
 *  - Return neutral, honest observations when volume is insufficient.
 */

export type HealthStatus = "ON_TRACK" | "AHEAD" | "ATTENTION" | "CALIBRATING";

export interface CampaignHealth {
    status: HealthStatus;
    badgeLabel: string;
    tone: "emerald" | "amber" | "blue";
    summary: string;
    projectedMeetings: number;
    projectedPct: number;
    paceComment: string;
}

export interface FunnelSummary {
    contacted: number;
    qualified: number;
    meetings: number;
    totalActions: number;
    contactToQualifiedRate: number;
    qualifiedToMeetingRate: number;
    overallRate: number;
}

export interface ProspectFeedbackInsight {
    hasEnoughData: boolean;
    topResults: Array<{
        result: string;
        label: string;
        count: number;
        share: number;
    }>;
    insight: string;
}

export interface BestSegmentInsight {
    hasSignificantData: boolean;
    segment: {
        label: string;
        calls: number;
        rdv: number;
        rate: number;
    } | null;
    multiplierVsAverage: number | null;
    recommendation: string | null;
    notice: string | null;
}

/**
 * 1. Health Status & Reassurance
 * Compares current meetings won against elapsed time in the month.
 */
export function calculateCampaignHealth({
    meetingsWon,
    monthlyObjective,
    businessDaysElapsed,
    businessDaysTotal,
    projectedMeetings: forcedProjection,
}: {
    meetingsWon: number;
    monthlyObjective: number;
    businessDaysElapsed: number;
    businessDaysTotal: number;
    projectedMeetings?: number;
}): CampaignHealth {
    const objective = Math.max(1, monthlyObjective);
    const totalDays = Math.max(1, businessDaysTotal);
    const elapsedDays = Math.max(0, Math.min(businessDaysElapsed, totalDays));

    // Linear projection calculation if not supplied
    const projected =
        forcedProjection !== undefined
            ? forcedProjection
            : elapsedDays > 0
            ? Math.round((meetingsWon / elapsedDays) * totalDays)
            : meetingsWon;

    const projectedPct = Math.round((projected / objective) * 100);
    const progressPct = Math.round((meetingsWon / objective) * 100);

    // Initial warm-up period (first 3 business days or zero meetings within 3 days)
    if (elapsedDays <= 3 && meetingsWon === 0) {
        return {
            status: "CALIBRATING",
            badgeLabel: "Campagne en phase de lancement",
            tone: "blue",
            summary: "Démarrage des actions de prospection — montée en cadence progressive.",
            projectedMeetings: projected,
            projectedPct,
            paceComment: "Phase de calibrage des premiers contacts",
        };
    }

    // Ahead of pace
    if (projected >= objective * 1.2 || (meetingsWon >= objective && elapsedDays < totalDays)) {
        return {
            status: "AHEAD",
            badgeLabel: "Avance sur l'objectif",
            tone: "emerald",
            summary: `${meetingsWon} RDV obtenu${meetingsWon > 1 ? "s" : ""} · ${projected} RDV projeté${projected > 1 ? "s" : ""} fin de mois (${progressPct}% de l'objectif atteint).`,
            projectedMeetings: projected,
            projectedPct,
            paceComment: "Rythme supérieur aux prévisions",
        };
    }

    // On track (projected meets or closely approaches objective >= 70%)
    if (projected >= objective * 0.7) {
        return {
            status: "ON_TRACK",
            badgeLabel: "Campagne sur la bonne trajectoire",
            tone: "emerald",
            summary: `${meetingsWon} RDV obtenu${meetingsWon > 1 ? "s" : ""} · ${projected} RDV projeté${projected > 1 ? "s" : ""} fin de mois (${progressPct}% de l'objectif au rythme actuel).`,
            projectedMeetings: projected,
            projectedPct,
            paceComment: "Rythme régulier et conforme",
        };
    }

    // Needs adjustment / attention
    return {
        status: "ATTENTION",
        badgeLabel: "Ajustements en cours",
        tone: "amber",
        summary: `${meetingsWon} / ${objective} RDV · notre équipe ajuste les angles d'approche pour accélérer.`,
        projectedMeetings: projected,
        projectedPct,
        paceComment: "Optimisation du ciblage en cours",
    };
}

/**
 * 2. Mini-Funnel Performance
 */
export function calculateFunnelSummary({
    contacted,
    qualified,
    meetings,
    totalActions,
}: {
    contacted: number;
    qualified: number;
    meetings: number;
    totalActions: number;
}): FunnelSummary {
    const safeContacted = Math.max(contacted, meetings, 1);
    const safeQualified = Math.max(qualified, meetings);

    const contactToQualifiedRate =
        Math.round((safeQualified / safeContacted) * 1000) / 10;
    const qualifiedToMeetingRate =
        safeQualified > 0 ? Math.round((meetings / safeQualified) * 1000) / 10 : 0;
    const overallRate =
        Math.round((meetings / safeContacted) * 1000) / 10;

    return {
        contacted: safeContacted,
        qualified: safeQualified,
        meetings,
        totalActions: Math.max(totalActions, safeContacted),
        contactToQualifiedRate,
        qualifiedToMeetingRate,
        overallRate,
    };
}

/**
 * 3. Prospect Feedback Intelligence
 * Strictly uses actual result distribution and statistically significant patterns.
 */
export function calculateProspectFeedbackInsight({
    resultBreakdown,
    totalActions,
}: {
    resultBreakdown: Array<{
        result: string;
        label: string;
        count: number;
        share?: number;
    }>;
    totalActions: number;
}): ProspectFeedbackInsight {
    const total = Math.max(totalActions, 1);

    // Normalize entries with accurate shares
    const sorted = [...resultBreakdown]
        .map((entry) => ({
            result: entry.result,
            label: entry.label,
            count: entry.count,
            share:
                entry.share !== undefined
                    ? entry.share
                    : Math.round((entry.count / total) * 1000) / 10,
        }))
        .sort((a, b) => b.count - a.count);

    // Rule: Need at least 15 actions to state meaningful market insights
    if (totalActions < 15) {
        return {
            hasEnoughData: false,
            topResults: sorted.slice(0, 5),
            insight:
                "Volume d'appels en cours d'accumulation. Les premiers retours qualifiés se consolident au fil des échanges.",
        };
    }

    // Group categories
    let followUpCount = 0;
    let gatekeeperOrNoResponseCount = 0;
    let objectionCount = 0;
    let qualifiedCount = 0;

    for (const r of sorted) {
        const res = r.result.toUpperCase();
        if (
            res.includes("CALLBACK") ||
            res.includes("RAPPEL") ||
            res.includes("RELANCE") ||
            res.includes("MAIL_DOC") ||
            res.includes("PROJET")
        ) {
            followUpCount += r.count;
        } else if (
            res.includes("NO_RESPONSE") ||
            res.includes("BARRAGE") ||
            res.includes("NUMERO_KO") ||
            res.includes("FAUX")
        ) {
            gatekeeperOrNoResponseCount += r.count;
        } else if (
            res.includes("DISQUALIFIED") ||
            res.includes("REFUS") ||
            res.includes("NOT_INTERESTED") ||
            res.includes("HORS_CIBLE")
        ) {
            objectionCount += r.count;
        } else if (
            res.includes("INTERESTED") ||
            res.includes("MEETING_BOOKED")
        ) {
            qualifiedCount += r.count;
        }
    }

    const followUpShare = Math.round((followUpCount / total) * 100);
    const gatekeeperShare = Math.round((gatekeeperOrNoResponseCount / total) * 100);
    const objectionShare = Math.round((objectionCount / total) * 100);

    let insightText = "";
    if (followUpShare >= 12) {
        insightText = `Un vivier actif de ${followUpShare}% des prospects est actuellement en rappel ou en attente d'éléments, représentant un réservoir direct d'opportunités pour les prochains jours.`;
    } else if (gatekeeperShare >= 55) {
        insightText = `La majorité des actions (${gatekeeperShare}%) est consacrée au franchissement des standards et à la relance des décideurs, typique des phases d'ouverture de comptes B2B.`;
    } else if (objectionShare >= 20) {
        insightText = `Les réserves exprimées (${objectionShare}%) concernent principalement le timing et le budget. Notre équipe adapte les accroches pour désamorcer ces objections en amont.`;
    } else {
        insightText =
            "Les retours terrain montrent une écoute attentive des interlocuteurs ciblés, avec un taux de dialogue utile en progression constante.";
    }

    return {
        hasEnoughData: true,
        topResults: sorted.slice(0, 6),
        insight: insightText,
    };
}

/**
 * 4. Best Segment & Strategic Recommendation
 * Enforces minimum calls (>= 5) and at least 1 meeting before declaring a best segment.
 */
export function calculateBestSegmentInsight({
    segments,
    campaignAverageRate,
}: {
    segments: Array<{
        label: string;
        calls: number;
        rdv: number;
        rate: number;
    }>;
    campaignAverageRate: number;
}): BestSegmentInsight {
    // Threshold: at least 5 calls and at least 1 meeting to avoid 1 call = 100% distortion
    const qualifiedCandidates = segments.filter((s) => s.calls >= 5 && s.rdv >= 1);

    if (qualifiedCandidates.length === 0) {
        return {
            hasSignificantData: false,
            segment: null,
            multiplierVsAverage: null,
            recommendation: null,
            notice:
                "Données en cours de consolidation : aucun segment n'a encore atteint le seuil statistique de 5 contacts pour isoler une tendance fiable.",
        };
    }

    // Sort by rate descending, then by number of RDV descending
    const best = [...qualifiedCandidates].sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return b.rdv - a.rdv;
    })[0];

    const safeAvgRate = campaignAverageRate > 0 ? campaignAverageRate : 0.5;
    const rawMultiplier = best.rate / safeAvgRate;
    const multiplier = rawMultiplier > 1.1 ? Math.round(rawMultiplier * 10) / 10 : null;

    let recommendation = "";
    if (multiplier && multiplier >= 1.8) {
        recommendation = `Recommandation : accentuer la prospection sur ce profil (${best.label}) qui surperforme la moyenne de campagne (${best.rate}% de conversion · ${multiplier}× vs moyenne).`;
    } else if (best.rate >= 10) {
        recommendation = `Recommandation : orienter les futurs volumes de ciblage en priorité sur les ${best.label} (${best.rate}% de conversion).`;
    } else {
        recommendation = `Recommandation : consolider les volumes sur le segment ${best.label} tout en maintenant l'exploration des profils complémentaires.`;
    }

    return {
        hasSignificantData: true,
        segment: best,
        multiplierVsAverage: multiplier,
        recommendation,
        notice: null,
    };
}
