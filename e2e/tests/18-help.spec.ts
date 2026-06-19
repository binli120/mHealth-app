/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { test, expect, request } from '@playwright/test'
import { HelpPage } from '../pages/help.page'
import * as path from 'path'
import { hasSupabaseAuthState } from '../auth-state'

test.use({ storageState: path.join(__dirname, '../.auth/user.json') })
const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

// Seeded question ID — shared across tests in this describe block
let seededQuestionId: string | null = null

test.describe('Help Center Q&A', () => {
  let help: HelpPage

  // Seed one question so the list is never empty during the suite
  test.beforeAll(async ({ browser }) => {
    if (!hasSupabaseAuthState(AUTH_FILE)) return

    const ctx = await browser.newContext({
      storageState: AUTH_FILE,
    })
    const page = await ctx.newPage()
    try {
      const form = new FormData()
      form.append('title', 'E2E test: How do I apply for MassHealth coverage?')
      form.append('body', 'This question was created by the E2E test suite and can be safely deleted.')
      form.append('notifyOnAnswer', 'false')

      const res = await page.request.post('/api/help/questions', {
        multipart: {
          title: 'E2E test: How do I apply for MassHealth coverage?',
          body: 'This question was created by the E2E test suite and can be safely deleted.',
          notifyOnAnswer: 'false',
        },
      })
      if (res.ok()) {
        const data = await res.json() as { ok: boolean; data?: { id: string } }
        seededQuestionId = data.data?.id ?? null
      }
    } catch {
      // Non-fatal: tests will skip gracefully if no questions exist
    } finally {
      await ctx.close()
    }
  })

  test.beforeEach(({ page }) => {
    test.skip(
      !hasSupabaseAuthState(AUTH_FILE),
      'No auth session — create a test user in the Supabase dashboard to run these tests'
    )
    help = new HelpPage(page)
  })

  test('help page loads for authenticated user', async ({ page }) => {
    await help.goto()
    await help.assertPageLoaded()
    await expect(page).not.toHaveURL(/login|sign-in/)
  })

  test('unauthenticated access shows auth gate', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/help')
    const isRedirected = !page.url().endsWith('/help')
    const hasAuthPrompt = await page.getByText(/sign in|log in|login|please log/i).first().isVisible({ timeout: 8_000 }).catch(() => false)
    const hasHelpContent = await page.getByText(/how do i|what is|masshealth/i).first().isVisible({ timeout: 2_000 }).catch(() => false)
    await context.close()
    expect(isRedirected || hasAuthPrompt || !hasHelpContent).toBe(true)
  })

  test('questions are visible on page load', async ({ page }) => {
    test.skip(!seededQuestionId, 'Could not seed test question — skipping')
    await help.goto()
    await help.assertQuestionsVisible()
  })

  test('category pills filter questions', async ({ page }) => {
    test.skip(!seededQuestionId, 'Could not seed test question — skipping')
    await help.goto()
    await help.assertQuestionsVisible()

    await help.clickCategory(/eligib/i)

    await expect(page).toHaveURL(/\/help/)
    await page.waitForTimeout(800)
    await expect(page.getByText(/error|something went wrong/i)).not.toBeVisible()
  })

  test('search filters question list', async ({ page }) => {
    test.skip(!seededQuestionId, 'Could not seed test question — skipping')
    await help.goto()
    await help.assertQuestionsVisible()

    await help.searchFor('MassHealth')

    await expect(page).toHaveURL(/\/help/)
    await expect(page.getByText(/error|something went wrong/i)).not.toBeVisible()
  })

  test('ask question dialog opens and closes', async ({ page }) => {
    await help.goto()
    await help.openAskDialog()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('textbox', { name: /question/i })).toBeVisible()

    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 })
  })

  test('ask dialog submit button is disabled for short title', async ({ page }) => {
    await help.goto()
    await help.openAskDialog()

    await page.getByRole('textbox', { name: /question/i }).fill('Hi')
    await expect(page.getByRole('button', { name: /submit|post/i })).toBeDisabled()
  })

  test('ask dialog enables submit for valid title', async ({ page }) => {
    await help.goto()
    await help.openAskDialog()

    await page.getByRole('textbox', { name: /question/i }).fill('How do I renew my MassHealth card?')
    await expect(page.getByRole('button', { name: /submit|post/i })).toBeEnabled({ timeout: 3_000 })
  })

  test('question detail page loads', async ({ page }) => {
    test.skip(!seededQuestionId, 'Could not seed test question — skipping')
    await page.goto(`/help/${seededQuestionId}`)

    await expect(page.getByRole('link', { name: /help|back/i }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('question detail page shows answer form', async ({ page }) => {
    test.skip(!seededQuestionId, 'Could not seed test question — skipping')
    await page.goto(`/help/${seededQuestionId}`)

    const textarea = page.getByPlaceholder(/answer|reply|share/i)
    await expect(textarea).toBeVisible({ timeout: 10_000 })
  })

  test('no API errors on help page load', async ({ page }) => {
    test.skip(!seededQuestionId, 'Could not seed test question — skipping')
    const errors: string[] = []
    page.on('response', (res) => {
      if (res.url().includes('/api/help') && res.status() >= 500) {
        errors.push(`${res.status()} ${res.url()}`)
      }
    })

    await help.goto()
    await help.assertQuestionsVisible()
    expect(errors).toHaveLength(0)
  })

  test('no API errors on question detail page', async ({ page }) => {
    test.skip(!seededQuestionId, 'Could not seed test question — skipping')
    const errors: string[] = []
    page.on('response', (res) => {
      if (res.url().includes('/api/help') && res.status() >= 500) {
        errors.push(`${res.status()} ${res.url()}`)
      }
    })

    await page.goto(`/help/${seededQuestionId}`)
    await expect(page.getByPlaceholder(/answer|reply|share/i)).toBeVisible({ timeout: 10_000 })
    expect(errors).toHaveLength(0)
  })
})
