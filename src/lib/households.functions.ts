import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyHousehold = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, household_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.household_id) return { profile, household: null, members: [] };

    const { data: household } = await supabase
      .from("households")
      .select("id, name, invite_code, created_by")
      .eq("id", profile.household_id)
      .maybeSingle();

    const { data: memberRows } = await supabase
      .from("household_members")
      .select("user_id, role")
      .eq("household_id", profile.household_id);

    const ids = (memberRows ?? []).map((m) => m.user_id);
    const { data: memberProfiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
      : { data: [] as Array<{ id: string; display_name: string; avatar_url: string | null }> };

    const members = (memberRows ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: memberProfiles?.find((p) => p.id === m.user_id)?.display_name ?? "Membro",
      avatar_url: memberProfiles?.find((p) => p.id === m.user_id)?.avatar_url ?? null,
    }));

    return { profile, household, members };
  });

export const createHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("household_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile?.household_id) return { household: { id: profile.household_id } };

    const { data: code } = await supabaseAdmin.rpc("gen_invite_code");
    const inviteCode = (code as unknown as string) ?? Math.random().toString(36).slice(2, 10).toUpperCase();

    const { data: hh, error } = await supabase
      .from("households")
      .insert({ name: data.name, invite_code: inviteCode, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: mErr } = await supabaseAdmin
      .from("household_members")
      .insert({ household_id: hh.id, user_id: userId, role: "owner" });
    if (mErr) throw new Error(mErr.message);

    const { error: updateError } = await supabaseAdmin.from("profiles").update({ household_id: hh.id }).eq("id", userId);
    if (updateError) throw new Error(updateError.message);
    await supabaseAdmin.rpc("seed_default_categories", { _household: hh.id });

    return { household: hh };
  });

export const joinHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteCode: z.string().min(4).max(16) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const code = data.inviteCode.trim().toUpperCase();
    const { data: hh } = await supabaseAdmin
      .from("households")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (!hh) throw new Error("Código inválido");

    const { count } = await supabaseAdmin
      .from("household_members")
      .select("*", { count: "exact", head: true })
      .eq("household_id", hh.id);
    if ((count ?? 0) >= 2) throw new Error("Este lar já está completo (2 membros)");

    const { error } = await supabaseAdmin
      .from("household_members")
      .insert({ household_id: hh.id, user_id: userId, role: "member" });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("profiles").update({ household_id: hh.id }).eq("id", userId);
    return { household_id: hh.id };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ display_name: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ display_name: data.display_name }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
