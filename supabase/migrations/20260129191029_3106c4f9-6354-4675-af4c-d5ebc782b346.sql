-- Add user_id column to google_calendar_tokens
ALTER TABLE public.google_calendar_tokens
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrate existing data: set user_id from the profiles table
UPDATE public.google_calendar_tokens gct
SET user_id = (
  SELECT p.user_id 
  FROM public.profiles p 
  WHERE p.account_id = gct.account_id 
  LIMIT 1
)
WHERE gct.user_id IS NULL;

-- Drop the old unique constraint on account_id
ALTER TABLE public.google_calendar_tokens
DROP CONSTRAINT IF EXISTS google_calendar_tokens_account_id_key;

-- Create new unique constraint on user_id
ALTER TABLE public.google_calendar_tokens
ADD CONSTRAINT google_calendar_tokens_user_id_key UNIQUE (user_id);

-- Add user_id index for faster lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id 
ON public.google_calendar_tokens(user_id);

-- Add created_by index for calendar_events filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by 
ON public.calendar_events(created_by);

-- Update RLS policies for google_calendar_tokens to use user_id
DROP POLICY IF EXISTS "Users can view own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON public.google_calendar_tokens;

CREATE POLICY "Users can view own tokens" 
ON public.google_calendar_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" 
ON public.google_calendar_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" 
ON public.google_calendar_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" 
ON public.google_calendar_tokens 
FOR DELETE 
USING (auth.uid() = user_id);