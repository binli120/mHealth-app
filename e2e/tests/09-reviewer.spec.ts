/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import { ReviewerPage } from "../pages/reviewer.page"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

const USER_AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const REVIEWER_AUTH_FILE = path.join(__dirname, "../.auth/reviewer.json")

// Basic smoke coverage using the demo customer user (reviewer role is enforced server-side)
test.describe("Reviewer / Staff Portal", () => {
  test.use({ storageState: path.join(__dirname, "../.auth/user.json") })
  let reviewer: ReviewerPage

  test.beforeEach(({ page }) => {
    test.skip(!hasSupabaseAuthState(USER_AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
    reviewer = new ReviewerPage(page)
  })

  test("reviewer dashboard page loads", async ({ page }) => {
    await reviewer.gotoDashboard()
    await expect(page).toHaveURL(/\/reviewer\/dashboard/)
    // May show a permission error if user lacks reviewer role — that's valid too
    await expect(
      page.getByText(/pending|case|review|dashboard|access|permission/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("reviewer cases page loads", async ({ page }) => {
    await reviewer.gotoCases()
    await expect(page).toHaveURL(/\/reviewer\/cases/)
    await expect(
      page.getByText(/case|application|status|access/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("audit trail page loads", async ({ page }) => {
    await reviewer.gotoAudit()
    await expect(page).toHaveURL(/\/reviewer\/audit/)
    await expect(
      page.getByText(/audit|history|trail|access/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("reviewer dashboard shows stats or case counts", async ({ page }) => {
    await reviewer.gotoDashboard()
    await expect(
      page.getByText(/\d+|pending|approved|flagged|rfi/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("no 500 errors on reviewer pages", async ({ page }) => {
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
    expect(serverErrors).toHaveLength(0)
  })
})

// Reviewer role-specific flows using the dedicated reviewer account
test.describe("Reviewer Case Management", () => {
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

    // Case rows are clickable cards identified by their "MH-YYYY-XXXXX" case ID
    const firstCaseEntry = page.getByText(/MH-\d{4}-[A-Z0-9]+/).first()

    if (await firstCaseEntry.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const urlBefore = page.url()
      await firstCaseEntry.click()
      // Give the UI time to respond — navigation or side-panel open
      await page.waitForTimeout(1_500)

      const navigated = page.url() !== urlBefore
      // If no URL change, a drawer/panel should have opened with decision actions
      const panelOpened = await page
        .getByRole("button", { name: /approve|deny|request.*info|rfi/i })
        .or(page.getByText(/case.*detail|review.*this.*application/i).first())
        .isVisible({ timeout: 5_000 })
        .catch(() => false)

      expect(
        navigated || panelOpened,
        `Expected case detail after click — URL: ${page.url()}`,
      ).toBeTruthy()
    } else {
      // No submitted cases yet — valid before MassHealth API integration
      await expect(
        page.getByText(/no.*case|no.*application|empty|nothing.*review/i).first(),
      ).toBeVisible({ timeout: 10_000 })
    }
  })

  test("reviewer audit trail shows timestamped events or an empty state", async ({ page }) => {
    await reviewer.gotoAudit()
    await expect(page).toHaveURL(/\/reviewer\/audit/)

    // Audit entries show timestamps like "Feb 18, 2024 - 3:45 PM" — match month names or AM/PM
    const hasTimestampedEvents = await page
      .getByText(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d{1,2}:\d{2}\s*(am|pm)/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    const hasEmptyState = await page
      .getByText(/no.*event|no.*activity|audit.*empty|nothing.*logged/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    expect(
      hasTimestampedEvents || hasEmptyState,
      "Audit trail should show timestamped events or a clear empty state",
    ).toBeTruthy()
  })

  test("reviewer case detail exposes decision dialogs", async ({ page }) => {
    await reviewer.gotoCaseDetail()
    await expect(page).toHaveURL(/\/reviewer\/case\//)
    await expect(page.getByText(/MH-2024-ABC12/i)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole("button", { name: /^approve$/i })).toBeVisible({ timeout: 8_000 })

    // Approve dialog
    await page.getByRole("button", { name: /^approve$/i }).click()
    const approveDialog = page.locator('[data-slot="dialog-content"]').last()
    await expect(approveDialog).toBeVisible({ timeout: 8_000 })
    await expect(approveDialog.getByText(/approve application/i)).toBeVisible()
    await expect(approveDialog.getByText(/program assignment/i)).toBeVisible()
    // The Cancel buttons are plain <Button>, not <DialogClose> — press Escape to close the Radix modal
    await page.keyboard.press("Escape")
    await expect(approveDialog).not.toBeVisible({ timeout: 5_000 })

    // Deny dialog
    await page.getByRole("button", { name: /^deny$/i }).click()
    const denyDialog = page.locator('[data-slot="dialog-content"]').last()
    await expect(denyDialog.getByText(/deny application/i)).toBeVisible({ timeout: 8_000 })
    await expect(denyDialog.getByText(/denial reason/i)).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(denyDialog).not.toBeVisible({ timeout: 5_000 })

    // Request Info dialog
    await page.getByRole("button", { name: /request info/i }).click()
    const requestInfoDialog = page.locator('[data-slot="dialog-content"]').last()
    await expect(requestInfoDialog.getByText(/request additional information/i)).toBeVisible({ timeout: 8_000 })
    await expect(requestInfoDialog.getByText(/required documents/i)).toBeVisible()
    await expect(requestInfoDialog.getByRole("button", { name: /send request/i })).toBeVisible()
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
