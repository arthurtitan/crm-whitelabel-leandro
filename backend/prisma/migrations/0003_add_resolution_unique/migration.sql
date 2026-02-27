-- CreateIndex: unique constraint for resolution_logs to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "resolution_logs_account_id_conversation_id_key" 
  ON "resolution_logs"("account_id", "conversation_id");
