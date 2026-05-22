-- Auto-reply rules
CREATE TABLE "auto_replies" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspace_id"  TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "keyword"       TEXT NOT NULL,
  "match_type"    TEXT NOT NULL DEFAULT 'exact',
  "template_name" TEXT NOT NULL,
  "language_code" TEXT NOT NULL DEFAULT 'en_US',
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "auto_replies_workspace_id_idx" ON "auto_replies"("workspace_id");

-- Outbound webhook endpoints
CREATE TABLE "webhook_endpoints" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspace_id"  TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "url"           TEXT NOT NULL,
  "secret"        TEXT,
  "events"        TEXT[] NOT NULL DEFAULT '{}',
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "webhook_endpoints_workspace_id_idx" ON "webhook_endpoints"("workspace_id");

-- Drip campaign sequences
CREATE TABLE "campaign_sequences" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspace_id"  TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'draft',
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "campaign_sequences_workspace_id_idx" ON "campaign_sequences"("workspace_id");

-- Sequence steps
CREATE TABLE "sequence_steps" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sequence_id"   TEXT NOT NULL REFERENCES "campaign_sequences"("id") ON DELETE CASCADE,
  "step_number"   INTEGER NOT NULL,
  "template_name" TEXT NOT NULL,
  "language_code" TEXT NOT NULL DEFAULT 'en_US',
  "delay_days"    INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sequence_steps_sequence_id_idx" ON "sequence_steps"("sequence_id");

-- Sequence enrollments
CREATE TABLE "sequence_enrollments" (
  "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sequence_id"   TEXT NOT NULL REFERENCES "campaign_sequences"("id") ON DELETE CASCADE,
  "contact_id"    TEXT NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "current_step"  INTEGER NOT NULL DEFAULT 0,
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"  TIMESTAMP(3),
  "status"        TEXT NOT NULL DEFAULT 'active',
  CONSTRAINT "sequence_enrollments_sequence_id_contact_id_key" UNIQUE ("sequence_id", "contact_id")
);
CREATE INDEX "sequence_enrollments_sequence_id_idx" ON "sequence_enrollments"("sequence_id");
CREATE INDEX "sequence_enrollments_contact_id_idx"  ON "sequence_enrollments"("contact_id");
