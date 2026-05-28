CREATE TABLE "custom_templates" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'UTILITY',
    "language" TEXT NOT NULL DEFAULT 'en_US',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_templates_workspace_id_name_key" ON "custom_templates"("workspace_id", "name");
CREATE INDEX "custom_templates_workspace_id_idx" ON "custom_templates"("workspace_id");

ALTER TABLE "custom_templates" ADD CONSTRAINT "custom_templates_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
