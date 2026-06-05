
GRANT EXECUTE ON FUNCTION public.enforce_household_size() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role, anon;
