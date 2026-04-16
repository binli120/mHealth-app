/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

/**
 * Full Happy Path Demo Tour
 *
 * Designed for investor/customer demos. Runs in headed mode with slow motion.
 * Covers every major feature in a single continuous narrative flow:
 *
 *   Landing → Prescreener → Register → Dashboard → Benefit Stack
 *   → Application → Status → Appeal Assistant → Profile → Reviewer
 *
 * Run with: pnpm demo
 */

import { test, expect } from "@playwright/test"
import { DEMO_USER } from "../fixtures/demo-data"

// Demo tour runs serially — each test builds on the previous page state
test.describe.serial("Full Demo Tour", () => {
  test("1 · Landing page — product overview", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
    ).toBeVisible({ timeout: 10_000 })
    // Let viewers read the hero and absorb the product pitch
    await page.waitForTimeout(4000)
  })

  test("2 · Eligibility Prescreener — quick check, no login", async ({ page }) => {
    await page.goto("/prescreener")
    await page.waitForTimeout(2000) // Let viewers read the intro message

    // Step 1: State — quick reply button
    const massBtn = page.getByRole("button", { name: "Massachusetts" })
    await massBtn.waitFor({ state: "visible", timeout: 10_000 })
    await massBtn.click()
    await page.waitForTimeout(1500)

    // Step 2: Age group — quick reply
    const ageBtn = page.getByRole("button", { name: "27–64 years" })
    await ageBtn.waitFor({ state: "visible", timeout: 8_000 })
    await ageBtn.click()
    await page.waitForTimeout(1500)

    // Step 3: Pregnancy check
    const pregnantNo = page.getByRole("button", { name: "No" }).first()
    await pregnantNo.waitFor({ state: "visible", timeout: 8_000 })
    await pregnantNo.click()
    await page.waitForTimeout(1500)

    // Step 4: Household size — number input (role=spinbutton)
    const hhInput = page.getByRole("spinbutton").last()
    await hhInput.waitFor({ state: "visible", timeout: 8_000 })
    await hhInput.fill("3")
    await page.waitForTimeout(800)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(1500)

    // Step 5: Annual income — currency input
    const incomeInput = page.getByRole("spinbutton").last()
    await incomeInput.waitFor({ state: "visible", timeout: 8_000 })
    await incomeInput.fill("36000")
    await page.waitForTimeout(800)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(1500)

    // Step 6: Citizenship
    const citizenBtn = page.getByRole("button", { name: "U.S. Citizen" })
    await citizenBtn.waitFor({ state: "visible", timeout: 8_000 })
    await citizenBtn.click()
    await page.waitForTimeout(1500)

    // Step 7: Disability
    const disabilityNo = page.getByRole("button", { name: "No" }).first()
    await disabilityNo.waitFor({ state: "visible", timeout: 8_000 })
    await disabilityNo.click()
    await page.waitForTimeout(1500)

    // Step 8: Employer insurance
    const employerNo = page.getByRole("button", { name: /No \/ Not applicable/ })
    await employerNo.waitFor({ state: "visible", timeout: 8_000 })
    await employerNo.click()
    await page.waitForTimeout(2000)

    // Results — let viewers read the eligibility outcome
    await expect(
      page.getByText(/eligible|pre-screening complete/i).first(),
    ).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(5000)
  })

  test("3 · Sign In — as demo user", async ({ page, request }) => {
    // Ensure the demo user exists. Skip if dev-register is unavailable
    // (Supabase not running) so the demo doesn't hang on a 15s timeout.
    const res = await request
      .post("/api/auth/dev-register", {
        data: {
          email:     DEMO_USER.email,
          password:  DEMO_USER.password,
          firstName: DEMO_USER.firstName,
          lastName:  DEMO_USER.lastName,
          phone:     DEMO_USER.phone,
        },
        timeout: 8_000,
      })
      .catch(() => null)
    const body = (await res?.json().catch(() => ({}))) ?? {}
    const canLogin =
      res?.ok() ||
      (body as { ok?: boolean }).ok === true ||
      (body as { error?: string }).error === "already_exists"

    if (!canLogin) {
      test.skip(true, "dev-register unavailable — cloud Supabase mode does not support programmatic user creation; create the demo user manually in the Supabase dashboard")
      return
    }

    await page.goto("/auth/login")
    await page.waitForTimeout(1500)
    await page.fill("#email", DEMO_USER.email)
    await page.waitForTimeout(600)
    await page.fill("#password", DEMO_USER.password)
    await page.waitForTimeout(600)
    await page.click('button[type="submit"]')
    await page.waitForURL("**/customer/dashboard", { timeout: 15_000 })
    await page.waitForTimeout(3000)
  })

  test("4 · Dashboard — feature overview", async ({ page }) => {
    await page.goto("/customer/dashboard")
    await expect(
      page.getByText(/application|benefit|dashboard/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    // Scroll slowly so viewers can see all dashboard cards
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }))
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }))
    await page.waitForTimeout(2000)
  })

  test("5 · Benefit Stack — multi-program eligibility", async ({ page }) => {
    await page.goto("/benefit-stack")
    await expect(
      page.getByText(/benefit|program|family|household/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    // Fill wizard fields
    const householdInput = page.getByLabel(/household size|number of people/i)
    if (await householdInput.isVisible()) {
      await householdInput.fill("3")
      await page.waitForTimeout(800)
    }
    const incomeInput = page.getByLabel(/annual income|yearly income/i)
    if (await incomeInput.isVisible()) {
      await incomeInput.fill("42000")
      await page.waitForTimeout(800)
    }
    const monthlyInput = page.getByLabel(/monthly income/i)
    if (await monthlyInput.isVisible()) {
      await monthlyInput.fill("3500")
      await page.waitForTimeout(800)
    }

    // Step through wizard — exclude Next.js dev tools button (data-next-mark)
    for (let i = 0; i < 5; i++) {
      const nextBtn = page.locator('button[data-slot="button"]').filter({ hasText: /^next$|^continue$/i }).first()
      if (await nextBtn.isVisible()) {
        await nextBtn.click()
        await page.waitForTimeout(1500)
      } else {
        break
      }
    }

    const submitBtn = page.getByRole("button", { name: /submit|check|evaluate|see.*benefit/i })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
    }

    await expect(
      page.getByText(/masshealth|snap|eitc|benefit/i).first(),
    ).toBeVisible({ timeout: 30_000 })
    // Scroll through results so viewers can see all programs
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }))
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: "smooth" }))
    await page.waitForTimeout(3000)
  })

  test("6 · Application — start a new application", async ({ page }) => {
    await page.goto("/application/type")
    await expect(
      page.getByText(/application|type|new|renewal/i).first(),
    ).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(3000)

    await page.goto("/application/new")
    await expect(
      page.getByText(/application|intake|chat|form/i).first(),
    ).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(3000)
  })

  test("7 · Application Status — tracking applications", async ({ page }) => {
    await page.goto("/customer/status")
    await expect(
      page.getByText(/application|status|case/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(4000)
  })

  test("8 · Appeal Assistant — AI-powered appeal help", async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto("/appeal-assistant")
    await expect(
      page.getByText(/Appeal Your MassHealth Denial/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    // Open the Radix Select dropdown for denial reason
    const reasonTrigger = page.getByRole("combobox").first()
    if (await reasonTrigger.isVisible()) {
      await reasonTrigger.click()
      await page.waitForTimeout(800)
      // Prefer "Income exceeds eligibility limit"; fall back to the first option
      const incomeOption = page.getByRole("option", { name: /income exceeds/i })
      const firstOption  = page.getByRole("option").first()
      if (await incomeOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await incomeOption.click()
      } else if (await firstOption.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await firstOption.click()
      }
      await page.waitForTimeout(1200)
    }

    // Fill the optional additional details textarea
    const textarea = page.locator("textarea").first()
    if (await textarea.isVisible()) {
      await textarea.fill(
        "My employer submitted incorrect W-2 data. Actual gross income was $38,000 — well below the MassHealth limit for a household of 3.",
      )
      await page.waitForTimeout(1500)
    }

    // Click "Analyze My Denial" — then show the AI loading state and move on
    // (Ollama can take 60 s+ locally; the demo just needs to show it working)
    const submitBtn = page.getByRole("button", { name: /analyze.*denial/i })
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click()
      // Show the skeleton loader so viewers understand AI is working
      await page.waitForTimeout(5000)
    }
  })

  test("9 · User Profile — manage account", async ({ page }) => {
    await page.goto("/customer/profile")
    await expect(
      page.getByText(/profile|personal|settings/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2000)
    // Click through a couple of tabs to show the breadth of the profile
    const settingsTab = page.getByRole("button", { name: /settings/i })
      .or(page.getByRole("link", { name: /settings/i })).first()
    if (await settingsTab.isVisible()) {
      await settingsTab.click()
      await page.waitForTimeout(2000)
    }
    const notifTab = page.getByRole("button", { name: /notification/i })
      .or(page.getByRole("link", { name: /notification/i })).first()
    if (await notifTab.isVisible()) {
      await notifTab.click()
      await page.waitForTimeout(2000)
    }
  })

  test("10 · Reviewer Portal — staff case management", async ({ page }) => {
    await page.goto("/reviewer/dashboard")
    await expect(
      page.getByText(/case|review|pending|dashboard|access/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    await page.goto("/reviewer/cases")
    await expect(
      page.getByText(/case|application|status|access/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)

    await page.goto("/reviewer/audit")
    await expect(
      page.getByText(/audit|history|trail|access/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3000)
  })
})
