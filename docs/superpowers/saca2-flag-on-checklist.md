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
- [ ] Smoke test on staging with a real draft: create a SACA-2 application, fill a few steps, watch the status read "All changes saved", use Save & Exit, reopen the application and confirm it resumes automatically (Save & Exit stores the key on the server), then Finish.
- [ ] Optional, code path: the restore code is only asked for when the server key is missing; to test it, resume a draft whose server key is absent and enter the code from the Save & Exit dialog.
- [ ] Social-worker edit page (`/social-worker/patients/<patientId>/applications/<applicationId>`) for a SACA-2 application shows the SACA-2 notice and no ACA-3 form.
- [ ] A phone hand-off (`POST /api/handoff`) for a SACA-2 application is refused ("SACA-2 applications cannot be continued on a phone yet.").
- [ ] An ACA-3 write to a SACA-2 draft returns HTTP 409 with body `{ ok: false, error: <message> }` (there is no `code` field).

## Verify the PDF download (smoke test)

- [ ] **CI:** `.github/workflows/ci.yml` installs `poppler-utils` and `ghostscript` (the PDF end-to-end tests skip or fail without them); confirm a green CI run on the merge commit.
- [ ] **Image:** PDF fill needs `resources/forms/saca2-2026-08.pdf` in the deployed image. After the first real build run `ls .next/standalone/resources/forms/` and confirm `saca2-2026-08.pdf` is there (`next.config.mjs` traces `./resources/forms/**` for `/api/forms/saca2/fill`); on staging, a download that returns "We couldn’t prepare your PDF" with a template-integrity error in the server log means the file is missing or its hash differs.
- [ ] On staging, finish a real SACA-2 draft, click Finish, then "Download your filled SACA-2 (PDF)". Open the file in a PDF reader (not only the browser viewer) and check names, SSN, dates, addresses and the checked boxes against what you entered.
- [ ] Signatures, signature dates and consent boxes are **blank**; the "Print, sign, and date the form yourself" note stays visible after the download.
- [ ] A case with long lists (more than 2 bank accounts, extra Supplement B people or Supplement D jobs) produces continuation sheets or extra supplement pages headed with Person 1's name and SSN.
- [ ] Rate limit: the 11th download within 10 minutes shows "Too many downloads, try again in a few minutes."
- [ ] The server log for a download contains only ids (no names, SSNs or answers).

## Roll back

- [ ] Set `SACA2_ENABLED=false` (or remove it) in the same places and redeploy. Existing SACA-2 drafts then show the unavailable notice instead of the wizard; no data is deleted, and turning the flag back on restores access.

## Known limits at flag-on

- The PDF download ships with the wizard; the eligibility engine (plan 4) is not shipped yet.
- Open: how a social worker acting for a patient should receive the PDF (the download works with the acting-for header, but the delivery flow is undecided).
- Open: MassHealth confirmation that form version `2026-08` is current (spec §7.4).
- Deferred minors (see "What comes next" in `docs/superpowers/plans/2026-10-17-saca2-flag-gate.md`): Supplement A is sticky once an intro question is answered Yes; caregiver-children list sits far from its gate; old `rental` income rows load as "Choose one"; cross-field step errors clear only on Next; terse year error; due-date sanity check.
