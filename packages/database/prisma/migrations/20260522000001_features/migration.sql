-- ============================================================
-- Migration: features — adds all columns and tables beyond
--            the minimal initial schema
-- ============================================================

-- ── Workspace: new columns ────────────────────────────────────────────────────
ALTER TABLE "workspaces"
    ADD COLUMN IF NOT EXISTS "meta_phone_number_id"      TEXT,
    ADD COLUMN IF NOT EXISTS "meta_waba_id"              TEXT,
    ADD COLUMN IF NOT EXISTS "meta_access_token"         TEXT,
    ADD COLUMN IF NOT EXISTS "meta_webhook_verify_token" TEXT,
    ADD COLUMN IF NOT EXISTS "smtp_host"                 TEXT,
    ADD COLUMN IF NOT EXISTS "smtp_port"                 INTEGER,
    ADD COLUMN IF NOT EXISTS "smtp_user"                 TEXT,
    ADD COLUMN IF NOT EXISTS "smtp_pass"                 TEXT,
    ADD COLUMN IF NOT EXISTS "smtp_from_email"           TEXT,
    ADD COLUMN IF NOT EXISTS "smtp_from_name"            TEXT;

-- ── Users: new columns ────────────────────────────────────────────────────────
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "permissions"  JSONB,
    ADD COLUMN IF NOT EXISTS "super_admin"  BOOLEAN NOT NULL DEFAULT false;

-- ── Contacts: new columns ─────────────────────────────────────────────────────
ALTER TABLE "contacts"
    ADD COLUMN IF NOT EXISTS "email"       TEXT,
    ADD COLUMN IF NOT EXISTS "lead_status" TEXT NOT NULL DEFAULT 'new';

-- ── InboundMessage: campaign_id column ───────────────────────────────────────
ALTER TABLE "inbound_messages"
    ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;

CREATE INDEX IF NOT EXISTS "inbound_messages_campaign_id_idx"
    ON "inbound_messages"("campaign_id");

-- ── CreateTable: password_reset_tokens ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id"         TEXT        NOT NULL,
    "user_id"    TEXT        NOT NULL,
    "token_hash" TEXT        NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used"       BOOLEAN     NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
    ON "password_reset_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx"
    ON "password_reset_tokens"("user_id");

ALTER TABLE "password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: contact_notes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "contact_notes" (
    "id"          TEXT        NOT NULL,
    "workspace_id" TEXT       NOT NULL,
    "contact_id"  TEXT        NOT NULL,
    "user_id"     TEXT,
    "user_email"  TEXT,
    "body"        TEXT        NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contact_notes_contact_id_idx"
    ON "contact_notes"("contact_id");

