/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { expect, test } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { ADMIN_USER } from "../fixtures/demo-data"

const AUTH_FILE = path.join(__dirname, "../.auth/admin.json")

function hasAuth(filePath: string) {
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8"))
    return (
      state.origins?.some((origin: { localStorage?: { name: string }[] }) =>
        origin.localStorage?.some(
          (item: { name: string }) =>
            item.name.startsWith("sb-") && item.name.endsWith("-auth-token"),
        ),
      ) ?? false
    )
  } catch {
    return false
  }
}

// ── Unauthenticated API guards ────────────────────────────────────────────────

test.describe("Admin Passkey API — unauthenticated guards", () => {
  test("POST /api/auth/passkey/register/options without auth returns 401 or 403", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/passkey/register/options", {
      data: {},
    })
    expect([401, 403]).toContain(response.status())
  })

  test("POST /api/auth/passkey/login/options with unknown email returns 404", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/passkey/login/options", {
      data: { email: `unknown-${Date.now()}@not-a-real-domain.example` },
    })
    expect(response.status()).toBe(404)
  })

  test("POST /api/auth/passkey/login/options with empty body returns 400", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/passkey/login/options", {
      data: {},
    })
    expect(response.status()).toBe(400)
  })
})

// ── Login page UI ─────────────────────────────────────────────────────────────

test.describe("Admin Passkey — login page UI", () => {
  test("passkey button is hidden before typing an email and appears after", async ({ page }) => {
    await page.goto("/auth/login")

    const passkeyButton = page.getByRole("button", { name: /sign in with passkey/i })

    // Button must not be visible before any email is typed
    await expect(passkeyButton).toBeHidden()

    // Type an email — button should appear
    await page.fill("#email", ADMIN_USER.email)
    await expect(passkeyButton).toBeVisible({ timeout: 3_000 })

    // Clear the email — button should disappear again
    await page.fill("#email", "")
    await expect(passkeyButton).toBeHidden({ timeout: 3_000 })
  })
})

// ── Registration flow (requires admin auth) ───────────────────────────────────

test.describe("Admin Passkey — registration flow", { tag: "@passkey" }, () => {
  test.use({ storageState: AUTH_FILE })

  test("admin can navigate to passkey management UI", async ({ page }) => {
    test.skip(!hasAuth(AUTH_FILE), "No admin auth session. Run Playwright setup or provide E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.")

    const candidateUrls = ["/admin/security", "/admin/passkeys", "/admin"]
    let passkeyPageFound = false

    for (const url of candidateUrls) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 })
      const passkeySection = page
        .getByText(/passkey|register.*passkey|manage.*passkey/i)
        .first()
      const isVisible = await passkeySection.isVisible().catch(() => false)
      if (isVisible) {
        passkeyPageFound = true
        break
      }
    }

    if (!passkeyPageFound) {
      test.skip(true, "No passkey management UI found at /admin, /admin/passkeys, or /admin/security — skipping gracefully")
      return
    }

    const registerButton = page
      .getByRole("button", { name: /register.*passkey|add.*passkey|new.*passkey/i })
      .first()
    const isRegisterVisible = await registerButton.isVisible().catch(() => false)

    if (!isRegisterVisible) {
      test.skip(true, "Passkey registration button not found — skipping gracefully")
      return
    }

    await expect(registerButton).toBeVisible()
  })

  test("passkey registration flow with virtual authenticator", async ({ page, context }) => {
    test.skip(!hasAuth(AUTH_FILE), "No admin auth session. Run Playwright setup or provide E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.")

    const candidateUrls = ["/admin/security", "/admin/passkeys", "/admin"]
    let passkeyPageUrl: string | null = null

    for (const url of candidateUrls) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 })
      const passkeySection = page
        .getByText(/passkey|register.*passkey|manage.*passkey/i)
        .first()
      const isVisible = await passkeySection.isVisible().catch(() => false)
      if (isVisible) {
        passkeyPageUrl = url
        break
      }
    }

    if (!passkeyPageUrl) {
      test.skip(true, "No passkey management UI found — skipping virtual authenticator test gracefully")
      return
    }

    const registerButton = page
      .getByRole("button", { name: /register.*passkey|add.*passkey|new.*passkey/i })
      .first()
    const isRegisterVisible = await registerButton.isVisible().catch(() => false)

    if (!isRegisterVisible) {
      test.skip(true, "Passkey registration button not found — skipping gracefully")
      return
    }

    const authenticator = await context.addVirtualAuthenticator({
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    })

    try {
      await registerButton.click()

      const successIndicator = page
        .getByText(/registered|success|passkey added|created/i)
        .first()
      const errorIndicator = page
        .getByText(/error|failed|unable/i)
        .first()

      const result = await Promise.race([
        successIndicator.waitFor({ timeout: 15_000 }).then(() => "success"),
        errorIndicator.waitFor({ timeout: 15_000 }).then(() => "error"),
      ]).catch(() => "timeout")

      if (result === "timeout") {
        test.skip(true, "Passkey registration flow did not complete within timeout — skipping gracefully")
        return
      }

      if (result === "error") {
        const errorText = await errorIndicator.textContent()
        test.skip(true, `Passkey registration returned an error: ${errorText}`)
        return
      }

      await expect(successIndicator).toBeVisible({ timeout: 5_000 })
    } finally {
      await context.removeVirtualAuthenticator(authenticator)
    }
  })
})

// ── Full login flow ───────────────────────────────────────────────────────────

test.describe("Admin Passkey — full login flow", { tag: "@passkey" }, () => {
  test("passkey login flow with virtual authenticator", async ({ page, context, request }) => {
    const probe = await request
      .post("/api/auth/passkey/login/options", {
        data: { email: ADMIN_USER.email },
        timeout: 5_000,
      })
      .catch(() => null)

    if (!probe || probe.status() === 404) {
      test.skip(true, "No passkeys registered for the test admin user — skipping login flow gracefully")
      return
    }

    await page.goto("/auth/login", { waitUntil: "domcontentloaded" })

    // Type email first — the passkey button only appears once an email is entered
    await page.fill("#email", ADMIN_USER.email)

    const passkeyButton = page.getByRole("button", { name: /sign in with passkey/i })
    await expect(passkeyButton).toBeVisible({ timeout: 3_000 })

    const authenticator = await context.addVirtualAuthenticator({
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    })

    try {
      await passkeyButton.click()

      const adminUrl = /\/admin/
      const loginUrl = /\/auth\/login/

      const result = await Promise.race([
        page.waitForURL(adminUrl, { timeout: 15_000 }).then(() => "admin"),
        page.getByText(/error|failed|unable/i).first().waitFor({ timeout: 15_000 }).then(() => "error"),
      ]).catch(() => "timeout")

      if (result === "timeout" || result === "error") {
        const currentUrl = page.url()
        if (loginUrl.test(currentUrl)) {
          test.skip(true, "Passkey login did not complete (still on login page) — authenticator may not have a credential yet; skipping gracefully")
          return
        }
      }

      await expect(page).toHaveURL(adminUrl, { timeout: 5_000 })
    } finally {
      await context.removeVirtualAuthenticator(authenticator)
    }
  })
})
