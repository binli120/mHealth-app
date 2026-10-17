# SACA-2 flag-on checklist (owner)

The wizard is hidden behind `SACA2_ENABLED` (read per request by `GET /api/config/saca2`; off unless `true` or `1`). Changing it needs an app restart, not a rebuild.

## Turn it on

- [ ] **Local:** set `SACA2_ENABLED=true` in `.env.local` (documented in `.env.example`) and restart `npm run dev`.
- [ ] **Staging:** `.github/workflows/deploy-staging.yml` (GitHub Environment `dev`) writes `.env.production.local` on the VPS in the `printf '%s\n' "KEY=value" ...` block (~line 131, next to `NEXT_PUBLIC_*` and `DOMAIN`). Add a line `"SACA2_ENABLED=${{ vars.SACA2_ENABLED }}"` (or a secret) and create that variable in the `dev` Environment.
- [ ] **Production:** `.github/workflows/deploy-prod.yml` (GitHub Environment `production`, required reviewer) has the same block (~line 138). Add the same line, using a `production` Environment variable (existing entries use `PROD_*` secrets).
- [ ] **`deploy.yml`** (Environment `dev`) has its own env block (~line 146); add the line there too if that workflow is still used.
- [ ] These workflows are owner-owned; this plan did not edit them. Redeploy after adding the variable.

## Verify after the flag is on

- [ ] `GET /api/config/saca2` returns `{ "enabled": true }`.
- [ ] Smoke test on staging with a real draft: create a SACA-2 application, fill a few steps, watch the status read "All changes saved", use Save & Exit and note the restore code, reopen and resume with the code, then Finish.
- [ ] Social-worker edit page (`/social-worker/patients/<patientId>/applications/<applicationId>`) for a SACA-2 application shows the SACA-2 notice and no ACA-3 form.
- [ ] A phone hand-off (`POST /api/handoff`) for a SACA-2 application is refused ("SACA-2 applications cannot be continued on a phone yet.").
- [ ] An ACA-3 write to a SACA-2 draft returns 409 `DRAFT_TYPE_CONFLICT`.

## Known limits at flag-on

- Data collection only: the PDF fill (plan 3) and the eligibility engine (plan 4) are not shipped yet.
- Deferred minors (see "What comes next" in `docs/superpowers/plans/2026-10-17-saca2-flag-gate.md`): Supplement A is sticky once an intro question is answered Yes; caregiver-children list sits far from its gate; old `rental` income rows load as "Choose one"; cross-field step errors clear only on Next; terse year error; due-date sanity check.
