/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import { ReviewerPage } from "../pages/reviewer.page"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

const USER_AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const REVIEWER_AUTH_FILE = path.join(__dirname, "../.auth/reviewer.json")

// Applicant accounts must not be able to read reviewer pages or server-rendered reviewer data.
test.describe("Reviewer / Staff Portal access control", () => {
  test.use({ storageState: path.join(__dirname, "../.auth/user.json") })
  let reviewer: ReviewerPage

  test.beforeEach(({ page }) => {
    test.skip(!hasSupabaseAuthState(USER_AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
    reviewer = new ReviewerPage(page)
  })

  test("applicant is redirected away from reviewer dashboard", async ({ page }) => {
    await reviewer.gotoDashboard()
    await expect(page).toHaveURL(/\/customer\/dashboard|\/auth\/login/, { timeout: 15_000 })
    await expect(page.getByText(/reviewer dashboard/i)).not.toBeVisible()
  })

  test("applicant is redirected away from reviewer cases", async ({ page }) => {
    await reviewer.gotoCases()
    await expect(page).toHaveURL(/\/customer\/dashboard|\/auth\/login/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: /all cases/i })).not.toBeVisible()
  })

  test("applicant is redirected away from reviewer audit", async ({ page }) => {
    await reviewer.gotoAudit()
    await expect(page).toHaveURL(/\/customer\/dashboard|\/auth\/login/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: /audit log/i })).not.toBeVisible()
  })

  test("non-reviewer redirects do not produce API 500s", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/") && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    for (const url of ["/reviewer/dashboard", "/reviewer/cases", "/reviewer/audit"]) {
      await page.goto(url)
      await page.waitForLoadState("load")
      await expect(page).toHaveURL(/\/customer\/dashboard|\/auth\/login/, { timeout: 15_000 })
    }
    expect(serverErrors).toHaveLength(0)
  })
})

