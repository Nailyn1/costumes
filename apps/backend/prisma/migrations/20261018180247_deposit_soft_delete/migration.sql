-- DropIndex
DROP INDEX "deposits_visit_id_key";

-- Keep at most one active deposit per visit while preserving soft-deleted history.
CREATE UNIQUE INDEX "deposits_active_visit_id_key"
ON "deposits" ("visit_id")
WHERE "deleted_at" IS NULL;
