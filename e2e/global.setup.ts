/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { test as setup, expect } from "@playwright/test"
import { DEMO_USER, REVIEWER_USER } from "./fixtures/demo-data"
import * as fs from "fs"
import * as path from "path"

const AUTH_FILE = path.join(__dirname, ".auth/user.json")
const REVIEWER_AUTH_FILE = path.join(__dirname, ".auth/reviewer.json")

async function ensureUser(
  request: import("@playwright/test").APIRequestContext,
  user: typeof DEMO_USER,
) {
  const res = await request.post("/api/auth/dev-register", {
    data: {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    },
  })
  // ok=true means created, ok=false may mean already exists — both are fine
  const body = await res.json().catch(() => ({}))
  return body
}

setup("create demo users and save auth state", async ({ page, request }) => {
  // Ensure auth dir exists
  fs.mkdirSync(path.join(__dirname, ".auth"), { recursive: true })

  // ── Demo / customer user ──────────────────────────────────────────────────
  await ensureUser(request, DEMO_USER)

  await page.goto("/auth/login")
  await page.fill("#email", DEMO_USER.email)
  await page.fill("#password", DEMO_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/customer/dashboard", { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILE })

  // ── Reviewer / staff user ─────────────────────────────────────────────────
  await ensureUser(request, REVIEWER_USER)

  // Open a fresh context for reviewer
  const reviewerContext = await page.context().browser()!.newContext()
  const reviewerPage = await reviewerContext.newPage()
  await reviewerPage.goto("/auth/login")
  await reviewerPage.fill("#email", REVIEWER_USER.email)
  await reviewerPage.fill("#password", REVIEWER_USER.password)
  await reviewerPage.click('button[type="submit"]')
  // Reviewer may land on dashboard (no reviewer-specific login flow yet)
  await reviewerPage.waitForURL("**/customer/dashboard", { timeout: 15_000 })
  await reviewerContext.storageState({ path: REVIEWER_AUTH_FILE })
  await reviewerContext.close()
})
