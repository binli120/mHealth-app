# Prod Supabase — remaining work

Built so far: `docker-compose.app-only.yml`, `deploy-staging.yml`, `deploy-prod.yml`, `.env.prod-instance.example`, `prod-admin-seed.sql.example`, `scripts/verify-prod-provision.mjs`. `deploy.yml` (live site) untouched.

## Blocked on you

- [ ] Create prod Supabase project (dashboard, or authorize Supabase MCP — `plugin:supabase:supabase` needs auth first)
- [x] Prod domain: `healthcompass.cloud` (root, apex). Staging: `staging.healthcompass.cloud`
- [ ] Point DNS at VPS IP: A record for `healthcompass.cloud` (apex) + `www` if desired, CNAME/A for `staging.healthcompass.cloud`
- [x] Generate `PROD_PROFILE_ENCRYPTION_KEY` — done, real random key in `production` GH env (see below)
- [ ] Pick prod admin email + generate 32+ char initial password

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
- [ ] `production` env has no protection rules yet — Settings → Environments
      → `production` → add required reviewer (approval gate). Do this before
      real secrets go in, since push:main now deploys there automatically.
- [ ] Still missing from `production` env (not dev-shared, can't be
      inferred/generated — you'll need to add these): `VPS_HOST`,
      `VPS_USER`, `VPS_SSH_KEY`, `GH_PAT`, `REPO_SLUG`, `GROQ_API_KEY`,
      `RESEND_API_KEY`. Without them the prod deploy fails at the SSH
      preflight step regardless of the PROD_* secrets above.

## DB provisioning (once secrets set)

- [ ] `supabase db push --project-ref $SUPABASE_PROJECT_REF_PROD` — apply all 25 migrations
- [ ] Create storage bucket `masshealth-dev` in the prod project (dashboard →
      Storage → New bucket, private/non-public — same name the app code
      hardcodes via `STORAGE_BUCKET` in `lib/supabase/storage.ts:26`, used for
      avatars, application docs, encrypted PHI drafts). The baseline
      migration only creates the 4 RLS policies referencing this bucket
      (`supabase/migrations/20260101000000_baseline_schema.sql:1809-1842`) —
      it does NOT create the bucket row itself; uploads will fail with a
      "bucket not found" error until this is done manually.
- [ ] Copy `pgvector`/`pg_trgm` extensions from dev project (check `list_extensions`)
- [ ] Run `prod-admin-seed.sql` with real email/password (psql `-v`, not committed)
- [ ] `pnpm db:verify:prod` — confirm all checks pass before go-live
- [ ] First login → complete TOTP MFA enrollment → rotate initial password via Supabase dashboard

## Deploy pipeline

- [x] Cutover done 2026-08-25: `deploy-staging.yml` fires on push to `dev`
      (unchanged); `deploy-prod.yml` now fires on push to `main` (was
      workflow_dispatch-only). Old `deploy.yml` retired to
      workflow_dispatch-only (manual rollback path) so it can't collide
      with `deploy-prod.yml` on `healthcompass.cloud`.
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
