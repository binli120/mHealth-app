/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import * as path from "path"
import { ApplicationPage } from "../pages/application.page"
import { hasSupabaseAuthState } from "../auth-state"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })
const AUTH_FILE = path.join(__dirname, "../.auth/user.json")

test.describe("Application Flow", () => {
  let applicationPage: ApplicationPage

  test.beforeEach(({ page }) => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
    applicationPage = new ApplicationPage(page)
  })

  test("selecting an application type creates a draft and opens AI assistant mode", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await applicationPage.assertChatModeVisible()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("chat intake path can start fresh and keep the draft reachable", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await applicationPage.assertChatModeVisible()
    await applicationPage.startFreshInChat()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("form wizard mode opens for an existing application draft", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertWizardModeVisible()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("wizard draft survives page refresh", async ({ page }) => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertWizardModeVisible()
    await applicationPage.advanceWizardToStep2()

    const applicantName = `Maria Santos Refresh ${Date.now()}`
    await applicationPage.fillPrimaryApplicantName(applicantName)
    await applicationPage.waitForWizardDraftNamePersisted(applicationId, applicantName)

    await page.reload()
    await applicationPage.assertWizardModeVisible()
    await applicationPage.advanceWizardToStep2()
    await applicationPage.assertPrimaryApplicantNameValue(applicantName)
  })

  test("wizard draft can generate a review PDF and expose download to the user", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    const applicantName = `Maria Santos PDF ${Date.now()}`

    await applicationPage.seedPdfReadyDraft(applicationId, applicantName)
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertPdfPreviewReady()
    await applicationPage.downloadPdfFromReviewStep()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("wizard income evidence checklist accepts an uploaded document", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    const applicantName = `Maria Santos Evidence ${Date.now()}`

    await applicationPage.seedIncomeEvidenceDraft(applicationId, applicantName)
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertIncomeChecklistReady()
    await applicationPage.uploadIncomeEvidenceDocument()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("critical application pages avoid server 500s during draft creation", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`)
    })

    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await page.waitForLoadState("networkidle")
    await applicationPage.gotoWizardDraft(applicationId)
    await page.waitForLoadState("networkidle")
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)

    expect(serverErrors).toHaveLength(0)
  })
})
