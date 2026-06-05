
REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_household() FROM PUBLIC, anon, authenticated;
