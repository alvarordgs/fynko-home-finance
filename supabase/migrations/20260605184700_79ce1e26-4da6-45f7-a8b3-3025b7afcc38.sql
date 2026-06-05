
GRANT EXECUTE ON FUNCTION public.gen_invite_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_default_categories(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_household() TO service_role;
