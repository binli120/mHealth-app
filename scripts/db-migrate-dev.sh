#!/usr/bin/env bash
# @author: Bin Lee
# @email: blee@healthcompass.cloud


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

echo "Applying baseline schema..."
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260101000000_baseline_schema.sql

echo "Applying baseline seed (roles, permissions, admin settings)..."
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/migrations/20260101000001_baseline_seed.sql

echo "Seeding local dev admin account..."
psql "$db_url" -v ON_ERROR_STOP=1 -f ./supabase/seed.sql

echo "Done. Database is ready."
