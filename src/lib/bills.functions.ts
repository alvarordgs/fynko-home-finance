import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureHousehold(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("household_id").eq("id", userId).maybeSingle();
  if (!data?.household_id) throw new Error("Sem lar");
  return data.household_id as string;
}

function advanceDate(d: Date, freq: "weekly" | "biweekly" | "monthly" | "yearly"): Date {
  const r = new Date(d);
  if (freq === "weekly") r.setDate(r.getDate() + 7);
  else if (freq === "biweekly") r.setDate(r.getDate() + 14);
  else if (freq === "monthly") r.setMonth(r.getMonth() + 1);
  else r.setFullYear(r.getFullYear() + 1);
  return r;
}

export const listBills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { data, error } = await supabase
      .from("recurring_bills")
      .select("id, description, amount, frequency, due_day, next_due_on, is_active, category:categories(id,name,color,icon)")
      .eq("household_id", hh)
      .order("next_due_on", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      description: z.string().min(1).max(80),
      amount: z.number().positive(),
      category_id: z.string().uuid().nullable().optional(),
      frequency: z.enum(["weekly", "biweekly", "monthly", "yearly"]).default("monthly"),
      due_day: z.number().int().min(1).max(31),
      next_due_on: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { error } = await supabase.from("recurring_bills").insert({
      household_id: hh,
      description: data.description,
      amount: data.amount,
      category_id: data.category_id ?? null,
      frequency: data.frequency,
      due_day: data.due_day,
      next_due_on: data.next_due_on,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const payBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { data: bill, error } = await supabase
      .from("recurring_bills")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !bill) throw new Error("Conta não encontrada");

    // create expense transaction
    const { error: txErr } = await supabase.from("transactions").insert({
      household_id: hh,
      kind: "expense",
      amount: bill.amount,
      category_id: bill.category_id,
      description: bill.description,
      occurred_on: bill.next_due_on,
      paid_by_user_id: userId,
      created_by: userId,
    });
    if (txErr) throw new Error(txErr.message);

    const nextDate = advanceDate(new Date(bill.next_due_on + "T00:00:00"), bill.frequency as any);
    const nextStr = nextDate.toISOString().slice(0, 10);
    const { error: uErr } = await supabase
      .from("recurring_bills")
      .update({ next_due_on: nextStr })
      .eq("id", bill.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const updateBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      description: z.string().min(1).max(80),
      amount: z.number().positive(),
      category_id: z.string().uuid().nullable().optional(),
      frequency: z.enum(["weekly", "biweekly", "monthly", "yearly"]),
      due_day: z.number().int().min(1).max(31),
      next_due_on: z.string(),
      is_active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("recurring_bills").update({
      description: data.description,
      amount: data.amount,
      category_id: data.category_id ?? null,
      frequency: data.frequency,
      due_day: data.due_day,
      next_due_on: data.next_due_on,
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("recurring_bills").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
