import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Try to revalidate with the auth server, but tolerate transient network
    // failures: if the local session exists and is not expired, allow access.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    } catch {
      // network error - fall through to session check
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const stillValid =
      session && (!session.expires_at || session.expires_at * 1000 > Date.now());

    if (stillValid && session.user) return { user: session.user };

    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
