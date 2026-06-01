CREATE TABLE "contact_segments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_segments_workspace_id_name_key" ON "contact_segments"("workspace_id", "name");
CREATE INDEX "contact_segments_workspace_id_idx" ON "contact_segments"("workspace_id");

ALTER TABLE "contact_segments" ADD CONSTRAINT "contact_segments_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
