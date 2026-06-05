
-- 1. Tighten household_members self-insert: only allow the household creator to add themselves as the first member.
-- Joining via invite code goes through supabaseAdmin (bypasses RLS) after validating the code server-side.
DROP POLICY IF EXISTS "members self insert" ON public.household_members;
CREATE POLICY "members self insert owner only"
ON public.household_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = household_id AND h.created_by = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.household_members m WHERE m.household_id = household_members.household_id
  )
);

-- 2. Add UPDATE policy on settlements scoped to the original payer.
CREATE POLICY "settlements update"
ON public.settlements
FOR UPDATE TO authenticated
USING (is_household_member(household_id) AND from_user_id = auth.uid())
WITH CHECK (is_household_member(household_id) AND from_user_id = auth.uid());

-- 3. Pin search_path on functions that were missing it.
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE c TEXT;
BEGIN
  LOOP
    c := upper(substr(encode(gen_random_bytes(6),'base64'),1,8));
    c := regexp_replace(c,'[^A-Z0-9]','X','g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE invite_code = c);
  END LOOP;
  RETURN c;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

-- 4. Revoke EXECUTE on SECURITY DEFINER helpers that should only be invoked by the server (service_role).
REVOKE EXECUTE ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_categories(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_household_size() FROM PUBLIC, anon, authenticated;

-- is_household_member and current_household are used inside RLS policies; keep them executable for authenticated.
