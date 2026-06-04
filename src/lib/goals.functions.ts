import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureHousehold(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("household_id").eq("id", userId).maybeSingle();
  if (!data?.household_id) throw new Error("Sem lar");
  return data.household_id as string;
}

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("household_id", hh)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().min(1).max(80),
      target_amount: z.number().positive(),
      deadline: z.string().nullable().optional(),
      note: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { error } = await supabase.from("goals").insert({
      household_id: hh,
      name: data.name,
      target_amount: data.target_amount,
      deadline: data.deadline ?? null,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateGoalProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), current_amount: z.number().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("goals").update({ current_amount: data.current_amount }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
