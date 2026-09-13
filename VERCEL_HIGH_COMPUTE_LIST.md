# High-compute API routes & functions on Vercel (CRM)

Routes and server logic that use a lot of CPU, memory, or time on Vercel. These can hit timeouts (10s Hobby / 60s Pro), increase cost, or cause OOM.

---

## How to detect what’s consuming (Vercel)

### 1. Dashboard – Observability (best single place)

1. Open **[Vercel Dashboard](https://vercel.com)** → your project → **Observability** (or **Monitoring**).
2. Go to the **Functions** (or **Serverless**) tab.
3. You’ll see **invocations, duration, and memory** per route. **Sort by duration** (or “Server duration”) to see which API routes use the most compute.
4. Use **Time range** (e.g. Last 24h / 7d) and filters to focus on production.

Where it lives in the UI (can vary by plan):

- **Pro/Enterprise:** **Project → Observability** (or **Monitoring**) → **Functions** → metrics per path (duration, invocations, memory, errors).
- **Hobby:** **Project → Logs** and **Analytics**; function duration may appear in **Logs** per request.

### 2. Dashboard – Logs

- **Project → Logs** (or **Deployments → [deployment] → Logs**).
- Filter by **Source: Serverless** so you only see function runs.
- Each log line usually shows **path**, **status**, and **duration**. Look for high duration or timeouts.
- Logs can also show when a function is **near max duration or memory** (Vercel adds warnings).

### 3. CLI – see slow routes and timings

```bash
# List recent serverless requests with path and status (from JSON logs)
vercel logs --environment production --source serverless --since 1h --json \
  | jq 'select(.path != null) | {path: .path, status: .statusCode, duration: .duration}'

# Full log output (no jq) to scan for slow/timeout errors
vercel logs --environment production --source serverless --since 1h --expand

# Time a specific endpoint (server processing = time inside your function)
vercel httpstat /api/analytics/report/pdf
vercel httpstat /api/lists/import
```

### 4. What to look for

| Signal | Meaning |
|--------|--------|
| **High duration** on a path | That route is consuming a lot of compute/time; check the route in the “Critical / High” tables above. |
| **Duration near 10s (Hobby) or 60s (Pro)** | Risk of timeout; optimize or move to a worker. |
| **High memory** / OOM | Reduce payload size, paginate, or increase function memory in Project Settings → Functions. |
| **Many invocations** of a heavy path | Same route called often = multiplied cost; add caching or rate limiting. |

### 5. Optional: custom log line for easy grepping

To quickly find heavy runs in **Vercel Logs**, you can log a single line at the end of an API route (e.g. in a shared wrapper or in the heaviest routes):

```ts
// At end of handler, before returning (example)
console.log(`[PERF] ${req.nextUrl.pathname} ${Date.now() - start}ms`);
```

Then in **Logs**, filter or search for `PERF` to see which requests were slow. Vercel already records duration per request, so this is only needed if you want a custom tag or extra detail in your own logs.

---

## Critical (long-running / timeout risk)

| Item | Location | Why it’s heavy |
|------|----------|----------------|
| **CSV list import** | `app/api/lists/import/route.ts` | Streaming import is good, but **per batch** companies are created **one-by-one** in a `for` loop (no `createMany`). Large files = many batches × many DB round-trips. Can run minutes and risk Vercel timeout. |
| **Email sync (inline)** | `app/api/email/sync/route.ts` + `lib/email/services/sync-service.ts` | When Redis is unavailable, sync runs **inline** for **all** active mailboxes in a loop. Each `syncMailbox()` does IMAP I/O + many DB reads/writes (up to `maxThreads: 100`). Single request can run very long. |
| **Single mailbox sync** | `app/api/email/mailboxes/[id]/sync/route.ts` | Calls `emailSyncService.syncMailbox()` directly. Full sync with high `maxThreads` can exceed function timeout. |
| **Analytics report PDF** | `app/api/analytics/report/pdf/route.ts` | 1) `getAnalyticsReportData()` (multiple aggregates + raw queries). 2) **Mistral API** call for AI summary. 3) **Puppeteer/Chromium** launch, render HTML, generate PDF. Browser spin-up + render is heavy and easy to timeout on Vercel. |
| **Client daily report generation** | `app/api/client/reporting/daily/generate/route.ts` + `lib/reporting/client-daily/generate.ts` | 1) Metrics snapshot (several findMany over 90 days of actions). 2) One **Mistral Large** call (~10-25s, `maxDuration = 60`). Lazily triggered on the first visit of the day and cached per client per day, so at most one run per client per day. The former pdfkit/Puppeteer client PDF route is gone: the download is now a browser print of `/client/portal/reporting/print`. |

