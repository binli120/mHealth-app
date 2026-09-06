# Prod Supabase — remaining work

Built so far: `docker-compose.app-only.yml`, `deploy-staging.yml`, `deploy-prod.yml`, `.env.prod-instance.example`, `prod-admin-seed.sql.example`, `scripts/verify-prod-provision.mjs`. `deploy.yml` (live site) untouched.

## Blocked on you

- [x] Create prod Supabase project — done 2026-09-04 via MCP, project `HealthCompass MA (Production)`
      (ref `wyuudqskzrdlvdvelbos`, region us-east-1, org HealthCompass.cloud, free tier).
      URL: `https://wyuudqskzrdlvdvelbos.supabase.co`
- [x] Prod domain: `healthcompass.cloud` (root, apex). Staging: `staging.healthcompass.cloud`
- [x] DNS already correct — verified 2026-09-05: both `healthcompass.cloud` and
      `staging.healthcompass.cloud` resolve (Cloudflare-proxied, nameservers
      vick/maisie.ns.cloudflare.com) and return HTTP 200. Nothing to do here.
      Caveat: the apex response's CSP still references
      `tkhgeqydxxsuyrhavbeg.supabase.co` (the **dev** project) — the site
      currently live at `healthcompass.cloud` is still the old `deploy.yml`
      stack, not yet the new `deploy-prod.yml`/prod-v2 stack with the real
      Supabase project. That only happens on the next push to `main`
      (or a manual `deploy-prod.yml` dispatch), and now requires reviewer
      approval per the environment protection rule added below.
- [x] Generate `PROD_PROFILE_ENCRYPTION_KEY` — done, real random key in `production` GH env (see below)
- [x] Pick prod admin email + generate 32+ char initial password — done
      2026-09-05: `blee@comura.ai`, seeded directly via `execute_sql` (no DB
      password/psql access yet — see prod-admin-seed item below). Credentials
      given to the user in chat once; rotate + enroll MFA on first login.

## GH repo config

- [x] `deploy-staging.yml` now runs under the `dev` GH environment (not a
      separate `staging` one — that had zero secrets and env secrets don't
      cascade). Added `STAGING_APP_DIR=/opt/masshealth-staging`,
      `STAGING_DOMAIN=staging.healthcompass.cloud` there. 2026-08-25.
- [x] Created `production` GH environment. Added `PROD_DOMAIN`,
      `PROD_APP_DIR`, `PROD_FROM_EMAIL` (real values) +
      `PROD_PROFILE_ENCRYPTION_KEY`, `PROD_ADMIN_PASSKEY_SESSION_SECRET`,
      `PROD_MCP_CLIENT_SECRET` (real random keys, generated 2026-08-25 —
      don't regenerate, or existing prod-encrypted PHI becomes unreadable
      once real data exists) + `PROD_DATABASE_URL`, `PROD_SUPABASE_URL`,
      `PROD_SUPABASE_ANON_KEY`, `PROD_SUPABASE_PUBLISHABLE_KEY`,
      `PROD_SUPABASE_SERVICE_ROLE_KEY`, `PROD_MCP_CLIENT_ID` (**placeholder
      values — replace once the real prod Supabase project + MCP client
      exist**, before go-live)
- [x] Replaced the 4 placeholder `PROD_SUPABASE_*` secrets with real values
      from the new project — done 2026-09-05 via `gh secret set --env production`.
      `PROD_SUPABASE_SERVICE_ROLE_KEY` is the new-style `sb_secret_...` key
      (not a legacy JWT) — `@supabase/supabase-js` 2.57.x (this repo's
      version) accepts either for server-side `createClient()`.
- [x] `production` env had no protection rules — added a required-reviewer
      rule (binli120) via `gh api PUT repos/.../environments/production`,
      2026-09-05. `push:main` deploys now pause for approval before running.
