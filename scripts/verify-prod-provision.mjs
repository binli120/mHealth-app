#!/usr/bin/env node
/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * Verify a freshly provisioned prod Supabase project has the minimum
 * required data and a working, MFA-gated admin account — before cutting
 * traffic over.
 *
 * Checks mirror the exact fail-closed logic in lib/auth/require-admin.ts:
 * that file 503s if admin_settings.require_2fa_admin is missing, and 403s
 * any admin session without a verified TOTP factor. This script confirms
 * the DB state that logic depends on, so failures surface here instead of
 * at first login.
 *
 * Usage:
 *   DATABASE_DIRECT_URL_PROD="postgresql://postgres.[ref]:[pass]@...:5432/postgres" \
 *   PROD_ADMIN_EMAIL="you@example.com" \
 *     node scripts/verify-prod-provision.mjs
 */

import { Pool } from "pg"

const connectionString = process.env.DATABASE_DIRECT_URL_PROD || process.env.DATABASE_URL_PROD
const adminEmail = process.env.PROD_ADMIN_EMAIL

if (!connectionString) {
  console.error("❌  Set DATABASE_DIRECT_URL_PROD (direct connection, port 5432).")
  process.exit(1)
}
if (!adminEmail) {
  console.error("❌  Set PROD_ADMIN_EMAIL to the admin account you seeded.")
  process.exit(1)
}

// Mix of is_system=true (admin/applicant/social_worker/reviewer) and
// is_system=false (read_only_staff/case_reviewer/supervisor) roles — see
// 20260101000001_baseline_seed.sql. is_system is an app-level distinction
// (e.g. whether a role can be deleted via an admin UI), unrelated to
// whether baseline_seed.sql ran — so this check doesn't filter on it.
const REQUIRED_ROLES = [
  "admin",
  "applicant",
  "social_worker",
  "reviewer",
  "read_only_staff",
  "case_reviewer",
  "supervisor",
]

const REQUIRED_EXTENSIONS = ["pgvector", "pg_trgm"]

let failures = 0
let warnings = 0

function pass(msg) {
  console.log(`✅  ${msg}`)
}
function fail(msg) {
  console.error(`❌  ${msg}`)
  failures++
}
function warn(msg) {
  console.warn(`⚠️   ${msg}`)
  warnings++
}

const pool = new Pool({ connectionString })

