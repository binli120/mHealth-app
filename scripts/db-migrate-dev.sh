#!/usr/bin/env bash

set -euo pipefail

if [[ -f ./.env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env.local
  set +a
fi

# Migrations require a direct (non-pooler) connection — port 5432, not 6543.
db_url="${DATABASE_DIRECT_URL:-${DATABASE_URL:-}}"
if [[ -z "$db_url" ]]; then
  echo "Error: set DATABASE_DIRECT_URL (preferred) or DATABASE_URL to your Supabase direct connection string." >&2
  echo "  Direct URL uses port 5432 (not the pooler at 6543)." >&2
  exit 1
fi

psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301133000_init_mhealth_schema.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301133100_harden_mhealth_schema.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301145000_auth_user_sync.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301152000_rls_policies.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260305214500_application_drafts.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260306090000_applications_search_trgm.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260322000000_collaborative_sessions.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260410000000_income_verification.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260430140000_admin_passkeys.sql
