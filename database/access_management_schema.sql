-- Access Management Schema — Role & Permission Manager, Session Tracking
-- Run this migration once against your database.
-- @author Bin Lee

-- ── Extend roles table ───────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.roles
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS color        TEXT    NOT NULL DEFAULT '#6b7280',
  ADD COLUMN IF NOT EXISTS is_system    BOOLEAN NOT NULL DEFAULT false;

-- Mark existing built-in roles as system (non-deletable)
UPDATE public.roles SET is_system = true, description = 'Full system access', color = '#dc2626'
  WHERE name = 'admin';
UPDATE public.roles SET is_system = true, description = 'MassHealth benefit applicant', color = '#6b7280'
  WHERE name = 'applicant';
UPDATE public.roles SET is_system = true, description = 'Licensed social worker / case manager', color = '#2563eb'
  WHERE name = 'social_worker';
UPDATE public.roles SET is_system = true, description = 'Case reviewer with read/comment access', color = '#7c3aed'
  WHERE name = 'reviewer';

-- Insert new granular roles (idempotent)
INSERT INTO public.roles (name, description, color, is_system)
  VALUES
    ('read_only_staff',  'Read-only access for administrative staff', '#64748b', false),
    ('case_reviewer',    'Reviews and annotates cases; no edits',     '#8b5cf6', false),
    ('supervisor',       'Supervisor: oversees staff and workflows',  '#f59e0b', false)
  ON CONFLICT (name) DO NOTHING;

-- ── Role permissions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name   TEXT    NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  permission  TEXT    NOT NULL,
  UNIQUE (role_name, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_name);

-- Seed default permissions for admin (all)
INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'admin', unnest(ARRAY[
    'applications.view','applications.edit','applications.delete','applications.export',
    'users.view','users.edit','users.invite','users.bulk',
    'reports.view','reports.export',
    'organizations.view','organizations.edit',
    'social_workers.view','social_workers.edit',
    'admin.roles','admin.sessions'
  ])
  ON CONFLICT DO NOTHING;

-- reviewer defaults
INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'reviewer', unnest(ARRAY[
    'applications.view',
    'users.view',
    'reports.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

-- read_only_staff defaults
INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'read_only_staff', unnest(ARRAY[
    'applications.view',
    'users.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

-- case_reviewer defaults
INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'case_reviewer', unnest(ARRAY[
    'applications.view',
    'users.view',
    'reports.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

-- supervisor defaults
INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'supervisor', unnest(ARRAY[
    'applications.view','applications.edit',
    'users.view','users.edit','users.invite',
    'reports.view','reports.export',
    'organizations.view','organizations.edit',
    'social_workers.view','social_workers.edit'
  ])
  ON CONFLICT DO NOTHING;

-- ── Login / session events ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.login_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type   TEXT        NOT NULL DEFAULT 'login', -- login | logout | force_logout
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_id    ON public.login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON public.login_events(created_at);

-- ── Admin settings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default session policy values
INSERT INTO public.admin_settings (key, value)
  VALUES
    ('session_timeout_minutes', '60'),
    ('max_sessions_per_user',   '5'),
    ('require_2fa_admin',       'false')
  ON CONFLICT (key) DO NOTHING;

-- ── Extend users table ───────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
