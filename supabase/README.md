# Supabase Database Migrations

This folder contains SQL migrations for the mHealth Postgres schema.

## Migrations

- `20260301133000_init_mhealth_schema.sql` - bootstrap schema objects if missing
- `20260301133100_harden_mhealth_schema.sql` - idempotent hardening/constraints/indexes
- `20260301145000_auth_user_sync.sql` - sync `auth.users` to `public.users` and `public.applicants`
- `20260301152000_rls_policies.sql` - enable RLS and apply ownership/staff access policies
- `20260306090000_applications_search_trgm.sql` - trigram indexes for application search filters

## Local usage

Use your local dev database URL:

```bash
pnpm db:migrate:dev
pnpm db:check
```

To verify connectivity from the app runtime, hit:

- `GET /api/health/db`

For auth flows, set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
