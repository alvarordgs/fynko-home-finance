CREATE OR REPLACE FUNCTION public.is_household_creator(_household uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.households
    WHERE id = _household
      AND created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.household_has_no_members(_household uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE household_id = _household
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_household_creator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.household_has_no_members(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "households member select" ON public.households;
CREATE POLICY "households member or creator select"
ON public.households
FOR SELECT
TO authenticated
USING (public.is_household_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "households member update" ON public.households;
CREATE POLICY "households member or creator update"
ON public.households
FOR UPDATE
TO authenticated
USING (public.is_household_member(id) OR created_by = auth.uid())
WITH CHECK (public.is_household_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "members self insert owner only" ON public.household_members;
CREATE POLICY "members self insert owner only"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_household_creator(household_id)
  AND public.household_has_no_members(household_id)
);