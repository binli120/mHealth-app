# Supabase — Database Schema

The full schema lives in two files under `migrations/`:

| File | Purpose |
|------|---------|
| `migrations/20260101000000_baseline_schema.sql` | All DDL — extensions, types, 43 tables, functions, triggers, indexes, RLS |
| `migrations/20260101000001_baseline_seed.sql` | Seed DML — roles, permissions, admin settings |

Seed data for local development (admin account) lives in `seed.sql` and is applied automatically by `supabase db reset`.

## Local development

```bash
# Preferred: resets and re-applies everything in one command
supabase db reset

# Alternative: apply over an existing database via psql
pnpm db:migrate:dev
```

## Adding new migrations

Future schema changes go in new timestamped migration files:

```bash
supabase migration new <descriptive_name>
# e.g. supabase migration new add_audit_events_table
```

This creates `migrations/YYYYMMDDHHMMSS_<descriptive_name>.sql`. Edit it, then:

```bash
supabase db reset      # apply locally
supabase db push       # push to linked cloud project
```

## Cloud (existing database)

If the baseline has already been applied to a cloud project, stamp it as applied so the CLI does not try to re-run it:

```bash
supabase migration repair --status applied 20260101000000
supabase migration repair --status applied 20260101000001
```

## Connectivity

```bash
pnpm db:check          # verify connection from app runtime
# or hit GET /api/health/db
```

Environment variables needed:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server-side only
```
