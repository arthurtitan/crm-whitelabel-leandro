-- Drop old unique constraint on account_id
DROP INDEX IF EXISTS "google_calendar_tokens_account_id_key";

-- Add unique constraint on user_id instead
CREATE UNIQUE INDEX "google_calendar_tokens_user_id_key" ON "google_calendar_tokens"("user_id");
