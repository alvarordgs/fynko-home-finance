DROP POLICY IF EXISTS "members self insert owner only" ON public.household_members;
CREATE POLICY "members self insert owner only"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_members.household_id
      AND h.created_by = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.household_members m
    WHERE m.household_id = household_members.household_id
  )
);

DROP FUNCTION IF EXISTS public.is_household_creator(uuid);
DROP FUNCTION IF EXISTS public.household_has_no_members(uuid);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_household_size() FROM anon, authenticated;