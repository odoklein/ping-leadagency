-- Client portal: one AI-generated report per client per day (Europe/Paris).
--
-- `metrics` holds the deterministic SQL snapshot the narrative was written
-- from, so an archived report stays reproducible even after the underlying
-- actions change. The unique (clientId, reportDate) pair doubles as the
-- generation lock: concurrent first-visits race on the INSERT, the loser
-- polls instead of firing a second Mistral call.

CREATE TABLE "ClientDailyReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "narrative" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "modelUsed" TEXT,
    "tokensUsed" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDailyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientDailyReport_clientId_reportDate_key" ON "ClientDailyReport"("clientId", "reportDate");
CREATE INDEX "ClientDailyReport_clientId_reportDate_idx" ON "ClientDailyReport"("clientId", "reportDate");
CREATE INDEX "ClientDailyReport_status_idx" ON "ClientDailyReport"("status");

ALTER TABLE "ClientDailyReport"
ADD CONSTRAINT "ClientDailyReport_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
