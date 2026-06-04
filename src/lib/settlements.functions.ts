import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureHousehold(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("household_id").eq("id", userId).maybeSingle();
  if (!data?.household_id) throw new Error("Sem lar");
  return data.household_id as string;
}

export const createSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      to_user_id: z.string().uuid(),
      amount: z.number().positive(),
      occurred_on: z.string(),
      note: z.string().max(200).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    if (data.to_user_id === userId) throw new Error("Destinatário inválido");
    const { error } = await supabase.from("settlements").insert({
      household_id: hh,
      from_user_id: userId,
      to_user_id: data.to_user_id,
      amount: data.amount,
      occurred_on: data.occurred_on,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSettlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { data, error } = await supabase
      .from("settlements")
      .select("id, from_user_id, to_user_id, amount, occurred_on, note")
      .eq("household_id", hh)
      .order("occurred_on", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
