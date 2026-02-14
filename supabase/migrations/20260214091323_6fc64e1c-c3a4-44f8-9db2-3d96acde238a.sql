
-- Add allowed_tiers to project_templates
ALTER TABLE public.project_templates
ADD COLUMN allowed_tiers text[] NOT NULL DEFAULT '{free,starter,creator,enterprise}';

-- Add max_projects to profiles
ALTER TABLE public.profiles
ADD COLUMN max_projects integer NOT NULL DEFAULT 1;
