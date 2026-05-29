-- =============================================================================
-- Baseline Seed Data — synthesized from 43 incremental migrations
-- @author: Bin Lee <blee@healthcompass.cloud>
--
-- Contains only DML (INSERT … ON CONFLICT DO NOTHING / DO UPDATE).
-- All DDL lives in 20260101000000_baseline_schema.sql.
--
-- Apply with: supabase db reset   (runs automatically after schema)
--             psql -f this_file   (idempotent re-run)
-- =============================================================================

BEGIN;

-- ── Roles ─────────────────────────────────────────────────────────────────────
-- Built-in system roles

INSERT INTO public.roles (name, description, color, is_system)
VALUES
  ('admin',         'Full system access',                               '#dc2626', true),
  ('applicant',     'MassHealth benefit applicant',                     '#6b7280', true),
  ('social_worker', 'Licensed social worker / case manager',            '#2563eb', true),
  ('reviewer',      'Case reviewer with read/comment access',           '#7c3aed', true),
  ('read_only_staff','Read-only access for administrative staff',       '#64748b', false),
  ('case_reviewer', 'Reviews and annotates cases; no edits',            '#8b5cf6', false),
  ('supervisor',    'Supervisor: oversees staff and workflows',         '#f59e0b', false)
ON CONFLICT (name) DO NOTHING;

-- ── Role permissions ─────────────────────────────────────────────────────────

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

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'reviewer', unnest(ARRAY[
    'applications.view',
    'users.view',
    'reports.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'read_only_staff', unnest(ARRAY[
    'applications.view',
    'users.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'case_reviewer', unnest(ARRAY[
    'applications.view',
    'users.view',
    'reports.view',
    'organizations.view',
    'social_workers.view'
  ])
  ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission)
  SELECT 'supervisor', unnest(ARRAY[
    'applications.view','applications.edit',
    'users.view','users.edit','users.invite',
    'reports.view','reports.export',
    'organizations.view','organizations.edit',
    'social_workers.view','social_workers.edit'
  ])
  ON CONFLICT DO NOTHING;

-- ── Admin settings ────────────────────────────────────────────────────────────

INSERT INTO public.admin_settings (key, value)
VALUES
  ('session_timeout_minutes', '60'),
  ('max_sessions_per_user',   '5'),
  ('require_2fa_admin',       'true')
ON CONFLICT (key) DO UPDATE
  SET value      = CASE
    -- Always enforce require_2fa_admin = true (corrects any false value)
    WHEN public.admin_settings.key = 'require_2fa_admin' THEN 'true'
    -- Leave other settings at their existing value on re-run
    ELSE public.admin_settings.value
  END,
  updated_at = now();

COMMIT;
