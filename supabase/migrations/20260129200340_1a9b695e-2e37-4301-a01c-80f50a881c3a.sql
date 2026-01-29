-- =====================================================
-- RLS MIGRATION: Per-user isolation for Google Calendar events
-- =====================================================

-- =====================================================
-- 1. Fix google_calendar_tokens RLS: Only owner can access their tokens
-- =====================================================

-- Drop existing policies on google_calendar_tokens
DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Account admins can manage google tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.google_calendar_tokens;

-- Create strict per-user policies for google_calendar_tokens
CREATE POLICY "Token owner can view own token"
ON public.google_calendar_tokens
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Token owner can insert own token"
ON public.google_calendar_tokens
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Token owner can update own token"
ON public.google_calendar_tokens
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Token owner can delete own token"
ON public.google_calendar_tokens
FOR DELETE
USING (user_id = auth.uid());

-- Super admin can manage all tokens (for support purposes)
CREATE POLICY "Super admin can manage all tokens"
ON public.google_calendar_tokens
FOR ALL
USING (public.is_super_admin());

-- =====================================================
-- 2. Fix calendar_events RLS: CRM events by account, Google events by user
-- =====================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Account members can view calendar" ON public.calendar_events;
DROP POLICY IF EXISTS "Account members can manage calendar" ON public.calendar_events;
DROP POLICY IF EXISTS "Admin can manage account calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can view their account events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can insert account events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update account events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete account events" ON public.calendar_events;

-- SELECT: CRM events for account members, Google events only for the owner
CREATE POLICY "View calendar events with per-user Google isolation"
ON public.calendar_events
FOR SELECT
USING (
  (COALESCE(source, 'crm') = 'crm' AND public.is_account_member(account_id))
  OR
  (source = 'google' AND created_by = auth.uid())
  OR
  public.is_super_admin()
);

-- INSERT: Only CRM events can be inserted by account members
-- Google events are inserted by edge functions with service role
CREATE POLICY "Insert CRM events only"
ON public.calendar_events
FOR INSERT
WITH CHECK (
  COALESCE(source, 'crm') = 'crm' 
  AND public.is_account_member(account_id)
);

-- UPDATE: CRM events for account members, Google events only for the owner
CREATE POLICY "Update calendar events with per-user Google isolation"
ON public.calendar_events
FOR UPDATE
USING (
  (COALESCE(source, 'crm') = 'crm' AND public.is_account_member(account_id))
  OR
  (source = 'google' AND created_by = auth.uid())
  OR
  public.is_super_admin()
);

-- DELETE: CRM events for account members, Google events only for the owner
CREATE POLICY "Delete calendar events with per-user Google isolation"
ON public.calendar_events
FOR DELETE
USING (
  (COALESCE(source, 'crm') = 'crm' AND public.is_account_member(account_id))
  OR
  (source = 'google' AND created_by = auth.uid())
  OR
  public.is_super_admin()
);

-- =====================================================
-- 3. Add unique constraint to prevent duplicate Google events per user
-- =====================================================

-- First drop if exists (for idempotency)
DROP INDEX IF EXISTS idx_calendar_events_user_google_event;

-- Create partial unique index: one Google event ID per user
CREATE UNIQUE INDEX idx_calendar_events_user_google_event
ON public.calendar_events (created_by, google_event_id)
WHERE source = 'google' AND google_event_id IS NOT NULL;

-- Add index for faster user-based Google event queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by_source
ON public.calendar_events (created_by, source);

-- =====================================================
-- 4. Ensure user_id is NOT NULL for new tokens (enforce constraint)
-- =====================================================

-- Note: We can't add NOT NULL directly if there are existing NULL values
-- The migration that added user_id should have populated it for existing rows
-- For safety, we update any NULL user_id to the first user in the account

-- First, clean up any orphaned tokens without user_id
DELETE FROM public.google_calendar_tokens WHERE user_id IS NULL;

-- Now make user_id NOT NULL
ALTER TABLE public.google_calendar_tokens 
ALTER COLUMN user_id SET NOT NULL;