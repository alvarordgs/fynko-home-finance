import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureHousehold(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("household_id").eq("id", userId).maybeSingle();
  if (!data?.household_id) throw new Error("Sem lar");
  return data.household_id as string;
}

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, kind, color, icon")
      .eq("household_id", hh)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().min(1).max(40),
      kind: z.enum(["income", "expense"]),
      color: z.string().default("#6366F1"),
      icon: z.string().default("Circle"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hh = await ensureHousehold(supabase, userId);
    const { error } = await supabase.from("categories").insert({ ...data, household_id: hh });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
