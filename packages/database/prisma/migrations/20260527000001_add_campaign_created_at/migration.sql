-- Add createdAt to Campaign for stable ordering (scheduledAt is nullable)
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index for workspace-scoped recency queries
CREATE INDEX IF NOT EXISTS "campaigns_workspace_id_created_at_idx" ON "campaigns"("workspace_id", "created_at");
