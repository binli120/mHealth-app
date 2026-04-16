/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Global setup: creates demo users via the dev-register API and saves
 * Playwright storage-state so auth-dependent tests start already logged in.
 *
 * Robust behaviour
 * ─────────────────
 * If Supabase / the dev server is unreachable the setup logs a clear warning
 * and writes an *empty* storage-state file for each user.  This lets the test
 * suite run to completion: auth-protected tests will fail on their own terms
 * (e.g. redirected to /auth/login) rather than with a cryptic ENOENT crash.
 *
 * Prerequisites for a fully passing suite
 * ─────────────────────────────────────────
 *   1. `pnpm dev`  (Next.js dev server on :3000)
 *   2. Cloud Supabase credentials in .env.local (NEXT_PUBLIC_SUPABASE_URL,
 *      NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL pointing to cloud).
 *
 * Note: dev-register is disabled when NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=false
 * (cloud Supabase mode).  Auth-dependent tests skip gracefully in that case.
 */

import { test as setup } from "@playwright/test"
import { DEMO_USER, REVIEWER_USER, ADMIN_USER, SOCIAL_WORKER_USER } from "./fixtures/demo-data"
import * as fs from "fs"
import * as path from "path"
import { Pool } from "pg"

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const IS_REMOTE = !BASE_URL.startsWith("http://localhost") && !BASE_URL.startsWith("http://127.0.0.1")

// Allow credential overrides for pre-existing cloud accounts (set via GitHub secrets)
const CLOUD_DEMO_USER = {
  ...DEMO_USER,
  email:    process.env.E2E_DEMO_EMAIL    ?? DEMO_USER.email,
  password: process.env.E2E_DEMO_PASSWORD ?? DEMO_USER.password,
}
const CLOUD_REVIEWER_USER = {
  ...REVIEWER_USER,
  email:    process.env.E2E_REVIEWER_EMAIL    ?? REVIEWER_USER.email,
  password: process.env.E2E_REVIEWER_PASSWORD ?? REVIEWER_USER.password,
}
const CLOUD_ADMIN_USER = {
  ...ADMIN_USER,
  email:    process.env.E2E_ADMIN_EMAIL    ?? ADMIN_USER.email,
  password: process.env.E2E_ADMIN_PASSWORD ?? ADMIN_USER.password,
}
const CLOUD_SOCIAL_WORKER_USER = {
  ...SOCIAL_WORKER_USER,
  email:    process.env.E2E_SOCIAL_WORKER_EMAIL    ?? SOCIAL_WORKER_USER.email,
  password: process.env.E2E_SOCIAL_WORKER_PASSWORD ?? SOCIAL_WORKER_USER.password,
}

const AUTH_DIR        = path.join(__dirname, ".auth")
const AUTH_FILE       = path.join(AUTH_DIR, "user.json")
const REVIEWER_AUTH_FILE = path.join(AUTH_DIR, "reviewer.json")
const ADMIN_AUTH_FILE = path.join(AUTH_DIR, "admin.json")
const SOCIAL_WORKER_AUTH_FILE = path.join(AUTH_DIR, "social-worker.json")

/** Empty Playwright storage-state — lets tests run without crashing on ENOENT */
const EMPTY_STORAGE_STATE = JSON.stringify({ cookies: [], origins: [] })

function ensureAuthDir() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  // Pre-create empty state files so tests never hit ENOENT even if the setup
  // test is killed by a Playwright timeout before the catch block can run.
  if (!fs.existsSync(AUTH_FILE)) writeEmptyState(AUTH_FILE)
  if (!fs.existsSync(REVIEWER_AUTH_FILE)) writeEmptyState(REVIEWER_AUTH_FILE)
  if (!fs.existsSync(ADMIN_AUTH_FILE)) writeEmptyState(ADMIN_AUTH_FILE)
  if (!fs.existsSync(SOCIAL_WORKER_AUTH_FILE)) writeEmptyState(SOCIAL_WORKER_AUTH_FILE)
}

function writeEmptyState(filePath: string) {
  fs.writeFileSync(filePath, EMPTY_STORAGE_STATE, "utf8")
}

