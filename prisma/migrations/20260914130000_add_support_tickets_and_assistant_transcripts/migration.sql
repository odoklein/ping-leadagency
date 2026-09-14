-- Support tickets + AI assistant transcripts.
-- Purely additive: new enums and tables only, no change to existing objects.

DO $$ BEGIN
  CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN','IN_PROGRESS','WAITING_ON_REQUESTER','RESOLVED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportTicketCategory" AS ENUM ('BUG','QUESTION','DATA_ISSUE','ACCESS','BILLING','FEATURE_REQUEST','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportTicketSource" AS ENUM ('ASSISTANT','WEB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id"          TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "clientId"    TEXT,
  "missionId"   TEXT,
  "subject"     TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "category"    "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
  "priority"    "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "status"      "SupportTicketStatus"   NOT NULL DEFAULT 'OPEN',
  "source"      "SupportTicketSource"   NOT NULL DEFAULT 'WEB',
  "context"     JSONB,
  "assigneeId"  TEXT,
  "resolvedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupportTicketMessage" (
  "id"        TEXT NOT NULL,
  "ticketId"  TEXT NOT NULL,
  "authorId"  TEXT,
  "content"   TEXT NOT NULL,
  "isSystem"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantConversation" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "userRole"      "UserRole" NOT NULL,
  "clientId"      TEXT,
  "title"         TEXT NOT NULL,
  "messageCount"  INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantMessage" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role"           TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "toolCalls"      JSONB,
  "model"          TEXT,
  "latencyMs"      INTEGER,
  "totalTokens"    INTEGER,
  "errorCode"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportTicket_status_createdAt_idx"    ON "SupportTicket"("status","createdAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_requesterId_idx"         ON "SupportTicket"("requesterId");
CREATE INDEX IF NOT EXISTS "SupportTicket_clientId_idx"            ON "SupportTicket"("clientId");
CREATE INDEX IF NOT EXISTS "SupportTicket_assigneeId_idx"          ON "SupportTicket"("assigneeId");
CREATE INDEX IF NOT EXISTS "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId","createdAt");
CREATE INDEX IF NOT EXISTS "AssistantConversation_userId_updatedAt_idx"  ON "AssistantConversation"("userId","updatedAt");
CREATE INDEX IF NOT EXISTS "AssistantConversation_userRole_createdAt_idx" ON "AssistantConversation"("userRole","createdAt");
CREATE INDEX IF NOT EXISTS "AssistantConversation_clientId_idx"     ON "AssistantConversation"("clientId");
CREATE INDEX IF NOT EXISTS "AssistantMessage_conversationId_createdAt_idx" ON "AssistantMessage"("conversationId","createdAt");

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
