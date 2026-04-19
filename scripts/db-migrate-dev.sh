#!/usr/bin/env bash

set -euo pipefail

if [[ -f ./.env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env.local
  set +a
fi

db_url="${DATABASE_URL_DEV:-postgresql://postgres:postgres@localhost:54322/postgres}"

psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301133000_init_mhealth_schema.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301133100_harden_mhealth_schema.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301145000_auth_user_sync.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260301152000_rls_policies.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260305214500_application_drafts.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260306090000_applications_search_trgm.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260322000000_collaborative_sessions.sql
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260410000000_income_verification.sql
