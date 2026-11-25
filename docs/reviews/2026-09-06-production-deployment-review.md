# Production database and deployment review

Reviewed 2026-09-06 evening EDT (2026-09-07 UTC). Scope: GitHub main `7aacbca31502e1033c7304c8a03e8e62a83f128e`, dev `93a5a94e31c325179c5b14f46816b3e64c175c5a`, production Supabase catalog, GitHub environment/rules configuration, deployment logs, and public endpoint responses. Production queries were read-only. No production settings, records, deployments, or credentials were changed.

## Verified deployment mapping

| Branch | Workflow environment | Live domain | Supabase project |
|---|---|---|---|
| main | production, required reviewer | healthcompass.cloud | wyuudqskzrdlvdvelbos |
| dev | dev | staging.healthcompass.cloud | tkhgeqydxxsuyrhavbeg |

Both `.cloud` homepages returned HTTP 200, and their CSP headers referenced the corresponding separate Supabase projects. Production `/api/health/db` returned `{"ok":true}`. Supabase lists both projects ACTIVE_HEALTHY. GitHub secret names separate production database/auth/encryption credentials from staging, but GitHub does not allow reading secret values back; live process values and encryption-key uniqueness were not audited on the VPS.

The requested `.com` mapping is not the observed deployment: healthcompass.com redirects to www.healthcompass.com, and staging.healthcompass.com does not resolve, including on the unsandboxed retry. Confirm whether `.cloud` is the intended domain before changing DNS or authentication redirects.

## Findings

### P1 — Privileged data-reset function is executable by untrusted database roles

Source: main `supabase/migrations/20260806000001_personal_data_reset.sql:56` and `:146`; verified against live `pg_proc`, `proacl`, and `has_function_privilege`.

`public.reset_customer_personal_data(uuid)` runs as SECURITY DEFINER. The live ACL explicitly grants EXECUTE to both `anon` and `authenticated`, in addition to postgres and service_role. Its body accepts any non-null user ID and performs broad deletion of applicant/application records, messages, notifications, insurance, and audit records without checking caller ownership. Revoking from PUBLIC in the tracked migration does not remove the explicit role grants present in production. Table RLS does not make this privileged function safe.

Revoke EXECUTE from PUBLIC, anon, and authenticated in a new migration and preserve only the intended server caller. Add an assertion of the effective grants to production verification. Review default function grants as well. The function was NOT executed during this audit. Attempts to inspect the REST API schema using locally saved public keys returned 401, so HTTP exploitability was not demonstrated; the unsafe database permission and function body were directly confirmed.

Reference: https://supabase.com/docs/guides/database/functions

### P1 — Failed repeat deployment can take production down without restoring it

Source: main `.github/workflows/deploy-prod.yml:157` and `:170`.

The rollback path assumes legacy containers remain running. Discovery uses `docker ps`, which only returns running containers; after successful cutover, the legacy containers have been stopped. On a later build/startup/health failure, rollback invokes `docker compose ... -p masshealth-prod down` but has no previously running legacy container to restart. It also does not restore the prior production image. This can remove a healthy old production service even when the replacement build failed.

Build immutable images tagged by commit before changing running services. Preserve the last known good production image/configuration and restore that same production stack on failure. Validate rollback after cutover, not only during the first deployment. The old dev-database stack is not an appropriate production-data rollback target.

### P1 — Deployment is not bound to the revision CI validated

Source: main `.github/workflows/deploy-prod.yml:101`; dev `.github/workflows/deploy-staging.yml` has the equivalent origin/dev reset.

CI validates the triggering revision, but the VPS fetches and resets to the latest branch tip. A newer push during CI or production approval can cause a run to deploy code that its own CI did not test. Manual dispatch can also test one ref while deploying another. E2E subsequently checks out a branch name rather than a recorded deployed commit.

Pass and deploy the exact validated commit, verify its branch eligibility, and propagate that identity through image labels and smoke tests. The inspected production log did deploy 7aacbca, matching its triggering revision on this particular run; this is a future race, not evidence that this run deployed the wrong code.

### P2 — Production migration history does not match repository migration IDs

The repository contains 29 migration files, whereas production records 14 entries with September 4 execution-time IDs and grouped names such as `migrations_20260529`. The recorded IDs do not correspond to the repository filenames. Schema provisioning succeeded, but the migration ledger is not a reproducible record of those tracked migrations. Deployment performs no migration consistency check.

