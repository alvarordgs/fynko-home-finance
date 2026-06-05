CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_household_member(_household uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.household_members
    WHERE household_id = _household
      AND user_id = auth.uid()
  );
$$;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_household_member(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid) FROM authenticated;

DROP POLICY IF EXISTS "profiles self select" ON public.profiles;
CREATE POLICY "profiles self select"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR (household_id IS NOT NULL AND private.is_household_member(household_id)));

DROP POLICY IF EXISTS "households member or creator select" ON public.households;
CREATE POLICY "households member or creator select"
ON public.households
FOR SELECT
TO authenticated
USING (private.is_household_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "households member or creator update" ON public.households;
CREATE POLICY "households member or creator update"
ON public.households
FOR UPDATE
TO authenticated
USING (private.is_household_member(id) OR created_by = auth.uid())
WITH CHECK (private.is_household_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "members self select" ON public.household_members;
CREATE POLICY "members self select"
ON public.household_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR private.is_household_member(household_id));

DROP POLICY IF EXISTS "categories all" ON public.categories;
CREATE POLICY "categories all"
ON public.categories
FOR ALL
TO authenticated
USING (private.is_household_member(household_id))
WITH CHECK (private.is_household_member(household_id));

DROP POLICY IF EXISTS "transactions all" ON public.transactions;
CREATE POLICY "transactions all"
ON public.transactions
FOR ALL
TO authenticated
USING (private.is_household_member(household_id))
WITH CHECK (private.is_household_member(household_id));

DROP POLICY IF EXISTS "splits all" ON public.transaction_splits;
CREATE POLICY "splits all"
ON public.transaction_splits
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_splits.transaction_id AND private.is_household_member(t.household_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_splits.transaction_id AND private.is_household_member(t.household_id)));

DROP POLICY IF EXISTS "bills all" ON public.recurring_bills;
CREATE POLICY "bills all"
ON public.recurring_bills
FOR ALL
TO authenticated
USING (private.is_household_member(household_id))
WITH CHECK (private.is_household_member(household_id));

DROP POLICY IF EXISTS "budgets all" ON public.budgets;
CREATE POLICY "budgets all"
ON public.budgets
FOR ALL
TO authenticated
USING (private.is_household_member(household_id))
WITH CHECK (private.is_household_member(household_id));

DROP POLICY IF EXISTS "goals all" ON public.goals;
CREATE POLICY "goals all"
ON public.goals
FOR ALL
TO authenticated
USING (private.is_household_member(household_id))
WITH CHECK (private.is_household_member(household_id));

DROP POLICY IF EXISTS "settlements select" ON public.settlements;
CREATE POLICY "settlements select"
ON public.settlements
FOR SELECT
TO authenticated
USING (private.is_household_member(household_id));

DROP POLICY IF EXISTS "settlements insert" ON public.settlements;
CREATE POLICY "settlements insert"
ON public.settlements
FOR INSERT
TO authenticated
WITH CHECK (private.is_household_member(household_id) AND from_user_id = auth.uid());

DROP POLICY IF EXISTS "settlements update" ON public.settlements;
CREATE POLICY "settlements update"
ON public.settlements
FOR UPDATE
TO authenticated
USING (private.is_household_member(household_id) AND from_user_id = auth.uid())
WITH CHECK (private.is_household_member(household_id) AND from_user_id = auth.uid());

DROP POLICY IF EXISTS "settlements delete" ON public.settlements;
CREATE POLICY "settlements delete"
ON public.settlements
FOR DELETE
TO authenticated
USING (private.is_household_member(household_id) AND from_user_id = auth.uid());