---

## High (heavy DB / no limits)

| Item | Location | Why it’s heavy |
|------|----------|----------------|
| **List export** | `app/api/lists/[id]/export/route.ts` | `prisma.company.findMany` with **full nested includes** (contacts, opportunities, actions) and **no `take`**. Large lists = huge payload and memory. |
| **List companies (all)** | `app/api/lists/[id]/companies/route.ts` | `prisma.company.findMany` with `include: { contacts: true }` and **no pagination**. One big in-memory result. |
| **Client mission export** | `app/api/client/missions/[id]/export/route.ts` | Mission with **all lists → companies → contacts** (and opportunities, actions) in one nested include. **No limit**; large missions = very heavy. |
| **Actions stats** | `app/api/actions/stats/route.ts` | Four `groupBy` + one **`findMany` with no `take`** (all actions in date range) to build `byMission`. Can load tens of thousands of rows in one request. |
| **Client report data** | `app/api/client/reporting/get-report-data.ts` | Multiple `findMany` over actions by `campaignIds` with no cap; used by PDF and data endpoint. |
| **Billing export** | `app/api/billing/export/route.ts` | `prisma.invoice.findMany` with `include: { billingClient, items }` and **no limit**; date range can still be large. |

---

## Medium (cron / many operations)

| Item | Location | Why it’s heavy |
|------|----------|----------------|
| **Billing month-end cron** | `app/api/billing/cron/month-end/route.ts` | `generateDraftsForPeriod()` loops over **all active engagements**; each draft does RDV count + invoice generation. Many engagements = long run. |
| **Meeting reminders cron** | `app/api/cron/meeting-reminders/route.ts` | `findMany` upcoming meetings, then **per meeting**: `findFirst` (existing reminder) + `createMeetingReminderNotification`. N+1 pattern; many meetings = many DB and notification calls. |
| **Analytics stats** | `app/api/analytics/stats/route.ts` | Six parallel operations: aggregates + **several raw SQL** queries (daily volume, heatmap, SDR performance, mission states). Heavy on large `Action` table. |
| **Analytics report data** | `app/api/analytics/report/get-report-data.ts` | Multiple aggregates + raw SQL + `findMany` for notes sample. Used by PDF route; adds to PDF cost. |

---

## External API / AI (latency + cost)

| Item | Location | Why it matters |
|------|----------|----------------|
| **All Mistral AI routes** | `app/api/ai/*`, `app/api/ai/mistral/*` (script, email-recap, task-suggest, onboarding, script, email-draft, note-improve, task-estimate, task-decompose, project-report, etc.) | Each call hits **Mistral API** (network latency + token cost). Sequential use in a request increases duration. |
| **Analytics report PDF** | (see above) | Includes one Mistral call for AI summary inside the same serverless invocation. |
| **Apollo listing** | `app/api/prospects/listing/apollo/route.ts` | Calls **Apollo.io**; latency and rate limits depend on external API. |

---

## Recommendations (short)

1. **Lists import**  
   Use **batched `createMany`** for companies (and keep contacts/actions as today) to cut DB round-trips. For very large files, consider a **background job** (e.g. queue + worker) instead of doing everything in the request.

2. **Email sync**  
   Prefer **always** using the queue (Redis); avoid inline sync in the serverless route. If Redis is down, return “queue unavailable” instead of syncing all mailboxes inline.

3. **PDF reports**  
   Move **Puppeteer/Chromium** to a **dedicated worker** or external service (e.g. queue → worker, or PDF API). Keep the route to trigger the job and return a link when ready. Alternatively use a serverless-friendly PDF lib (e.g. React-PDF, PDFKit) instead of a full browser.

4. **Exports and big lists**  
   Add **pagination** or **cursor-based limits** (e.g. `take: 2000` per request) and/or **streaming** for list export, list companies, client mission export, and billing export. Consider **background export** (generate file, store, then download link).

5. **Actions stats**  
   Replace the unbounded `findMany` with **aggregation only** (e.g. raw SQL or Prisma `groupBy`) to compute per-mission stats so you don’t load all action rows.

6. **Crons**  
   Month-end: process engagements in **chunks** or fan-out to smaller jobs. Meeting reminders: **batch** “existing reminder” checks and notifications (e.g. one query for existing reminders, then bulk create).

7. **AI routes**  
   Keep as-is for correctness; optimize by **caching** where possible and **streaming** responses so the client doesn’t wait for the full token run.

---

*Generated from codebase scan. Re-check after refactors.*
