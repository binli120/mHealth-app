/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { expect, test } from "@playwright/test"

test.describe("Public UX regressions", () => {
  test("privacy requests page exposes intake controls instead of coming-soon copy", async ({ page }) => {
    await page.goto("/privacy/requests")

    await expect(page.getByRole("heading", { name: /data subject requests/i })).toBeVisible()
    await expect(page.getByText(/coming soon/i)).toHaveCount(0)
    await expect(page.locator('form[action^="mailto:privacy@healthcompass.cloud"]')).toBeVisible()
    await expect(page.getByLabel(/full name/i)).toBeVisible()
    await expect(page.getByLabel(/^email$/i)).toBeVisible()
    await expect(page.getByLabel(/request type/i)).toBeVisible()
    await expect(page.getByLabel(/request details/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /submit privacy request/i })).toBeVisible()
  })

  test("knowledge center eagerly loads the first visible video row for LCP", async ({ page }) => {
    await page.goto("/knowledge-center")

    const videosSection = page.locator("section").filter({ hasText: /videos/i }).first()
    const videoImages = videosSection.locator("img")

    await expect(videoImages.nth(0)).toBeVisible()
    await expect(videoImages.nth(0)).toHaveAttribute("loading", "eager")
    await expect(videoImages.nth(1)).toHaveAttribute("loading", "eager")
    await expect(videoImages.nth(2)).toHaveAttribute("loading", "eager")
    await expect(videoImages.nth(3)).toHaveAttribute("loading", "lazy")
  })
})
