-- Performance indexes for message_logs (analytics + delivery receipt lookups)
CREATE INDEX IF NOT EXISTS "message_logs_workspace_id_status_idx" ON "message_logs"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "message_logs_workspace_id_created_at_idx" ON "message_logs"("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "message_logs_wamid_idx" ON "message_logs"("wamid") WHERE "wamid" IS NOT NULL;