// Reviewer role-specific flows using the dedicated reviewer account
test.describe("Reviewer Case Management", () => {
  test.describe.configure({ mode: "serial" })
  test.use({ storageState: path.join(__dirname, "../.auth/reviewer.json") })
  let reviewer: ReviewerPage

  test.beforeEach(({ page }) => {
    test.skip(!hasSupabaseAuthState(REVIEWER_AUTH_FILE), "No reviewer auth session — run global.setup.ts once to create the reviewer account")
    reviewer = new ReviewerPage(page)
  })

  test("reviewer cases list renders with correct page structure", async ({ page }) => {
    await reviewer.gotoCases()
    await expect(page).toHaveURL(/\/reviewer\/cases/)
    // Either a list of cases or an empty state is a valid outcome
    await expect(
      page.getByText(/case|application|no.*application|no.*case|pending review/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("reviewer can navigate to a case detail if cases exist", async ({ page }) => {
    await reviewer.gotoCases()
    await expect(page).toHaveURL(/\/reviewer\/cases/)

    const casesContent = page.getByRole("main")
    await expect(casesContent).toContainText(/showing \d+ of \d+ cases|no cases match this view/i, {
      timeout: 15_000,
    })

    const caseLinks = casesContent.locator('a[href^="/reviewer/case/"]')
    const caseLinkCount = await caseLinks.count()

    if (caseLinkCount > 0) {
      const firstCaseEntry = caseLinks.first()
      const targetHref = await firstCaseEntry.getAttribute("href")

      expect(targetHref).toMatch(/^\/reviewer\/case\/[0-9a-f-]+$/i)
      await firstCaseEntry.scrollIntoViewIfNeeded()
      await firstCaseEntry.click()
      await expect(page).toHaveURL(/\/reviewer\/case\/[0-9a-f-]+/)
      await expect(page.getByRole("main")).toContainText(/documents|extracted data|decision/i, {
        timeout: 15_000,
      })
    } else {
      await expect(casesContent).toContainText(/no cases match this view|no.*application|empty|nothing.*review/i)
    }
  })

  test("reviewer audit trail shows timestamped events or an empty state", async ({ page }) => {
    await reviewer.gotoAudit()
    await expect(page).toHaveURL(/\/reviewer\/audit/)

    const auditContent = page.getByRole("main")
    const auditText = await auditContent.innerText({ timeout: 5_000 })

    // Audit entries show timestamps like "Feb 18, 2024 - 3:45 PM" — match month names or AM/PM
    const hasTimestampedEvents =
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d{1,2}:\d{2}\s*(am|pm)/i.test(auditText)

    const hasEmptyState = /no.*event|no.*activity|audit.*empty|nothing.*logged/i.test(auditText)

    expect(
      hasTimestampedEvents || hasEmptyState,
      "Audit trail should show timestamped events or a clear empty state",
    ).toBeTruthy()
  })

  test("reviewer case detail exposes decision dialogs", async ({ page }) => {
    await reviewer.gotoCases()
    await expect(page).toHaveURL(/\/reviewer\/cases/)
    const firstCaseEntry = page.locator('a[href^="/reviewer/case/"]').first()
    test.skip(
      !(await firstCaseEntry.isVisible({ timeout: 5_000 }).catch(() => false)),
      "No reviewer cases exist in this environment.",
    )

    await firstCaseEntry.click()
    await expect(page).toHaveURL(/\/reviewer\/case\//)
    await expect(page.getByRole("button", { name: /^approve$/i })).toBeVisible({ timeout: 8_000 })

    // Approve dialog
    const approveButton = page.getByRole("button", { name: /^approve$/i })
    if (await approveButton.isEnabled()) {
      await approveButton.click()
      const approveDialog = page.locator('[data-slot="dialog-content"]').last()
      await expect(approveDialog).toBeVisible({ timeout: 8_000 })
      await expect(approveDialog.getByText(/approve application/i)).toBeVisible()
      await expect(approveDialog.getByText(/program assignment/i)).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(approveDialog).not.toBeVisible({ timeout: 5_000 })
    }

    // Deny dialog
    const denyButton = page.getByRole("button", { name: /^deny$/i })
    if (await denyButton.isEnabled()) {
      await denyButton.click()
      const denyDialog = page.locator('[data-slot="dialog-content"]').last()
      await expect(denyDialog.getByText(/deny application/i)).toBeVisible({ timeout: 8_000 })
      await expect(denyDialog.getByText(/denial reason/i).first()).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(denyDialog).not.toBeVisible({ timeout: 5_000 })
    }

    // Request Info dialog
    const requestInfoButton = page.getByRole("button", { name: /request info/i })
    if (await requestInfoButton.isEnabled()) {
      await requestInfoButton.click()
      const requestInfoDialog = page.locator('[data-slot="dialog-content"]').last()
      await expect(requestInfoDialog.getByText(/request additional information/i)).toBeVisible({ timeout: 8_000 })
      await expect(requestInfoDialog.getByText(/message/i)).toBeVisible()
      await expect(requestInfoDialog.getByRole("button", { name: /send request/i })).toBeVisible()
    }
  })

  test("reviewer dashboard stats section renders without errors", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/") && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })

    await reviewer.gotoDashboard()
    await page.waitForLoadState("load")

    // Stats section: some combination of counts, labels, or status indicators
    await expect(
      page.getByText(/pending|approved|flagged|rfi|\d+ case|\d+ application/i).first(),
    ).toBeVisible({ timeout: 15_000 })

    expect(serverErrors, `API 500s: ${serverErrors.join(", ")}`).toHaveLength(0)
  })

  test("no 500 errors on reviewer portal when using reviewer role", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.url().includes("/api/") && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    for (const url of ["/reviewer/dashboard", "/reviewer/cases", "/reviewer/audit"]) {
      await page.goto(url)
      await page.waitForLoadState("load")
    }
    expect(serverErrors, `API 500s: ${serverErrors.join(", ")}`).toHaveLength(0)
  })
})
