/**
 * @author Bin Lee
 * @email binlee120@gmail.com
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
import { DEMO_USER, REVIEWER_USER } from "./fixtures/demo-data"
import * as fs from "fs"
import * as path from "path"

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

const AUTH_DIR        = path.join(__dirname, ".auth")
const AUTH_FILE       = path.join(AUTH_DIR, "user.json")
const REVIEWER_AUTH_FILE = path.join(AUTH_DIR, "reviewer.json")

/** Empty Playwright storage-state — lets tests run without crashing on ENOENT */
const EMPTY_STORAGE_STATE = JSON.stringify({ cookies: [], origins: [] })

function ensureAuthDir() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  // Pre-create empty state files so tests never hit ENOENT even if the setup
  // test is killed by a Playwright timeout before the catch block can run.
  if (!fs.existsSync(AUTH_FILE)) writeEmptyState(AUTH_FILE)
  if (!fs.existsSync(REVIEWER_AUTH_FILE)) writeEmptyState(REVIEWER_AUTH_FILE)
}

function writeEmptyState(filePath: string) {
  fs.writeFileSync(filePath, EMPTY_STORAGE_STATE, "utf8")
}

async function ensureUser(
  request: import("@playwright/test").APIRequestContext,
  user: typeof DEMO_USER,
): Promise<boolean> {
  try {
    const res = await request.post("/api/auth/dev-register", {
      data: {
        email:     user.email,
        password:  user.password,
        firstName: user.firstName,
        lastName:  user.lastName,
        phone:     user.phone,
      },
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
  user: typeof DEMO_USER,
  filePath: string,
): Promise<boolean> {
  try {
    await page.goto("/auth/login", { timeout: 15_000 })
    await page.fill("#email",    user.email)
    await page.fill("#password", user.password)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/customer/dashboard", { timeout: 20_000 })
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

setup("create demo users and save auth state", async ({ page, request }) => {
  ensureAuthDir()

  const demoUser     = IS_REMOTE ? CLOUD_DEMO_USER     : DEMO_USER
  const reviewerUser = IS_REMOTE ? CLOUD_REVIEWER_USER : REVIEWER_USER

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

  const reviewerContext = await page.context().browser()!.newContext()
  const reviewerPage   = await reviewerContext.newPage()
  try {
    await loginAndSaveState(reviewerPage, reviewerUser, REVIEWER_AUTH_FILE)
  } finally {
    await reviewerContext.close()
  }
})