Reconcile the ledger against a verified schema comparison and tracked migration contents before enabling automated database pushes. Do not blindly replay the baseline or blindly mark every migration applied. Then add a migration-status gate and a controlled migration stage using the dedicated production connection.

### P2 — Main has no branch protection

GitHub's classic main-branch protection endpoint returned “Branch not protected.” The only active repository ruleset is `protect dev`, explicitly scoped to refs/heads/dev. Production environment approval exists but is not a merge protection rule, and the environment has no branch restriction.

Protect main with PR and required CI checks, restrict production deployments to main, and guard manual dispatch. Add a production build check before merge: the current reusable CI checks lint, types, unit tests, and dependency audit, while the image build happens later on the VPS.

### P2 — Production smoke validation is pending and authenticated coverage is missing

Production post-deploy run 34070723519 is waiting at its Playwright job. The environment requires a second approval. The production environment has no E2E account secrets, and the workflow documents that authenticated cases self-skip. A separate successful push-triggered run is not proof of the new production deployment: push/manual fallbacks select dev environment secrets.

Create a narrow, non-destructive production smoke path that does not require a second approval, validates the deployed revision, and includes a dedicated authenticated synthetic account. Keep destructive application journeys on staging. Do not run the full existing suite on real customer accounts.

### P2 — Retention scheduling is absent from the VPS deployment configuration

Source: main `vercel.json:2`, `app/api/cron/purge-identity-extractions/route.ts:31`, production workflow and app-only Compose file.

The 30-day extraction cleanup is scheduled only through Vercel configuration, but the app is deployed to a Hostinger VPS. The production workflow does not supply CRON_SECRET or install a scheduler. No scheduler is defined in the reviewed Compose/deploy configuration. An independently configured host scheduler was not inspected.

Provision and monitor a VPS-compatible scheduled job, configure its authentication, and verify an actual successful cleanup run. Until that external configuration is confirmed, the retention policy is not established by the deployment files.

## Database checks that passed

- 62 public base tables (64 public relations including views).
- All public base tables have RLS enabled, including glossary_terms. The older TODO claiming glossary RLS was missing is stale.
- All five formerly missing feature-flag/appeal-source tables exist; current main also contains their reconstruction migration.
- vector and pg_trgm extensions exist.
- All 7 baseline roles and 16 admin permissions exist.
- require_2fa_admin is true; the production admin is active and has one verified TOTP factor.
- No applicant records currently exist; checked plaintext applicant PHI columns are absent.
- The storage bucket named masshealth-dev is private inside the separate production project. Its name does not mean it points to the dev project. Bucket-level size/MIME restrictions are unset.
- Repository provisioning verification completed successfully, but that script does not validate privileged-function grants or migration-ledger parity; its green result does not override the findings above.

## Build and hosted validation

Production run: https://github.com/binli120/mHealth-app/actions/runs/34070313622

The deployment log identifies main 7aacbca; lint, TypeScript, unit/coverage, and production dependency-audit jobs passed. Its production Docker build compiled successfully and generated 152/152 pages. The app's internal database health check passed after five seconds. Standalone CI runs were cancelled, but the reusable CI jobs inside this deployment passed.

Staging deploy: https://github.com/binli120/mHealth-app/actions/runs/34072233075

Latest staging smoke: https://github.com/binli120/mHealth-app/actions/runs/34072558857 (success at review time).

Pending production smoke: https://github.com/binli120/mHealth-app/actions/runs/34070723519

A separate clean Next.js production build of the exported main revision also passed during this review (Turbopack, Next.js 16.2.11). It used installed locked dependencies and a placeholder public auth key, so it verifies compilation, not production authentication or Docker image equivalence. Initial attempts to reuse the current feature checkout dependencies were discarded after version/resolution errors.

## Limits

This was a configuration and live catalog review, not exhaustive application authorization testing. Supabase Auth redirect allowlists, SMTP/provider configuration, backup/PITR settings and restoration, VPS firewall/process configuration, and live secret values were not independently verified. No destructive RPC, customer workflow, or production migration was executed. Locally saved Supabase public keys returned 401 on API-schema reads; reconcile those local credentials with current project keys before relying on that file for operational scripts.
