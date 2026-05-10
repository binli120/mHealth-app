/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"
import { DEMO_USER } from "../fixtures/demo-data"

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const TEST_USER = {
  ...DEMO_USER,
  email: process.env.E2E_DEMO_EMAIL ?? DEMO_USER.email,
  password: process.env.E2E_DEMO_PASSWORD ?? DEMO_USER.password,
}

test.use({ storageState: AUTH_FILE })

function readSupabaseAuthStorage() {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8")) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>
  }

  return state.origins
    ?.flatMap((origin) => origin.localStorage ?? [])
    .filter((item) => item.name.startsWith("sb-") && item.name.endsWith("-auth-token")) ?? []
}

async function seedSupabaseAuthStorage(page: Page) {
  const authEntries = readSupabaseAuthStorage()

  await page.addInitScript((entries: Array<{ name: string; value: string }>) => {
    for (const entry of entries) {
      window.localStorage.setItem(entry.name, entry.value)
    }
  }, authEntries)
}

async function gotoAuthenticatedMassHealthAppeals(page: Page) {
  await page.goto("/masshealth-appeals")

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const state = await Promise.race([
      page.getByText(/^Denial Category/).waitFor({ state: "visible", timeout: 15_000 }).then(() => "ready" as const),
      page.waitForURL(/\/auth\/login/, { timeout: 15_000 }).then(() => "login" as const),
    ]).catch(() => (/\/auth\/login/.test(page.url()) ? "login" as const : "timeout" as const))

    if (state === "ready") return
    if (state !== "login") throw new Error("MassHealth appeals did not render the category selector or redirect to login.")

    await page.fill("#email", TEST_USER.email)
    await page.fill("#password", TEST_USER.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/masshealth-appeals(?:[?#].*)?$/, { timeout: 20_000 })
  }
}

test.describe("Authenticated UX regressions", () => {
  test.beforeEach(() => {
    test.skip(
      !hasSupabaseAuthState(AUTH_FILE),
      "No auth session — create a test user in the Supabase dashboard to run these tests",
    )
  })

  test("MassHealth appeals shows fallback categories when the category service is degraded", async ({ page }) => {
    await seedSupabaseAuthStorage(page)
    await page.route("**/api/user-profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, profile: null }),
      })
    })
    await page.route("**/api/masshealth/appeals/categories", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          degraded: true,
          warning: "Using built-in appeal categories while the analysis service is unavailable.",
          categories: [
            {
              code: "income_exceeds_limit",
              label: "Income exceeds eligibility limit",
              description: "Income was counted above the program limit.",
            },
          ],
        }),
      })
    })

    await gotoAuthenticatedMassHealthAppeals(page)

    await expect(page.getByText(/^Denial Category/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/using built-in appeal categories/i)).toBeVisible()

    await page.getByRole("combobox", { name: /denial category/i }).click()
    await expect(page.getByRole("option", { name: /income exceeds eligibility limit/i })).toBeVisible()
  })

  test("new application does not fetch or autosave a greeting-only generated draft", async ({ page }) => {
    const draftRequests: string[] = []

    await seedSupabaseAuthStorage(page)
    await page.addInitScript(() => {
      window.localStorage.removeItem("healthcompass.applicationAssistant.activeApplicationId")
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index)
        if (key?.startsWith("healthcompass.applicationAssistant.draft.")) {
          window.localStorage.removeItem(key)
        }
      }
    })

    page.on("request", (request) => {
      if (/\/api\/applications\/[^/]+\/draft(?:\?|$)/.test(request.url())) {
        draftRequests.push(`${request.method()} ${request.url()}`)
      }
    })

    await page.goto("/application/new")

    await expect(page.getByRole("heading", { name: /new application/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("tab", { name: /compass/i })).toBeVisible()
    await page.waitForTimeout(1_500)

    expect(draftRequests.filter((entry) => /^(GET|PUT) /.test(entry))).toEqual([])
  })
})
