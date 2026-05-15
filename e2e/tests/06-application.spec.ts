/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { test, expect } from "@playwright/test"
import * as path from "path"
import { ApplicationPage } from "../pages/application.page"
import { hasSupabaseAuthState } from "../auth-state"

test.use({ storageState: path.join(__dirname, "../.auth/user.json") })
const AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const DOCUMENT_UPLOAD_FILE = path.join(__dirname, "../../public/placeholder.jpg")

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

  test("chat intake can switch into form wizard for review", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await applicationPage.assertChatModeVisible()
    await applicationPage.startFreshInChat()
    await applicationPage.switchChatToWizard()
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

  test("document upload UI shows validation progress and certificate", async ({ page }) => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    let uploadedDocument: Record<string, unknown> | null = null

    await page.route(`**/api/applications/${applicationId}/documents`, async (route) => {
      const request = route.request()
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, documents: uploadedDocument ? [uploadedDocument] : [] }),
        })
        return
      }

      if (request.method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 2_800))
        uploadedDocument = {
          id: "33333333-3333-4333-8333-333333333333",
          applicationId,
          uploadedBy: "11111111-1111-4111-8111-111111111111",
          documentType: "passport",
          requiredDocumentLabel: "Passport",
          fileName: "placeholder.jpg",
          filePath: "uploads/passport/placeholder.jpg",
          signedUrl: "https://example.test/original.jpg",
          thumbnailSignedUrl: "https://example.test/thumbnail.webp",
          pdfSignedUrl: "https://example.test/passport.pdf",
          fileSizeBytes: 1024,
          mimeType: "image/jpeg",
          documentStatus: "verified",
          validationStatus: "valid",
          validationError: null,
          validationSummary: { matchedFields: ["name", "dateOfBirth"] },
          validationCertificate: { id: "cert-passport-e2e" },
          uploadedAt: new Date().toISOString(),
          analyzedAt: new Date().toISOString(),
        }
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, document: uploadedDocument }),
        })
        return
      }

      await route.continue()
    })

    // Seed the ApplicationAssistant draft in localStorage (keyed by applicationId).
    await page.evaluate(({ key, draft }) => {
      window.localStorage.setItem(key, JSON.stringify(draft))
    }, {
      key: `healthcompass.applicationAssistant.draft.${applicationId}`,
      draft: {
        mode: "form_assistant",
        updatedAt: new Date().toISOString(),
        formData: {},
        noHouseholdMembers: true,
        noIncome: true,
        messages: [
          {
            id: "assistant-documents-ready",
            type: "upload_prompt",
            role: "assistant",
            content: "Upload supporting documents to complete your application.",
            docTypes: [
              {
                type: "passport",
                label: "Passport",
                description: "Passport photo page",
              },
            ],
          },
        ],
      },
    })

    // Put a dummy prefill payload in sessionStorage so the page renders ApplicationAssistant
    // (which restores the localStorage draft above) instead of IntakeChat.
    await page.evaluate(() => {
      sessionStorage.setItem("doc-upload-prefill", JSON.stringify({ firstName: "Test" }))
    })

    // Navigate with prefillKey — NewApplicationPageContent reads sessionStorage on mount,
    // finds the prefill data, and renders ApplicationAssistant which restores the draft.
    await page.goto(`/application/new?applicationId=${applicationId}&prefillKey=doc-upload-prefill`)
    await expect(page.getByRole("heading", { name: "Passport" })).toBeVisible({ timeout: 15_000 })

    const fileChooserPromise = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: /browse files/i }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(DOCUMENT_UPLOAD_FILE)

    await expect(page.getByText(/saving document/i)).toBeVisible({ timeout: 2_000 })
    await expect(page.getByText(/analyzing document/i)).toBeVisible({ timeout: 2_000 })
    await expect(page.getByText(/validating application data/i)).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText(/document validated/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/validation certificate issued/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /view pdf/i })).toBeVisible()
  })

  test("critical application pages avoid server 500s during draft creation", async ({ page }) => {
    const serverErrors: string[] = []
    page.on("response", (res) => {
      if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`)
    })

    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await page.waitForLoadState("load")
    await applicationPage.gotoWizardDraft(applicationId)
    await page.waitForLoadState("load")
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)

    expect(serverErrors).toHaveLength(0)
  })
})

test.describe("Application Edge Cases", () => {
  let applicationPage: ApplicationPage

  test.beforeEach(({ page }) => {
    test.skip(!hasSupabaseAuthState(AUTH_FILE), "No auth session — create a test user in the Supabase dashboard to run these tests")
    applicationPage = new ApplicationPage(page)
  })

  test("wizard shows required field error when advancing with empty name", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertWizardModeVisible()
    await applicationPage.advanceWizardToStep2()
    await applicationPage.assertWizardRequiredFieldError()
  })

  test("two-person household income checklist shows employment sections for both members", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    const applicantName = `Multi Person ${Date.now()}`

    await applicationPage.seedMultiPersonDraft(applicationId, applicantName)
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertMultiPersonIncomeChecklist()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("non-citizen applicant wizard shows immigration status fields at coverage step", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    const applicantName = `Non Citizen Applicant ${Date.now()}`

    await applicationPage.seedNonCitizenDraft(applicationId, applicantName)
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertWizardAtCoverageStep()
    await applicationPage.assertNonCitizenFieldsVisible()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("applicant needing accommodation shows accommodation section in wizard", async () => {
    await applicationPage.gotoTypeSelector()
    const applicationId = await applicationPage.selectAca3Draft()
    const applicantName = `Disability Applicant ${Date.now()}`

    await applicationPage.seedDisabilityDraft(applicationId, applicantName)
    await applicationPage.gotoWizardDraft(applicationId)
    await applicationPage.assertWizardAtCoverageStep()
    await applicationPage.assertAccommodationSectionVisible()
    await applicationPage.assertDraftVisibleOnStatusPage(applicationId)
  })

  test("expired session on a protected route shows unauthenticated state", async ({ page }) => {
    // Confirm the page loads while authenticated
    await page.goto("/customer/status")
    await expect(page).toHaveURL(/\/customer\/status/, { timeout: 15_000 })

    // Simulate session expiry by removing Supabase auth tokens from localStorage
    await page.evaluate(() => {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          localStorage.removeItem(key)
        }
      }
    })

    await page.reload()

    // The app either redirects to a login route OR shows an inline auth-required message
    // on the same page (the current behavior is "You must be signed in to continue.")
    const wasRedirected = /\/login|\/auth|\/signin/i.test(page.url())
    if (!wasRedirected) {
      await expect(
        page.getByText(/you must be signed in|sign in to continue|please sign in|not authorized/i).first(),
      ).toBeVisible({ timeout: 15_000 })
    }
  })
})
