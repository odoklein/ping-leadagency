-- Indexes backing the list detail page.
--
-- GET /api/lists/[id]/companies runs
--   SELECT * FROM "Company" WHERE "listId" = $1 ORDER BY "createdAt" DESC
-- plus a nested load of every contact for those companies. Neither foreign key
-- was indexed, so both halves were sequential scans that grew with the whole
-- table rather than with the list being opened.
--
-- CONCURRENTLY is deliberately not used so this runs inside the migration
-- transaction; the tables are small enough that the brief lock is acceptable.

CREATE INDEX IF NOT EXISTS "Company_listId_idx" ON "Company"("listId");
CREATE INDEX IF NOT EXISTS "Company_listId_status_idx" ON "Company"("listId", "status");

CREATE INDEX IF NOT EXISTS "Contact_companyId_idx" ON "Contact"("companyId");
CREATE INDEX IF NOT EXISTS "Contact_companyId_status_idx" ON "Contact"("companyId", "status");
