
-- Fix RLS policies for gamification tables
-- The issue: all policies were created as RESTRICTIVE, so block_anon(false) blocks everyone

-- user_streaks: drop all and recreate as PERMISSIVE
DROP POLICY IF EXISTS "user_streaks_admin_all" ON public.user_streaks;
DROP POLICY IF EXISTS "user_streaks_block_anon" ON public.user_streaks;
DROP POLICY IF EXISTS "user_streaks_user_insert" ON public.user_streaks;
DROP POLICY IF EXISTS "user_streaks_user_select" ON public.user_streaks;
DROP POLICY IF EXISTS "user_streaks_user_update" ON public.user_streaks;

CREATE POLICY "user_streaks_user_select" ON public.user_streaks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_streaks_user_insert" ON public.user_streaks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_streaks_user_update" ON public.user_streaks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_streaks_admin_all" ON public.user_streaks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- user_journey: drop all and recreate as PERMISSIVE
DROP POLICY IF EXISTS "user_journey_admin_all" ON public.user_journey;
DROP POLICY IF EXISTS "user_journey_block_anon" ON public.user_journey;
DROP POLICY IF EXISTS "user_journey_user_insert" ON public.user_journey;
DROP POLICY IF EXISTS "user_journey_user_select" ON public.user_journey;
DROP POLICY IF EXISTS "user_journey_user_update" ON public.user_journey;

CREATE POLICY "user_journey_user_select" ON public.user_journey FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_journey_user_insert" ON public.user_journey FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_journey_user_update" ON public.user_journey FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_journey_admin_all" ON public.user_journey FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- user_missions: drop all and recreate as PERMISSIVE
DROP POLICY IF EXISTS "user_missions_admin_all" ON public.user_missions;
DROP POLICY IF EXISTS "user_missions_block_anon" ON public.user_missions;
DROP POLICY IF EXISTS "user_missions_user_insert" ON public.user_missions;
DROP POLICY IF EXISTS "user_missions_user_select" ON public.user_missions;
DROP POLICY IF EXISTS "user_missions_user_update" ON public.user_missions;

CREATE POLICY "user_missions_user_select" ON public.user_missions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_missions_user_insert" ON public.user_missions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_missions_user_update" ON public.user_missions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_missions_admin_all" ON public.user_missions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- user_badges: drop all and recreate as PERMISSIVE
DROP POLICY IF EXISTS "user_badges_admin_all" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_block_anon" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_user_insert" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_user_select" ON public.user_badges;

CREATE POLICY "user_badges_user_select" ON public.user_badges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_badges_user_insert" ON public.user_badges FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_badges_admin_all" ON public.user_badges FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