ALTER TABLE "contact_notes"
    ADD CONSTRAINT "contact_notes_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_notes"
    ADD CONSTRAINT "contact_notes_contact_id_fkey"
    FOREIGN KEY ("contact_id")
    REFERENCES "contacts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: email_campaigns ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_campaigns" (
    "id"           TEXT        NOT NULL,
    "workspace_id" TEXT        NOT NULL,
    "name"         TEXT        NOT NULL,
    "subject"      TEXT        NOT NULL,
    "body"         TEXT        NOT NULL,
    "status"       TEXT        NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_campaigns_workspace_id_idx"
    ON "email_campaigns"("workspace_id");

ALTER TABLE "email_campaigns"
    ADD CONSTRAINT "email_campaigns_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: email_logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_logs" (
    "id"           TEXT        NOT NULL,
    "workspace_id" TEXT        NOT NULL,
    "campaign_id"  TEXT,
    "contact_id"   TEXT        NOT NULL,
    "to_email"     TEXT        NOT NULL,
    "status"       TEXT        NOT NULL DEFAULT 'sent',
    "sent_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_logs_workspace_id_idx"
    ON "email_logs"("workspace_id");

CREATE INDEX IF NOT EXISTS "email_logs_campaign_id_idx"
    ON "email_logs"("campaign_id");

ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_campaign_id_fkey"
    FOREIGN KEY ("campaign_id")
    REFERENCES "email_campaigns"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_contact_id_fkey"
    FOREIGN KEY ("contact_id")
    REFERENCES "contacts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: audit_logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"           TEXT        NOT NULL,
    "workspace_id" TEXT        NOT NULL,
    "user_id"      TEXT,
    "user_email"   TEXT,
    "action"       TEXT        NOT NULL,
    "entity_type"  TEXT,
    "entity_id"    TEXT,
    "meta"         JSONB,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_workspace_id_idx"
    ON "audit_logs"("workspace_id");

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
    ON "audit_logs"("created_at");

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CreateTable: auto_replies ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "auto_replies" (
    "id"            TEXT        NOT NULL,
    "workspace_id"  TEXT        NOT NULL,
    "keyword"       TEXT        NOT NULL,
    "match_type"    TEXT        NOT NULL DEFAULT 'exact',
    "template_name" TEXT        NOT NULL,
    "language_code" TEXT        NOT NULL DEFAULT 'en_US',
    "is_active"     BOOLEAN     NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auto_replies_workspace_id_idx"
    ON "auto_replies"("workspace_id");

ALTER TABLE "auto_replies"
    ADD CONSTRAINT "auto_replies_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: webhook_endpoints ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
    "id"           TEXT        NOT NULL,
    "workspace_id" TEXT        NOT NULL,
    "url"          TEXT        NOT NULL,
    "secret"       TEXT,
    "events"       TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_active"    BOOLEAN     NOT NULL DEFAULT true,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_endpoints_workspace_id_idx"
    ON "webhook_endpoints"("workspace_id");

ALTER TABLE "webhook_endpoints"
    ADD CONSTRAINT "webhook_endpoints_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: campaign_sequences ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "campaign_sequences" (
    "id"           TEXT        NOT NULL,
    "workspace_id" TEXT        NOT NULL,
    "name"         TEXT        NOT NULL,
    "status"       TEXT        NOT NULL DEFAULT 'draft',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_sequences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_sequences_workspace_id_idx"
    ON "campaign_sequences"("workspace_id");

ALTER TABLE "campaign_sequences"
    ADD CONSTRAINT "campaign_sequences_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: sequence_steps ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sequence_steps" (
    "id"            TEXT        NOT NULL,
    "sequence_id"   TEXT        NOT NULL,
    "step_number"   INTEGER     NOT NULL,
    "template_name" TEXT        NOT NULL,
    "language_code" TEXT        NOT NULL DEFAULT 'en_US',
    "delay_days"    INTEGER     NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sequence_steps_sequence_id_idx"
    ON "sequence_steps"("sequence_id");

ALTER TABLE "sequence_steps"
    ADD CONSTRAINT "sequence_steps_sequence_id_fkey"
    FOREIGN KEY ("sequence_id")
    REFERENCES "campaign_sequences"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: sequence_enrollments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sequence_enrollments" (
    "id"           TEXT        NOT NULL,
    "sequence_id"  TEXT        NOT NULL,
    "contact_id"   TEXT        NOT NULL,
    "current_step" INTEGER     NOT NULL DEFAULT 0,
    "started_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status"       TEXT        NOT NULL DEFAULT 'active',

    CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sequence_enrollments_sequence_id_contact_id_key"
    ON "sequence_enrollments"("sequence_id", "contact_id");

CREATE INDEX IF NOT EXISTS "sequence_enrollments_sequence_id_idx"
    ON "sequence_enrollments"("sequence_id");

CREATE INDEX IF NOT EXISTS "sequence_enrollments_contact_id_idx"
    ON "sequence_enrollments"("contact_id");

ALTER TABLE "sequence_enrollments"
    ADD CONSTRAINT "sequence_enrollments_sequence_id_fkey"
    FOREIGN KEY ("sequence_id")
    REFERENCES "campaign_sequences"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sequence_enrollments"
    ADD CONSTRAINT "sequence_enrollments_contact_id_fkey"
    FOREIGN KEY ("contact_id")
    REFERENCES "contacts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
