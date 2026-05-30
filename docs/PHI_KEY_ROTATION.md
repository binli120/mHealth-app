# PHI Encryption Key Rotation Runbook

> **Applies to:** `PROFILE_ENCRYPTION_KEY` (AES-256-GCM, protects all PHI columns in `applicants`)  
> **Script:** `scripts/rekey-phi-encryption.ts`  
> **Estimated time:** 20–40 minutes depending on row count

---

## Why This Key Is Different

Unlike the other production secrets, `PROFILE_ENCRYPTION_KEY` cannot be rotated by
simply updating the GitHub secret and redeploying. Every row in `applicants` was
encrypted with the current key. Swapping the key without re-encrypting the data
will make all PHI unreadable — permanently.

The migration follows a **dual-key window** pattern:

```
Phase A (before)   →   Phase B (migration window)   →   Phase C (after)
─────────────────      ─────────────────────────────    ──────────────────
Single key (v1)        Old key decrypts v1 rows         Single key (v2)
All rows: v1:          New key decrypts v2 rows         All rows: v2:
App writes: v1:        App writes: v2:                  App writes: v2:
                       Script converts v1 → v2
```

---

## Pre-flight Checklist

- [ ] You have direct Postgres access (`DATABASE_URL` for the target environment)
- [ ] You can push secrets to GitHub (`gh auth status` shows the right account)
- [ ] You have Supabase dashboard access
- [ ] A maintenance window or low-traffic window is scheduled *(optional but recommended)*
- [ ] You have tested the procedure on a staging clone first

---

## Step-by-Step Procedure

### Step 1 — Generate a New Key

```bash
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"
# ⚠ Save this value somewhere safe before proceeding
```

The key is 64 hex characters = 32 bytes = AES-256.

---

### Step 2 — Add Both Keys to All Environments

The app needs **both** keys live before you start re-encrypting data.
Adding the new key first (before old rows are re-encrypted) would break reads.
The correct order is:

1. **Add `PROFILE_ENCRYPTION_KEY_OLD`** = current production value
2. **Update `PROFILE_ENCRYPTION_KEY`** = the new key you just generated

**GitHub Actions secrets:**
```bash
# Replace <old_value> with the key currently in .env.production.local
gh secret set PROFILE_ENCRYPTION_KEY_OLD \
  --body "<old_value>" \
  --repo binli120/mHealth-app

printf '%s' "$NEW_KEY" | gh secret set PROFILE_ENCRYPTION_KEY \
  --repo binli120/mHealth-app
```

**Vercel environment variables** (if deployed there):
```bash
vercel env add PROFILE_ENCRYPTION_KEY_OLD production
# paste old value when prompted

vercel env rm PROFILE_ENCRYPTION_KEY production
vercel env add PROFILE_ENCRYPTION_KEY production
# paste new value when prompted
```

**Local `.env.production.local`:**
```dotenv
PROFILE_ENCRYPTION_KEY_OLD=<old_value>
PROFILE_ENCRYPTION_KEY=<new_value>
```

---

### Step 3 — Deploy the Updated `encrypt.ts`

`lib/user-profile/encrypt.ts` was already updated in this repo to dispatch
decryption by version prefix:

| Stored prefix | Key used to decrypt |
|---|---|
| `v2:` | `PROFILE_ENCRYPTION_KEY` (new) |
| `v1:` | `PROFILE_ENCRYPTION_KEY_OLD` (old) |
| *(unversioned legacy)* | `PROFILE_ENCRYPTION_KEY_OLD` (old) |

New writes use `v2:` immediately after this deploy.

```bash
git add lib/user-profile/encrypt.ts
git commit -m "feat(security): dual-key support for PHI key rotation window"
git push
# wait for CI/deploy to complete and verify the app is healthy
```

> **Verify:** Hit a profile endpoint and confirm PHI is still readable.
> If you see decryption errors, double-check `PROFILE_ENCRYPTION_KEY_OLD`.

---

### Step 4 — Dry-run the Rekey Script

```bash
DRY_RUN=true \
PROFILE_ENCRYPTION_KEY_OLD=<old_value> \
PROFILE_ENCRYPTION_KEY_NEW=<new_value> \
DATABASE_URL=<production_connection_string> \
pnpm tsx scripts/rekey-phi-encryption.ts
```

Sample output:
```
🔍  PHI key-rotation — DRY RUN (no writes)
    Batch size : 100
    Columns    : 9

    Processed 1 240 rows | rekeyed 8 340 cols | skipped 0 cols | errors 0…

✅  Dry run complete.
    Rows that would be processed : 1 240
    Column values to re-encrypt  : 8 340
    Column values already v2     : 0

    Remove DRY_RUN=true to execute the migration.
```

