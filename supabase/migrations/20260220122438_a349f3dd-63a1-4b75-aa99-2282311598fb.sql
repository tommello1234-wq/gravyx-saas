
-- Add user_level column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_level text NOT NULL DEFAULT 'beginner';

-- Table: user_streaks
CREATE TABLE public.user_streaks (
  user_id uuid NOT NULL PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  last_login_date date,
  longest_streak integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_streaks_user_select" ON public.user_streaks FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "user_streaks_user_insert" ON public.user_streaks FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_streaks_user_update" ON public.user_streaks FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_streaks_admin_all" ON public.user_streaks FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_streaks_block_anon" ON public.user_streaks FOR ALL TO anon USING (false) WITH CHECK (false);

-- Table: user_journey
CREATE TABLE public.user_journey (
  user_id uuid NOT NULL PRIMARY KEY,
  journey_start_date date,
  current_day integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_journey ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_journey_user_select" ON public.user_journey FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "user_journey_user_insert" ON public.user_journey FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_journey_user_update" ON public.user_journey FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_journey_admin_all" ON public.user_journey FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_journey_block_anon" ON public.user_journey FOR ALL TO anon USING (false) WITH CHECK (false);

-- Table: user_missions
CREATE TABLE public.user_missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 10),
  completed boolean NOT NULL DEFAULT false,
  reward_claimed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  claimed_at timestamptz,
  UNIQUE (user_id, day_number)
);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_missions_user_select" ON public.user_missions FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "user_missions_user_insert" ON public.user_missions FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_missions_user_update" ON public.user_missions FOR UPDATE USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_missions_admin_all" ON public.user_missions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_missions_block_anon" ON public.user_missions FOR ALL TO anon USING (false) WITH CHECK (false);

-- Table: user_badges
CREATE TABLE public.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  badge_id text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_user_select" ON public.user_badges FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "user_badges_user_insert" ON public.user_badges FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_badges_admin_all" ON public.user_badges FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_badges_block_anon" ON public.user_badges FOR ALL TO anon USING (false) WITH CHECK (false);
