import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureHousehold(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("household_id").eq("id", userId).maybeSingle();
  if (!data?.household_id) throw new Error("Sem lar");
  return data.household_id as string;
}

const splitSchema = z.object({ user_id: z.string().uuid(), share_percent: z.number().min(0.01).max(100) });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      kind: z.enum(["income", "expense", "all"]).default("all"),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    let q = supabase
      .from("transactions")
      .select("id, kind, amount, description, note, occurred_on, paid_by_user_id, category_id, category:categories(id,name,color,icon,kind), splits:transaction_splits(user_id,share_percent)")
      .eq("household_id", hh)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      kind: z.enum(["income", "expense"]),
      amount: z.number().positive(),
      category_id: z.string().uuid().nullable().optional(),
      description: z.string().max(120).default(""),
      note: z.string().max(500).nullable().optional(),
      occurred_on: z.string(),
      paid_by_user_id: z.string().uuid().nullable().optional(),
      splits: z.array(splitSchema).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("transactions")
      .update({
        kind: data.kind,
        amount: data.amount,
        category_id: data.category_id ?? null,
        description: data.description,
        note: data.note ?? null,
        occurred_on: data.occurred_on,
        paid_by_user_id: data.kind === "expense" ? (data.paid_by_user_id ?? userId) : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Replace splits
    const { error: dErr } = await supabase.from("transaction_splits").delete().eq("transaction_id", data.id);
    if (dErr) throw new Error(dErr.message);
    if (data.kind === "expense" && data.splits && data.splits.length > 0) {
      const sum = data.splits.reduce((a, s) => a + s.share_percent, 0);
      if (Math.abs(sum - 100) > 0.01) throw new Error("A soma do rateio deve ser 100%");
      const { error: sErr } = await supabase
        .from("transaction_splits")
        .insert(data.splits.map((s) => ({ transaction_id: data.id, ...s })));
      if (sErr) throw new Error(sErr.message);
    }
    return { ok: true };
  });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      kind: z.enum(["income", "expense"]),
      amount: z.number().positive(),
      category_id: z.string().uuid().nullable().optional(),
      description: z.string().max(120).default(""),
      note: z.string().max(500).nullable().optional(),
      occurred_on: z.string(), // YYYY-MM-DD
      paid_by_user_id: z.string().uuid().nullable().optional(),
      splits: z.array(splitSchema).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);

    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        household_id: hh,
        kind: data.kind,
        amount: data.amount,
        category_id: data.category_id ?? null,
        description: data.description,
        note: data.note ?? null,
        occurred_on: data.occurred_on,
        paid_by_user_id: data.kind === "expense" ? (data.paid_by_user_id ?? userId) : null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (data.kind === "expense" && data.splits && data.splits.length > 0) {
      const sum = data.splits.reduce((a, s) => a + s.share_percent, 0);
      if (Math.abs(sum - 100) > 0.01) throw new Error("A soma do rateio deve ser 100%");
      const { error: sErr } = await supabase
        .from("transaction_splits")
        .insert(data.splits.map((s) => ({ transaction_id: tx.id, ...s })));
      if (sErr) throw new Error(sErr.message);
    }
    return { transaction: tx };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
