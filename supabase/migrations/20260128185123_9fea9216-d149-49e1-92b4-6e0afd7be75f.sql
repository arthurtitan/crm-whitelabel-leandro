-- Prevent duplicate contacts per chatwoot_contact_id within an account
CREATE UNIQUE INDEX IF NOT EXISTS contacts_account_chatwoot_contact_unique
  ON public.contacts (account_id, chatwoot_contact_id)
  WHERE chatwoot_contact_id IS NOT NULL;