If errors appear, investigate before proceeding.

---

### Step 5 — Run the Live Migration

```bash
PROFILE_ENCRYPTION_KEY_OLD=<old_value> \
PROFILE_ENCRYPTION_KEY_NEW=<new_value> \
DATABASE_URL=<production_connection_string> \
pnpm tsx scripts/rekey-phi-encryption.ts
```

The script:
- Processes rows in batches of 100 (cursor-based, safe for large tables)
- Wraps each row update in a transaction (partial failure leaves the row unchanged)
- Skips columns already carrying `v2:` (idempotent — safe to re-run)
- Prints a verification summary at the end

Expected final output:
```
✅  Re-encryption complete.
    Rows processed               : 1 240
    Column values re-encrypted   : 8 340
    Column values already v2     : 0
    Errors                       : 0

🔍  Verifying…
    Rows with v2: columns        : 1 240
    All encrypted columns are now v2. ✓

    Next steps (see docs/PHI_KEY_ROTATION.md):
    1. gh secret set PROFILE_ENCRYPTION_KEY --body "$PROFILE_ENCRYPTION_KEY_NEW"
    2. Remove PROFILE_ENCRYPTION_KEY_OLD from all environments
    3. Deploy the clean encrypt.ts (remove v1: fallback code)
```

> ⚠ **Do not proceed to Step 6 until "All encrypted columns are now v2. ✓" appears.**
> If there are errors, fix them and re-run — the script is fully idempotent.

---

### Step 6 — Remove the Old Key

Only do this after the script reports zero remaining v1/legacy rows.

**GitHub Actions:**
```bash
gh secret delete PROFILE_ENCRYPTION_KEY_OLD --repo binli120/mHealth-app
```

**Vercel:**
```bash
vercel env rm PROFILE_ENCRYPTION_KEY_OLD production
```

**Local `.env.production.local`:**
```diff
- PROFILE_ENCRYPTION_KEY_OLD=<old_value>
  PROFILE_ENCRYPTION_KEY=<new_value>
```

---

### Step 7 — Clean Up `encrypt.ts` (Optional but Recommended)

Once `PROFILE_ENCRYPTION_KEY_OLD` is gone, the `v1:`/legacy fallback code in
`lib/user-profile/encrypt.ts` is dead code.  Remove it to keep the file clean:

Delete the `v1` and `legacy` branches from `decryptField`, and simplify
`getKeyForVersion` back to a single `getCurrentKey()` call.  The `v2:` prefix
stays — it documents which key generation encrypted the data.

---

## Rotating the Other Secrets

For secrets that do **not** encrypt stored data, rotation is simpler:

| Secret | Where to Rotate | GitHub command |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Rotate | `gh secret set SUPABASE_SERVICE_ROLE_KEY` |
| Supabase DB password | Supabase Dashboard → Settings → Database → Reset | Update `DATABASE_URL` secret |
| `MASSHEALTH_API_TOKEN` | MassHealth API portal | `gh secret set MASSHEALTH_API_TOKEN` |
| `OPENOBSERVE_PASSWORD` | OpenObserve admin → Profile | `gh secret set OPENOBSERVE_PASSWORD` |

```bash
# Generic pattern for simple secrets:
printf '%s' "NEW_VALUE_HERE" | gh secret set SECRET_NAME --repo binli120/mHealth-app
```

---

## Rollback Procedure

If the migration causes a production incident at any phase:

| Phase | Rollback action |
|---|---|
| After Step 2, before Step 3 | Revert `PROFILE_ENCRYPTION_KEY` to old value; remove `_OLD`; no DB changes |
| After Step 3 deploy, rekey not started | Revert env vars; redeploy previous `encrypt.ts` |
| Rekey partially complete | Do NOT revert the key; finish the rekey first (script is idempotent); then proceed normally |
| Rekey complete, Step 6 not done | Safe — `_OLD` key is still present; app reads both |

> **Never revert `PROFILE_ENCRYPTION_KEY` after the rekey script has written any v2: rows.** 
> Those rows cannot be decrypted with the old key.

---

## Frequency Recommendation

| Trigger | Action |
|---|---|
| Developer machine compromise | Rotate immediately (all 5 secrets) |
| Employee offboarding (infra access) | Rotate within 24 hours |
| Suspected breach | Rotate immediately + audit logs |
| Routine hygiene | Every 90 days |

---

## Audit Trail

After each rotation, record the event:

```
Date       : YYYY-MM-DD
Rotated by : <name>
Secret(s)  : PROFILE_ENCRYPTION_KEY
Reason     : <routine / machine compromise / etc.>
v1 rows at start : <count from dry-run>
v2 rows at end   : <count from verification>
Duration   : <minutes>
```

Store this in your incident log or Notion security runbook.