try {
  // ── 1. Schema present ──────────────────────────────────────────────────
  const tableCount = await pool.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
  )
  const n = tableCount.rows[0].n
  if (n >= 48) {
    pass(`Schema: ${n} tables in public schema (>= 48 expected from baseline migrations)`)
  } else {
    fail(`Schema: only ${n} tables in public schema — expected >= 48. Migrations incomplete?`)
  }

  // ── 2. Extensions ───────────────────────────────────────────────────────
  const extResult = await pool.query(
    `SELECT extname FROM pg_extension WHERE extname = ANY($1::text[])`,
    [["vector", "pg_trgm"]],
  )
  const installedExts = new Set(extResult.rows.map((r) => r.extname))
  if (installedExts.has("vector")) pass("Extension: pgvector installed")
  else fail("Extension: pgvector (vector) missing — policy_chunks/glossary embeddings will fail")
  if (installedExts.has("pg_trgm")) pass("Extension: pg_trgm installed")
  else fail("Extension: pg_trgm missing — fuzzy search (glossary/Q&A) will fail")

  // ── 3. Roles ─────────────────────────────────────────────────────────────
  const rolesResult = await pool.query(`SELECT name FROM public.roles`)
  const seededRoles = new Set(rolesResult.rows.map((r) => r.name))
  const missingRoles = REQUIRED_ROLES.filter((r) => !seededRoles.has(r))
  if (missingRoles.length === 0) {
    pass(`Roles: all ${REQUIRED_ROLES.length} roles present`)
  } else {
    fail(`Roles: missing ${missingRoles.join(", ")} — re-run baseline_seed.sql`)
  }

  // ── 4. Admin role permissions ───────────────────────────────────────────
  const permsResult = await pool.query(
    `SELECT count(*)::int AS n FROM public.role_permissions WHERE role_name = 'admin'`,
  )
  if (permsResult.rows[0].n > 0) {
    pass(`Permissions: admin role has ${permsResult.rows[0].n} permissions`)
  } else {
    fail("Permissions: admin role has zero permissions — re-run baseline_seed.sql")
  }

  // ── 5. require_2fa_admin — the exact key require-admin.ts fails closed on ──
  const policyResult = await pool.query(
    `SELECT value FROM public.admin_settings WHERE key = 'require_2fa_admin'`,
  )
  const require2fa = policyResult.rows[0]?.value
  if (require2fa === undefined) {
    fail(
      "admin_settings.require_2fa_admin is MISSING — require-admin.ts will 503 all admin " +
        "requests (fails closed by design). Re-run baseline_seed.sql.",
    )
  } else if (require2fa === "true") {
    pass("Policy: require_2fa_admin = true")
  } else {
    fail(`Policy: require_2fa_admin = '${require2fa}' — must be 'true'. Re-run baseline_seed.sql.`)
  }

  // ── 6. Admin account exists, active, correctly linked ───────────────────
  const adminResult = await pool.query(
    `
      SELECT u.id, u.is_active, au.email_confirmed_at IS NOT NULL AS email_confirmed
      FROM public.users u
      JOIN auth.users au ON au.id = u.id
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id AND r.name = 'admin'
      WHERE lower(u.email) = lower($1)
    `,
    [adminEmail],
  )
  if (adminResult.rows.length === 0) {
    fail(`Admin account: no user with admin role found for ${adminEmail}. Run prod-admin-seed.sql.`)
  } else {
    const admin = adminResult.rows[0]
    if (!admin.is_active) fail(`Admin account: ${adminEmail} exists but is_active = false`)
    else pass(`Admin account: ${adminEmail} exists, active, has admin role`)

    if (!admin.email_confirmed) warn(`Admin account: ${adminEmail} email not confirmed in auth.users`)

    // ── 7. MFA enrollment state ────────────────────────────────────────────
    const mfaResult = await pool.query(
      `SELECT status, factor_type FROM auth.mfa_factors WHERE user_id = $1::uuid`,
      [admin.id],
    )
    const verifiedTotp = mfaResult.rows.filter((r) => r.factor_type === "totp" && r.status === "verified")
    if (verifiedTotp.length > 0) {
      pass(`MFA: ${verifiedTotp.length} verified TOTP factor(s) already enrolled for ${adminEmail}`)
    } else if (mfaResult.rows.length > 0) {
      warn(
        `MFA: ${mfaResult.rows.length} unverified/other factor(s) exist for ${adminEmail} — ` +
          "enrollment started but not completed. First login will still require finishing it.",
      )
    } else {
      pass(
        `MFA: no factors enrolled yet for ${adminEmail} (expected for a fresh seed) — ` +
          "require-admin.ts will force enrollment on first login (403 mfa_enrollment_required).",
      )
    }
  }

  // ── 8. Fresh prod — no leaked dev/staging data ──────────────────────────
  const applicantsResult = await pool.query(`SELECT count(*)::int AS n FROM public.applicants`)
  if (applicantsResult.rows[0].n === 0) {
    pass("Data hygiene: public.applicants is empty (fresh prod, no synced dev/staging data)")
  } else {
    warn(
      `Data hygiene: public.applicants has ${applicantsResult.rows[0].n} rows — ` +
        "confirm this is intentional and not a dev/staging sync (see dev-db-v1-phi-orphaned notes).",
    )
  }

  // ── 9. applicants has no plaintext PHI columns ──────────────────────────
  const plaintextColsResult = await pool.query(
    `
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'applicants'
        AND column_name = ANY($1::text[])
    `,
    [["first_name", "last_name", "dob_plaintext", "phone", "address_line1"]],
  )
  if (plaintextColsResult.rows.length === 0) {
    pass("Schema: applicants has no plaintext PHI columns")
  } else {
    fail(
      `Schema: applicants has plaintext PHI columns: ${plaintextColsResult.rows.map((r) => r.column_name).join(", ")}`,
    )
  }
} catch (error) {
  console.error("❌  Verification script errored:")
  console.error(error instanceof Error ? error.message : String(error))
  failures++
} finally {
  await pool.end()
}

console.log("")
if (failures > 0) {
  console.error(`❌  ${failures} check(s) failed, ${warnings} warning(s). Do not cut traffic over yet.`)
  process.exit(1)
} else if (warnings > 0) {
  console.warn(`⚠️   All required checks passed, ${warnings} warning(s) to review.`)
  process.exit(0)
} else {
  console.log("✅  All checks passed. Prod DB is ready.")
  process.exit(0)
}
