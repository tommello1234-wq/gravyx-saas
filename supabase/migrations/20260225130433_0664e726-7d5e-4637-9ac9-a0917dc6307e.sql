
-- plan_pricing: single source of truth for plan prices
CREATE TABLE public.plan_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier text NOT NULL,
  cycle text NOT NULL,
  price integer NOT NULL,
  credits integer NOT NULL,
  max_projects integer NOT NULL DEFAULT -1,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier, cycle)
);

ALTER TABLE public.plan_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_pricing_public_select" ON public.plan_pricing
  FOR SELECT USING (true);

CREATE POLICY "plan_pricing_admin_all" ON public.plan_pricing
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed current prices (price in centavos)
INSERT INTO public.plan_pricing (tier, cycle, price, credits, max_projects) VALUES
  ('starter',    'monthly', 7900,   80,   3),
  ('starter',    'annual',  42000,  1000, 3),
  ('premium',    'monthly', 16700,  250,  -1),
  ('premium',    'annual',  109700, 3000, -1),
  ('enterprise', 'monthly', 34700,  600,  -1),
  ('enterprise', 'annual',  259700, 7200, -1);

-- coupons
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  valid_until timestamptz,
  allowed_tiers text[],
  allowed_cycles text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_public_select" ON public.coupons
  FOR SELECT USING (true);

CREATE POLICY "coupons_admin_all" ON public.coupons
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- coupon_usages
CREATE TABLE public.coupon_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupon_usages_admin_all" ON public.coupon_usages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "coupon_usages_user_select" ON public.coupon_usages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "coupon_usages_user_insert" ON public.coupon_usages
  FOR INSERT WITH CHECK (user_id = auth.uid());
