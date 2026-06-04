import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { BottomNav, SideNav } from "@/components/layout/BottomNav";
import { getMyHousehold } from "@/lib/households.functions";

export const Route = createFileRoute("/_authenticated/app")({
  ssr: false,
  beforeLoad: async () => {
    const res = await getMyHousehold();
    if (!res.household) throw redirect({ to: "/onboarding" });
    return { household: res.household, members: res.members, profile: res.profile };
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />
      <main className="flex-1 pb-24 lg:pb-8">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
