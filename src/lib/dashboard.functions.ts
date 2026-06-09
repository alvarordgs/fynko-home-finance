import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface MemberInfo {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.household_id) throw new Error("Sem lar");
    const hh = profile.household_id;

    // Members
    const { data: memberRows } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", hh);
    const memberIds = (memberRows ?? []).map((m) => m.user_id);
    const { data: memberProfiles } = memberIds.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", memberIds)
      : { data: [] as any };
    const members: MemberInfo[] = memberIds.map((id) => ({
      user_id: id,
      display_name: memberProfiles?.find((p: any) => p.id === id)?.display_name ?? "Membro",
      avatar_url: memberProfiles?.find((p: any) => p.id === id)?.avatar_url ?? null,
    }));

    // Date range: current month
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const next30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    // All transactions
    const { data: allTx } = await supabase
      .from("transactions")
      .select("id, kind, amount, description, occurred_on, paid_by_user_id, category_id, category:categories(name,color)")
      .eq("household_id", hh);

    // Splits for expense transactions
    const expenseIds = (allTx ?? []).filter((t) => t.kind === "expense").map((t) => t.id);
    const { data: splits } = expenseIds.length
      ? await supabase.from("transaction_splits").select("transaction_id, user_id, share_percent").in("transaction_id", expenseIds)
      : { data: [] as any };

    // Settlements
    const { data: settlements } = await supabase
      .from("settlements")
      .select("from_user_id, to_user_id, amount")
      .eq("household_id", hh);

    // Upcoming bills
    const { data: billsRaw } = await supabase
      .from("recurring_bills")
      .select("id, description, amount, next_due_on, is_active, frequency")
      .eq("household_id", hh)
      .eq("is_active", true)
      .order("next_due_on", { ascending: true })
      .limit(20);

    // Mark bill as paid if there's a matching expense transaction in the current cycle window
    function cycleStart(nextDue: string, freq: string): string {
      const d = new Date(nextDue + "T00:00:00");
      if (freq === "weekly") d.setDate(d.getDate() - 7);
      else if (freq === "biweekly") d.setDate(d.getDate() - 14);
      else if (freq === "yearly") d.setFullYear(d.getFullYear() - 1);
      else d.setMonth(d.getMonth() - 1);
      return d.toISOString().slice(0, 10);
    }
    const norm = (s: string) => s.trim().toLowerCase();
    const bills = (billsRaw ?? []).map((b: any) => {
      const start = cycleStart(b.next_due_on, b.frequency);
      const paid = (allTx ?? []).some(
        (t) =>
          t.kind === "expense" &&
          norm(t.description ?? "") === norm(b.description ?? "") &&
          t.occurred_on >= start &&
          t.occurred_on <= b.next_due_on,
      );
      return { ...b, paid };
    });
    const unpaidBills = bills.filter((b: any) => !b.paid);

    // ---------- Calcs ----------
    const incomeTotal = (allTx ?? []).filter((t) => t.kind === "income").reduce((a, t) => a + Number(t.amount), 0);
    const expenseTotal = (allTx ?? []).filter((t) => t.kind === "expense").reduce((a, t) => a + Number(t.amount), 0);
    const currentBalance = incomeTotal - expenseTotal;

    // Pending bills in next 30 days (excluding ones already paid this cycle)
    const pendingTotal = unpaidBills
      .filter((b: any) => b.next_due_on <= next30)
      .reduce((a: number, b: any) => a + Number(b.amount), 0);

    // "A receber" — simplificado: nenhum até futuras receitas recorrentes; placeholder 0
    const receivableTotal = 0;

    const freeMoney = currentBalance - pendingTotal + receivableTotal;
    const projected30 = currentBalance - pendingTotal + receivableTotal;

    // Monthly
    const monthTx = (allTx ?? []).filter((t) => t.occurred_on >= firstOfMonth);
    const monthIncome = monthTx.filter((t) => t.kind === "income").reduce((a, t) => a + Number(t.amount), 0);
    const monthExpense = monthTx.filter((t) => t.kind === "expense").reduce((a, t) => a + Number(t.amount), 0);
    const monthSavings = monthIncome - monthExpense;
    const savingsRate = monthIncome > 0 ? (monthSavings / monthIncome) * 100 : 0;

    // Balances between members
    // For each expense, owed by each member = amount * share% / 100; paid by paid_by
    // balance[user] = sum(paid) - sum(owed) + sum(received settlements) - sum(sent settlements)
    const balance: Record<string, number> = {};
    members.forEach((m) => (balance[m.user_id] = 0));
    for (const t of allTx ?? []) {
      if (t.kind !== "expense" || !t.paid_by_user_id) continue;
      const amt = Number(t.amount);
      const ts = (splits ?? []).filter((s: any) => s.transaction_id === t.id);
      if (ts.length === 0) {
        // default: 100% to payer (no debt)
        balance[t.paid_by_user_id] = (balance[t.paid_by_user_id] ?? 0) + 0;
      } else {
        balance[t.paid_by_user_id] = (balance[t.paid_by_user_id] ?? 0) + amt;
        for (const s of ts) {
          const owed = (amt * Number(s.share_percent)) / 100;
          balance[s.user_id] = (balance[s.user_id] ?? 0) - owed;
        }
      }
    }
    for (const s of settlements ?? []) {
      const amt = Number(s.amount);
      // sender paid debt: increases their balance, decreases receiver's
      balance[s.from_user_id] = (balance[s.from_user_id] ?? 0) + amt;
      balance[s.to_user_id] = (balance[s.to_user_id] ?? 0) - amt;
    }

    // Determine "you owe" / "you receive" for current user
    const myBalance = balance[userId] ?? 0;
    const other = members.find((m) => m.user_id !== userId);
    let owesText: { kind: "owe" | "receive" | "even"; amount: number; otherName: string } = {
      kind: "even",
      amount: 0,
      otherName: other?.display_name ?? "—",
    };
    if (other && Math.abs(myBalance) > 0.01) {
      if (myBalance < 0) owesText = { kind: "owe", amount: Math.abs(myBalance), otherName: other.display_name };
      else owesText = { kind: "receive", amount: myBalance, otherName: other.display_name };
    }

    // Category breakdown current month (expenses)
    const byCategory: Record<string, { name: string; color: string; total: number }> = {};
    for (const t of monthTx) {
      if (t.kind !== "expense") continue;
      const key = t.category_id ?? "none";
      const name = (t.category as any)?.name ?? "Outros";
      const color = (t.category as any)?.color ?? "#94A3B8";
      if (!byCategory[key]) byCategory[key] = { name, color, total: 0 };
      byCategory[key].total += Number(t.amount);
    }
    const categoryBreakdown = Object.values(byCategory).sort((a, b) => b.total - a.total);

    // Upcoming list with days remaining
    const upcoming = unpaidBills.slice(0, 5).map((b: any) => {
      const due = new Date(b.next_due_on + "T00:00:00");
      const days = Math.round((due.getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
      return { id: b.id, description: b.description, amount: Number(b.amount), next_due_on: b.next_due_on, days };
    });

    // Health
    let health: "healthy" | "attention" | "critical" = "healthy";
    if (freeMoney < 0) health = "critical";
    else if (freeMoney < pendingTotal * 0.3) health = "attention";

    return {
      members,
      currentBalance,
      freeMoney,
      pendingTotal,
      receivableTotal,
      projected30,
      month: { income: monthIncome, expense: monthExpense, savings: monthSavings, savingsRate },
      balanceBetween: owesText,
      categoryBreakdown,
      upcoming,
      health,
    };
  });
