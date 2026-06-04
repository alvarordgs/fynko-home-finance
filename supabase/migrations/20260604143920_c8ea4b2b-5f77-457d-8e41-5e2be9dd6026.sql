
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.category_kind AS ENUM ('income','expense');
CREATE TYPE public.member_role AS ENUM ('owner','member');
CREATE TYPE public.recurrence_freq AS ENUM ('weekly','biweekly','monthly','yearly');

-- =========================================================
-- HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE c TEXT;
BEGIN
  LOOP
    c := upper(substr(encode(gen_random_bytes(6),'base64'),1,8));
    c := regexp_replace(c,'[^A-Z0-9]','X','g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE invite_code = c);
  END LOOP;
  RETURN c;
END; $$;

-- =========================================================
-- HOUSEHOLDS
-- =========================================================
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- HOUSEHOLD_MEMBERS
-- =========================================================
CREATE TABLE public.household_members (
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Limit 2 members per household
CREATE OR REPLACE FUNCTION public.enforce_household_size()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.household_members WHERE household_id = NEW.household_id) >= 2 THEN
    RAISE EXCEPTION 'Household already has 2 members';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_household_size BEFORE INSERT ON public.household_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_household_size();

-- Security definer membership check (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.is_household_member(_household UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.household_members
    WHERE household_id = _household AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_household()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid();
$$;

-- =========================================================
-- POLICIES: profiles, households, household_members
-- =========================================================
CREATE POLICY "profiles self select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (household_id IS NOT NULL AND public.is_household_member(household_id)));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "households member select" ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id));
CREATE POLICY "households insert own" ON public.households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "households member update" ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_member(id)) WITH CHECK (public.is_household_member(id));

CREATE POLICY "members self select" ON public.household_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_household_member(household_id));
CREATE POLICY "members self insert" ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "members self delete" ON public.household_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.category_kind NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366F1',
  icon TEXT NOT NULL DEFAULT 'Circle',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories all" ON public.categories FOR ALL TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));
CREATE INDEX idx_categories_household ON public.categories(household_id, kind);

-- =========================================================
-- TRANSACTIONS (income + expense)
-- =========================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  kind public.category_kind NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  note TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions all" ON public.transactions FOR ALL TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));
CREATE INDEX idx_tx_household_date ON public.transactions(household_id, occurred_on DESC);
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- TRANSACTION_SPLITS
-- =========================================================
CREATE TABLE public.transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_percent NUMERIC(5,2) NOT NULL CHECK (share_percent > 0 AND share_percent <= 100),
  UNIQUE (transaction_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_splits TO authenticated;
GRANT ALL ON public.transaction_splits TO service_role;
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "splits all" ON public.transaction_splits FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.is_household_member(t.household_id)))
  WITH CHECK (EXISTS(SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND public.is_household_member(t.household_id)));
CREATE INDEX idx_splits_tx ON public.transaction_splits(transaction_id);

-- =========================================================
-- RECURRING_BILLS
-- =========================================================
CREATE TABLE public.recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  frequency public.recurrence_freq NOT NULL DEFAULT 'monthly',
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  next_due_on DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_bills TO authenticated;
GRANT ALL ON public.recurring_bills TO service_role;
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills all" ON public.recurring_bills FOR ALL TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));
CREATE INDEX idx_bills_household_due ON public.recurring_bills(household_id, next_due_on);
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON public.recurring_bills
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- BUDGETS (limites por categoria/mês)
-- =========================================================
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  limit_amount NUMERIC(12,2) NOT NULL CHECK (limit_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, category_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets all" ON public.budgets FOR ALL TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

-- =========================================================
-- GOALS
-- =========================================================
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals all" ON public.goals FOR ALL TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- SETTLEMENTS (acertos entre membros)
-- =========================================================
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlements select" ON public.settlements FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY "settlements insert" ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id) AND from_user_id = auth.uid());
CREATE POLICY "settlements delete" ON public.settlements FOR DELETE TO authenticated
  USING (public.is_household_member(household_id) AND from_user_id = auth.uid());

-- =========================================================
-- AUTH: create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Seed default categories on household creation
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_default_categories(_household UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.categories (household_id, name, kind, color, icon, is_default) VALUES
    (_household,'Moradia','expense','#6366F1','Home',true),
    (_household,'Mercado','expense','#22C55E','ShoppingCart',true),
    (_household,'Alimentação','expense','#F59E0B','UtensilsCrossed',true),
    (_household,'Transporte','expense','#8B5CF6','Car',true),
    (_household,'Saúde','expense','#EF4444','HeartPulse',true),
    (_household,'Educação','expense','#06B6D4','GraduationCap',true),
    (_household,'Lazer','expense','#EC4899','PartyPopper',true),
    (_household,'Assinaturas','expense','#64748B','Repeat',true),
    (_household,'Impostos','expense','#0F172A','Landmark',true),
    (_household,'Outros','expense','#94A3B8','Circle',true),
    (_household,'Salário','income','#22C55E','Banknote',true),
    (_household,'Freelance','income','#6366F1','Briefcase',true),
    (_household,'Investimentos','income','#8B5CF6','TrendingUp',true),
    (_household,'Outros','income','#94A3B8','Circle',true);
END; $$;
