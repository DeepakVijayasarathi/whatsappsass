-- AlterTable: Contact add email
ALTER TABLE "contacts" ADD COLUMN "email" TEXT;

-- AlterTable: User add permissions + superAdmin
ALTER TABLE "users" ADD COLUMN "permissions" JSONB;
ALTER TABLE "users" ADD COLUMN "super_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Workspace add SMTP fields
ALTER TABLE "workspaces" ADD COLUMN "smtp_host" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "smtp_port" INTEGER;
ALTER TABLE "workspaces" ADD COLUMN "smtp_user" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "smtp_pass" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "smtp_from_email" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "smtp_from_name" TEXT;

-- CreateTable: email_campaigns
CREATE TABLE "email_campaigns" (
    "id"           TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "subject"      TEXT NOT NULL,
    "body"         TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: email_logs
CREATE TABLE "email_logs" (
    "id"           TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id"  TEXT,
    "contact_id"   TEXT NOT NULL,
    "to_email"     TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'sent',
    "sent_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id"           TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id"      TEXT,
    "user_email"   TEXT,
    "action"       TEXT NOT NULL,
    "entity_type"  TEXT,
    "entity_id"    TEXT,
    "meta"         JSONB,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_campaigns_workspace_id_idx" ON "email_campaigns"("workspace_id");
CREATE INDEX "email_logs_workspace_id_idx" ON "email_logs"("workspace_id");
CREATE INDEX "email_logs_campaign_id_idx" ON "email_logs"("campaign_id");
CREATE INDEX "audit_logs_workspace_id_idx" ON "audit_logs"("workspace_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