async function ensureUser(
  request: import("@playwright/test").APIRequestContext,
  user: typeof DEMO_USER | typeof REVIEWER_USER | typeof ADMIN_USER | typeof SOCIAL_WORKER_USER,
): Promise<boolean> {
  try {
    const data: Record<string, unknown> = {
      email:     user.email,
      password:  user.password,
      firstName: user.firstName,
      lastName:  user.lastName,
      phone:     user.phone,
    }
    if ("role" in user) data.role = user.role
    if ("companyName" in user) {
      data.companyName = user.companyName
      data.companyNpi = user.companyNpi
      data.companyAddress = user.companyAddress
      data.companyCity = user.companyCity
      data.companyState = user.companyState
      data.companyZip = user.companyZip
      data.companyEmailDomain = user.companyEmailDomain
      data.licenseNumber = user.licenseNumber
      data.jobTitle = user.jobTitle
    }

    const res = await request.post("/api/auth/dev-register", {
      data,
      timeout: 10_000,
    })
    const body = await res.json().catch(() => ({}))
    const ok = res.ok() || (body as { ok?: boolean }).ok === true || (body as { error?: string }).error === "already_exists"
    if (!ok) {
      console.warn(`[setup] dev-register returned non-OK for ${user.email}:`, body)
    }
    return true
  } catch (err) {
    console.warn(`[setup] dev-register failed for ${user.email}:`, (err as Error).message)
    return false
  }
}

async function loginAndSaveState(
  page: import("@playwright/test").Page,
  user: typeof DEMO_USER | typeof REVIEWER_USER | typeof ADMIN_USER | typeof SOCIAL_WORKER_USER,
  filePath: string,
): Promise<boolean> {
  try {
    await page.goto("/auth/login", { timeout: 15_000 })
    await page.fill("#email",    user.email)
    await page.fill("#password", user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(customer\/dashboard|admin|social-worker\/dashboard)/, { timeout: 20_000 })
    await page.context().storageState({ path: filePath })
    console.log(`[setup] ✅ Auth state saved for ${user.email} → ${path.basename(filePath)}`)
    return true
  } catch (err) {
    console.warn(
      `[setup] ⚠️  Login failed for ${user.email} — saving empty auth state.\n` +
      `         Cause: ${(err as Error).message}\n` +
      `         Auth-protected tests will not reach their target pages.\n` +
      `         Make sure 'pnpm dev' is running and cloud Supabase credentials are set in .env.local.`,
    )
    writeEmptyState(filePath)
    return false
  }
}

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL_DEV ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:54322/postgres"
}

