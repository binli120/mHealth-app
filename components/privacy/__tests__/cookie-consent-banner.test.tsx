/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { CookieConsentBanner } from "@/components/privacy/cookie-consent-banner"
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_VALUES,
} from "@/lib/privacy/cookie-consent"

function clearConsentCookie() {
  document.cookie = `${COOKIE_CONSENT_COOKIE}=; Max-Age=0; Path=/`
}

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    clearConsentCookie()
  })

  it("shows when no consent decision has been recorded", () => {
    render(<CookieConsentBanner />)

    expect(screen.getByRole("region", { name: "Cookie consent" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept optional cookies" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Decline optional" })).toBeInTheDocument()
  })

  it("does not show after optional cookies were accepted", () => {
    render(<CookieConsentBanner initialConsent={COOKIE_CONSENT_VALUES.accepted} />)

    expect(screen.queryByRole("region", { name: "Cookie consent" })).not.toBeInTheDocument()
  })

  it("does not show after optional cookies were declined", () => {
    render(<CookieConsentBanner initialConsent={COOKIE_CONSENT_VALUES.declined} />)

    expect(screen.queryByRole("region", { name: "Cookie consent" })).not.toBeInTheDocument()
  })

  it("records a rejection and hides immediately", async () => {
    const user = userEvent.setup()
    render(<CookieConsentBanner />)

    await user.click(screen.getByRole("button", { name: "Decline optional" }))

    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE}=declined`)
    expect(screen.queryByRole("region", { name: "Cookie consent" })).not.toBeInTheDocument()
  })
})
