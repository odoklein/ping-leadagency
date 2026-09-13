// Verification script for the client daily report (lib/reporting/client-daily).
// Run with:  npx dotenv -e .env -- tsx scripts/check-daily-report.ts
// Add --generate to also run the Mistral call and print the narrative.
//
// 1. Picks the client with the most actions.
// 2. Builds the metrics snapshot and cross-checks its figures against direct,
//    independent COUNT queries — the numbers on the client's report must match
//    the database exactly.

import { prisma } from '../lib/prisma';
import { buildClientDailyMetrics } from '../lib/reporting/client-daily/metrics';
import { generateClientDailyReport } from '../lib/reporting/client-daily/generate';

async function main() {
    const clients = await prisma.client.findMany({ select: { id: true, name: true } });
    let best: { id: string; name: string; actions: number } | null = null;

    for (const client of clients) {
        const actions = await prisma.action.count({
            where: { campaign: { mission: { clientId: client.id } } },
        });
        if (!best || actions > best.actions) best = { ...client, actions };
    }

    if (!best) throw new Error('Aucun client en base');
    console.log(`\n=== Client: ${best.name} (${best.actions} actions) ===`);

    const started = Date.now();
    const metrics = await buildClientDailyMetrics({ clientId: best.id });
    console.log(`metrics built in ${Date.now() - started}ms`);
    if (!metrics) throw new Error('metrics null');

    console.log('reportDate      :', metrics.reportDate, '|', metrics.reportDateLabel);
    console.log('brief           :', metrics.brief.label, '|', metrics.brief.rangeLabel);
    console.log('  actions / RDV :', metrics.brief.actions, '/', metrics.brief.meetings);
    console.log('  previous      :', JSON.stringify(metrics.brief.previous));
    console.log('week            :', metrics.week.actions, 'actions,', metrics.week.meetings, 'RDV');
    console.log('month           :', metrics.month.label);
    console.log('  actions       :', metrics.month.actions);
    console.log('  contacts      :', metrics.month.contactsReached, '| qualifiés:', metrics.month.qualified);
    console.log('  RDV/objectif  :', metrics.month.meetings, '/', metrics.month.objective, `(${metrics.month.objectiveProgressPct}%)`);
    console.log('  jours ouvrés  :', metrics.month.businessDaysElapsed, '/', metrics.month.businessDaysTotal);
    console.log('  projection    :', metrics.month.projectedMeetings);
    console.log('funnel          :', JSON.stringify(metrics.funnel));
    console.log('trend           :', metrics.trend.length, 'semaines | RDV 90j:', metrics.trend.reduce((sum, p) => sum + p.meetings, 0));
    console.log('monthlySeries   :', metrics.monthlySeries.length, 'mois');
    console.log('meetingsWon     :', metrics.meetingsWon.length);
    console.log('meetingsUpcoming:', metrics.meetingsUpcoming.length);
    console.log('resultBreakdown :', metrics.resultBreakdown.slice(0, 4).map((r) => `${r.label}=${r.count}`).join(', '));
    console.log('channelMix      :', JSON.stringify(metrics.channelMix));
    console.log('sessions        :', JSON.stringify(metrics.sessions));
    console.log('totals          :', JSON.stringify(metrics.totals), '| isQuiet:', metrics.isQuiet);

    // ---- Cross-check against independent queries ----
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [directMonth, directAllTime] = await Promise.all([
        prisma.action.count({
            where: {
                campaign: { mission: { clientId: best.id } },
                result: 'MEETING_BOOKED',
                createdAt: { gte: monthStart, lte: now },
            },
        }),
        prisma.action.count({
            where: { campaign: { mission: { clientId: best.id } }, result: 'MEETING_BOOKED' },
        }),
    ]);

    console.log(
        `\ncross-check RDV du mois : engine=${metrics.month.meetings} direct=${directMonth} ->`,
        metrics.month.meetings === directMonth ? 'OK' : 'MISMATCH'
    );
    console.log(
        `cross-check RDV total   : engine=${metrics.totals.meetingsAllTime} direct=${directAllTime} ->`,
        metrics.totals.meetingsAllTime === directAllTime ? 'OK' : 'MISMATCH'
    );

    if (process.argv.includes('--generate')) {
        console.log('\n=== Génération complète (appel Mistral) ===');
        const startedAt = Date.now();
        const result = await generateClientDailyReport({ clientId: best.id, force: true });
        console.log(`status: ${result?.status} en ${Date.now() - startedAt}ms (modèle: ${result?.modelUsed})`);
        const narrative = result?.narrative;
        if (narrative) {
            console.log('\nheadline   :', narrative.headline);
            console.log('summary    :', narrative.executiveSummary);
            console.log('momentum   :', narrative.momentum.direction, '-', narrative.momentum.comment);
            console.log('highlights :', narrative.highlights.map((h) => `${h.title} [${h.metricRef}]`).join(' | '));
            console.log('watchouts  :', narrative.watchouts.map((w) => `${w.title} (${w.severity})`).join(' | '));
            console.log('spotlight  :', narrative.rdvSpotlight.map((s) => `${s.ref}: ${s.note}`).join(' | '));
            console.log('nextSteps  :', narrative.nextSteps.map((s) => `[${s.owner}] ${s.action}`).join(' | '));
            console.log('questions  :', narrative.questionsForYou.join(' | '));
            console.log('confidence :', narrative.confidence, '| dataQuality:', narrative.dataQuality);
            console.log('uncertain. :', narrative.uncertainties.join(' | '));
        }
    }
}

main()
    .catch((error) => {
        console.error('FAILED:', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