- [x] `VPS_HOST`, `VPS_USER`, `GH_PAT`, `REPO_SLUG`, `GROQ_API_KEY`,
      `RESEND_API_KEY` were already present in the `production` env (set
      2026-08-25, presumably in an earlier session — values can't be read
      back to confirm they're current, only that they exist).
      `VPS_SSH_KEY` was genuinely missing; set 2026-09-05 from
      `~/.ssh/id_hostinger.ed25519`.

## DB provisioning (once secrets set)

- [x] Applied all 26 migration files (baseline_schema + baseline_seed + 24
      incremental) to the prod project via Supabase MCP `apply_migration`,
      2026-09-04. Note: `20260101000000_baseline_schema.sql` had to be split
      into 5 chunks (tables/functions, indexes, RLS-enable, RLS-policies,
      storage-policies) — applying it as one giant statement through the MCP
      tool threw a spurious `WITH CHECK cannot be applied to SELECT or
      DELETE` that did not reproduce when the same SQL ran in smaller pieces;
      root cause not identified, treat as an MCP/pg-meta quirk with very
      large multi-statement bodies, not a bug in the file itself. Also fixed
      a real bug while investigating: baseline's `is_staff()` and friends are
      `LANGUAGE sql` functions created before `user_roles`/`roles` exist —
      Postgres parse-analyzes SQL-language function bodies at CREATE time, so
      this needs `SET check_function_bodies = false;` before running the
      baseline (add this line near the top of the file).
- [x] Discovered 5 tables exist on dev but are **missing from this migrations
      directory entirely** (not created by any tracked `.sql` file — likely
      added by hand via the dashboard/SQL editor): `feature_flags`,
      `feature_flag_env_overrides`, `mh_appeal_source_documents`,
      `mh_appeal_source_chunks`, `mh_denial_patterns`. Reconstructed their
      schema from dev's live `information_schema`/`pg_constraint`/`pg_indexes`
      and applied to prod, but **there is no migration file for these** — add
      one (e.g. `20260904000001_feature_flags_and_appeal_source.sql`) so a
      future fresh apply (or another environment) doesn't hit the same gap.
- [x] Create storage bucket `masshealth-dev` in the prod project — done via
      SQL insert into `storage.buckets` (private, matches dev: no size limit
      / mime restriction set). RLS policies for it were already applied as
      part of the baseline chunking above.
- [x] Copy `pgvector`/`pg_trgm` extensions from dev project — both installed
      via the baseline's own `CREATE EXTENSION IF NOT EXISTS`.
- [ ] **Security advisor flagged on the new prod project — needs your call:**
      `public.glossary_terms` has RLS **policies** (`gt_select_authenticated`)
      but RLS itself was never enabled on the table — same gap exists in the
      tracked migration (`20260623000008_rls_policies_missing.sql` adds the
      policy but never `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Dev has
      RLS enabled on this table (presumably fixed by hand there too, outside
      any migration). Fix: `ALTER TABLE public.glossary_terms ENABLE ROW LEVEL
      SECURITY;` — safe to run since the SELECT policy already exists, but
      per the advisor's own guidance I'm not auto-applying an RLS-enable
      without your say-so. Also worth a follow-up migration file for this,
      same as the missing-tables gap above.
- [x] Ran the admin seed — 2026-09-05, but via `execute_sql` (MCP) with the
      logic inlined, not `psql -f prod-admin-seed.sql`, since
      `DATABASE_DIRECT_URL_PROD` still needs the real DB password (never
      shown again post-creation; user is resetting it via dashboard).
      `blee@comura.ai` now has the `admin` role, active. Once the password is
      in and `prod-admin-seed.sql` can run for real via psql, it's a no-op —
      the script already skips re-inserting an existing user by email.
- [x] DB password reset by user 2026-09-05, verified with `psql ... SELECT 1`,
      filled into `.env.prod-instance` and pushed as the real `PROD_DATABASE_URL`
      GH secret (`gh secret set`). Also re-ran `prod-admin-seed.sql.example`
      for real via `psql -v` (not just the earlier `execute_sql` path) —
      confirmed idempotent, correctly no-op'd on the existing admin user.
- [x] `pnpm db:verify:prod` — all checks pass. Along the way found + fixed a
      real bug: seeding the admin via direct `auth.users` INSERT (no `role`
      key in `raw_user_meta_data`) let `handle_new_auth_user()`'s trigger
      default to `'patient'` and create a spurious `public.applicants` row
      for the admin account; deleted it. Anyone seeding an admin/staff user
      by hand this way should set `raw_user_meta_data->>'role'` to the real
      role (or clean up the applicants row after) — `prod-admin-seed.sql.example`
      had the exact same gap; fixed by adding `'role', 'admin'` to its
      `raw_user_meta_data` object.
- [ ] First login → complete TOTP MFA enrollment → rotate initial password via Supabase dashboard

## Deploy pipeline

- [x] Cutover done 2026-08-25: `deploy-staging.yml` fires on push to `dev`
      (unchanged); `deploy-prod.yml` now fires on push to `main` (was
      workflow_dispatch-only). Old `deploy.yml` retired to
      workflow_dispatch-only (manual rollback path) so it can't collide
      with `deploy-prod.yml` on `healthcompass.cloud`.
- [x] Retiring the trigger doesn't stop containers already running from the
      old `deploy.yml`'s primary `docker-compose.yml` stack — its `app`,
      `masshealth-analysis`, and `mcp-server` services all carry Traefik
      routers on `Host(\`${DOMAIN}\`)`, same domain the new prod-v2 stack
      now owns. `deploy-prod.yml` now stops those three (by Compose service
      label, excluding its own/staging's containers) before bringing up
      `masshealth-prod`, every run — so a manual `deploy.yml` rollback that
      brings them back gets re-retired on the next real prod deploy.
      `traefik`/`ollama`/`whisper` from that same primary stack are left
      running — staging and prod-v2 both depend on them.
      If `deploy.yml` is ever run manually as a rollback, remember prod-v2
      is still up and will keep winning the domain unless you also stop
      `masshealth-prod`'s `app`/`mcp-server` by hand.
- [ ] Next push to `dev` will auto-run staging — watch it, confirm the
      staging stack comes up on `staging.healthcompass.cloud`
- [ ] Next push to `main` will auto-run prod — with placeholder Supabase
      secrets still in place it'll reach the VPS (once VPS_HOST etc. are
      added to the `production` env) but fail the app health check against
      the placeholder DB. Expected until the real PROD_SUPABASE_* secrets
      go in.

## Optional / can defer post-launch

- [ ] Seed `policy_documents`/`policy_chunks` via `ingest-rag.mjs` (real MassHealth policy corpus)
- [ ] Seed `glossary_terms` via `scripts/seed-glossary.ts`
