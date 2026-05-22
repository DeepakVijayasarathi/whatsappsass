-- ============================================================
-- WhatsApp SaaS Lite — Full initial migration
-- Multi-tenant schema with row-level workspace isolation
-- ============================================================

-- CreateTable: workspaces (tenant root)
CREATE TABLE "workspaces" (
    "id"                      TEXT        NOT NULL,
    "name"                    TEXT        NOT NULL,
    "plan"                    TEXT        NOT NULL DEFAULT 'lite',
    "meta_whatsapp_enabled"   BOOLEAN     NOT NULL DEFAULT false,
    "whatsapp_provider"       TEXT        NOT NULL DEFAULT 'meta',
    "msg91_auth_key"          TEXT,
    "msg91_integrated_number" TEXT,
    "license_key"             TEXT,
    "status"                  TEXT        NOT NULL DEFAULT 'active',
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable: users
CREATE TABLE "users" (
    "id"            TEXT        NOT NULL,
    "name"          TEXT        NOT NULL,
    "email"         TEXT        NOT NULL,
    "password_hash" TEXT        NOT NULL,
    "role"          TEXT        NOT NULL DEFAULT 'marketer',
    "workspace_id"  TEXT        NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: license_keys
CREATE TABLE "license_keys" (
    "id"           TEXT        NOT NULL,
    "key"          TEXT        NOT NULL,
    "workspace_id" TEXT,
    "plan"         TEXT        NOT NULL DEFAULT 'lite',
    "status"       TEXT        NOT NULL DEFAULT 'inactive',
    "expiry_date"  TIMESTAMP(3),

    CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contacts
CREATE TABLE "contacts" (
    "id"           TEXT     NOT NULL,
    "workspace_id" TEXT     NOT NULL,
    "name"         TEXT     NOT NULL,
    "phone"        TEXT     NOT NULL,
    "tags"         TEXT[]   NOT NULL DEFAULT ARRAY[]::TEXT[],
    "opt_in"       BOOLEAN  NOT NULL DEFAULT false,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: campaigns
CREATE TABLE "campaigns" (
    "id"           TEXT        NOT NULL,
    "workspace_id" TEXT        NOT NULL,
    "name"         TEXT        NOT NULL,
    "template"     TEXT        NOT NULL,
    "status"       TEXT        NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: message_logs
CREATE TABLE "message_logs" (
    "id"           TEXT        NOT NULL,
    "workspace_id" TEXT        NOT NULL,
    "contact_id"   TEXT        NOT NULL,
    "campaign_id"  TEXT,
    "status"       TEXT        NOT NULL DEFAULT 'sent',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: inbound_messages
CREATE TABLE "inbound_messages" (
    "id"                  TEXT        NOT NULL,
    "workspace_id"        TEXT        NOT NULL,
    "contact_id"          TEXT,
    "from_phone"          TEXT        NOT NULL,
    "message_id"          TEXT        NOT NULL,
    "type"                TEXT        NOT NULL DEFAULT 'text',
    "body"                TEXT,
    "reply_to_message_id" TEXT,
    "raw_payload"         JSONB       NOT NULL,
    "read"                BOOLEAN     NOT NULL DEFAULT false,
    "received_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- ── Unique constraints ────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "workspaces_license_key_key" ON "workspaces"("license_key");
CREATE UNIQUE INDEX "users_email_key"             ON "users"("email");
CREATE UNIQUE INDEX "license_keys_key_key"        ON "license_keys"("key");
CREATE UNIQUE INDEX "inbound_messages_message_id_key" ON "inbound_messages"("message_id");

-- ── Indexes (workspace_id on every tenant-scoped table) ───────────────────────
CREATE INDEX "users_workspace_id_idx"            ON "users"("workspace_id");
CREATE INDEX "license_keys_workspace_id_idx"     ON "license_keys"("workspace_id");
CREATE INDEX "contacts_workspace_id_idx"         ON "contacts"("workspace_id");
CREATE INDEX "contacts_phone_idx"                ON "contacts"("phone");
CREATE INDEX "campaigns_workspace_id_idx"        ON "campaigns"("workspace_id");
CREATE INDEX "message_logs_workspace_id_idx"     ON "message_logs"("workspace_id");
CREATE INDEX "message_logs_campaign_id_idx"      ON "message_logs"("campaign_id");
CREATE INDEX "inbound_messages_workspace_id_idx" ON "inbound_messages"("workspace_id");
CREATE INDEX "inbound_messages_from_phone_idx"   ON "inbound_messages"("from_phone");

-- ── Foreign keys ──────────────────────────────────────────────────────────────

-- users → workspaces
ALTER TABLE "users"
    ADD CONSTRAINT "users_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- license_keys → workspaces (nullable, set null on workspace delete)
ALTER TABLE "license_keys"
    ADD CONSTRAINT "license_keys_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- contacts → workspaces
ALTER TABLE "contacts"
    ADD CONSTRAINT "contacts_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- campaigns → workspaces
ALTER TABLE "campaigns"
    ADD CONSTRAINT "campaigns_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- message_logs → workspaces
ALTER TABLE "message_logs"
    ADD CONSTRAINT "message_logs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- message_logs → contacts
ALTER TABLE "message_logs"
    ADD CONSTRAINT "message_logs_contact_id_fkey"
    FOREIGN KEY ("contact_id")
    REFERENCES "contacts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- message_logs → campaigns (nullable)
ALTER TABLE "message_logs"
    ADD CONSTRAINT "message_logs_campaign_id_fkey"
    FOREIGN KEY ("campaign_id")
    REFERENCES "campaigns"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- inbound_messages → workspaces
ALTER TABLE "inbound_messages"
    ADD CONSTRAINT "inbound_messages_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- inbound_messages → contacts (nullable)
ALTER TABLE "inbound_messages"
    ADD CONSTRAINT "inbound_messages_contact_id_fkey"
    FOREIGN KEY ("contact_id")
    REFERENCES "contacts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
