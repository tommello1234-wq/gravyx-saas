
-- Add subscription management columns
ALTER TABLE profiles ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN trial_start_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN trial_credits_given INTEGER NOT NULL DEFAULT 0;

-- Change default credits from 5 to 0
ALTER TABLE profiles ALTER COLUMN credits SET DEFAULT 0;

-- Constraint for valid subscription statuses
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_status_check 
  CHECK (subscription_status IN ('trial_active', 'active', 'inactive', 'cancelled'));

-- Migrate existing paid users to 'active'
UPDATE profiles SET subscription_status = 'active' WHERE tier IN ('starter', 'premium', 'enterprise');
-- Free users remain 'inactive' (the default)
