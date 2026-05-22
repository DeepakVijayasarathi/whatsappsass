-- Add created_at to contacts with a default of now() for existing rows
ALTER TABLE "contacts" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index for sort=recent queries on the dashboard
CREATE INDEX "contacts_workspace_id_created_at_idx" ON "contacts"("workspace_id", "created_at");
