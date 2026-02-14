ALTER TABLE public.profiles DROP CONSTRAINT profiles_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tier_check CHECK (tier IN ('free', 'starter', 'premium', 'enterprise'));

UPDATE profiles SET credits = 1000, tier = 'starter', billing_cycle = 'annual', max_projects = 3 WHERE user_id = '7035b1c0-4dfd-4a57-b364-331b72d1b535';