async function ensureLocalDemoRoles() {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() })

  try {
    await pool.query("BEGIN")
    await pool.query(
      `INSERT INTO public.roles (name) VALUES ('admin'), ('reviewer'), ('social_worker')
       ON CONFLICT (name) DO NOTHING`,
    )

    const userRows = await pool.query<{ id: string; email: string }>(
      `SELECT id, lower(email) AS email
       FROM public.users
       WHERE lower(email) = ANY($1::text[])`,
      [[
        DEMO_USER.email,
        REVIEWER_USER.email,
        ADMIN_USER.email,
        SOCIAL_WORKER_USER.email,
      ].map((email) => email.toLowerCase())],
    )
    const ids = new Map(userRows.rows.map((row) => [row.email, row.id]))
    const demoUserId = ids.get(DEMO_USER.email.toLowerCase())
    const reviewerUserId = ids.get(REVIEWER_USER.email.toLowerCase())
    const adminUserId = ids.get(ADMIN_USER.email.toLowerCase())
    const swUserId = ids.get(SOCIAL_WORKER_USER.email.toLowerCase())

    if (adminUserId) {
      await pool.query(
        `INSERT INTO public.user_roles (user_id, role_id)
         SELECT $1::uuid, id FROM public.roles WHERE name = 'admin'
         ON CONFLICT DO NOTHING`,
        [adminUserId],
      )
    }

    if (reviewerUserId) {
      await pool.query(
        `INSERT INTO public.user_roles (user_id, role_id)
         SELECT $1::uuid, id FROM public.roles WHERE name = 'reviewer'
         ON CONFLICT DO NOTHING`,
        [reviewerUserId],
      )
    }

    if (swUserId) {
      await pool.query(
        `INSERT INTO public.user_roles (user_id, role_id)
         SELECT $1::uuid, id FROM public.roles WHERE name = 'social_worker'
         ON CONFLICT DO NOTHING`,
        [swUserId],
      )

      const companyResult = await pool.query<{ id: string }>(
        `INSERT INTO public.companies (name, npi, address, city, state, zip, email_domain, status, approved_at, approved_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', now(), $8::uuid)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          SOCIAL_WORKER_USER.companyName,
          SOCIAL_WORKER_USER.companyNpi,
          SOCIAL_WORKER_USER.companyAddress,
          SOCIAL_WORKER_USER.companyCity,
          SOCIAL_WORKER_USER.companyState,
          SOCIAL_WORKER_USER.companyZip,
          SOCIAL_WORKER_USER.companyEmailDomain,
          adminUserId ?? swUserId,
        ],
      )
      const companyId = companyResult.rows[0]?.id ?? (await pool.query<{ id: string }>(
        `SELECT id FROM public.companies WHERE name = $1 LIMIT 1`,
        [SOCIAL_WORKER_USER.companyName],
      )).rows[0]?.id

      if (companyId) {
        await pool.query(
          `INSERT INTO public.social_worker_profiles
             (user_id, company_id, first_name, last_name, phone, license_number, job_title, status, approved_at, approved_by)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 'approved', now(), $8::uuid)
           ON CONFLICT (user_id) DO UPDATE SET
             company_id = EXCLUDED.company_id,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             phone = EXCLUDED.phone,
             license_number = EXCLUDED.license_number,
             job_title = EXCLUDED.job_title,
             status = 'approved',
             approved_at = COALESCE(public.social_worker_profiles.approved_at, now()),
             approved_by = COALESCE(public.social_worker_profiles.approved_by, EXCLUDED.approved_by)`,
          [
            swUserId,
            companyId,
            SOCIAL_WORKER_USER.firstName,
            SOCIAL_WORKER_USER.lastName,
            SOCIAL_WORKER_USER.phone,
            SOCIAL_WORKER_USER.licenseNumber,
            SOCIAL_WORKER_USER.jobTitle,
            adminUserId ?? swUserId,
          ],
        )
      }

      if (demoUserId) {
        await pool.query(
          `INSERT INTO public.patient_social_worker_access
             (patient_user_id, social_worker_user_id, granted_at, is_active)
           VALUES ($1::uuid, $2::uuid, now(), true)
           ON CONFLICT (patient_user_id, social_worker_user_id)
           DO UPDATE SET is_active = true, revoked_at = NULL, granted_at = now()`,
          [demoUserId, swUserId],
        )
      }
    }

    await pool.query("COMMIT")
    console.log("[setup] ✅ Local demo admin/SW roles prepared")
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => null)
    console.warn(`[setup] ⚠️  Unable to prepare local demo roles: ${(err as Error).message}`)
  } finally {
    await pool.end().catch(() => null)
  }
}

setup("create demo users and save auth state", async ({ page, request }) => {
  ensureAuthDir()

  const demoUser     = IS_REMOTE ? CLOUD_DEMO_USER     : DEMO_USER
  const reviewerUser = IS_REMOTE ? CLOUD_REVIEWER_USER : REVIEWER_USER
  const adminUser = IS_REMOTE ? CLOUD_ADMIN_USER : ADMIN_USER
  const socialWorkerUser = IS_REMOTE ? CLOUD_SOCIAL_WORKER_USER : SOCIAL_WORKER_USER

  if (IS_REMOTE) {
    // dev-register is disabled in production — accounts must exist in cloud Supabase already.
    // Use E2E_DEMO_EMAIL / E2E_DEMO_PASSWORD (and reviewer equivalents) as GitHub secrets.
    console.log(`[setup] 🌐 Cloud mode — skipping dev-register, using pre-existing accounts`)
  }

  // ── Demo / customer user ────────────────────────────────────────────────────
  if (!IS_REMOTE) await ensureUser(request, demoUser)
  await loginAndSaveState(page, demoUser, AUTH_FILE)

  // ── Reviewer / staff user ───────────────────────────────────────────────────
  if (!IS_REMOTE) await ensureUser(request, reviewerUser)
  if (!IS_REMOTE) await ensureUser(request, adminUser)
  if (!IS_REMOTE) await ensureUser(request, socialWorkerUser)
  if (!IS_REMOTE) await ensureLocalDemoRoles()

  const reviewerContext = await page.context().browser()!.newContext()
  const reviewerPage   = await reviewerContext.newPage()
  try {
    await loginAndSaveState(reviewerPage, reviewerUser, REVIEWER_AUTH_FILE)
  } finally {
    await reviewerContext.close()
  }

  const adminContext = await page.context().browser()!.newContext()
  const adminPage = await adminContext.newPage()
  try {
    await loginAndSaveState(adminPage, adminUser, ADMIN_AUTH_FILE)
  } finally {
    await adminContext.close()
  }

  const swContext = await page.context().browser()!.newContext()
  const swPage = await swContext.newPage()
  try {
    await loginAndSaveState(swPage, socialWorkerUser, SOCIAL_WORKER_AUTH_FILE)
  } finally {
    await swContext.close()
  }
})
