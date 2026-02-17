
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily trial credits at midnight UTC
SELECT cron.schedule(
  'trial-daily-credits',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oruslrvpmdhtnrsgoght.supabase.co/functions/v1/trial-daily-credits',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ydXNscnZwbWRodG5yc2dvZ2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMDM0MjQsImV4cCI6MjA4NTg3OTQyNH0.ibDv2VXURAdPj1NfHrlhj26bPagWguYHvPSviAJJOn4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
