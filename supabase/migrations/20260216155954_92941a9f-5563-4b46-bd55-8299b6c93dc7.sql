UPDATE profiles 
SET tier = 'premium', 
    credits = 250, 
    billing_cycle = 'annual', 
    max_projects = 999, 
    updated_at = now() 
WHERE user_id = '4da0ef13-3bbb-41ae-b1a3-0eda34db6608';