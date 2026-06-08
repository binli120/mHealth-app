/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import {
  COOKIE_CONSENT_VALUES,
  hasAnalyticsCookieConsent,
  isCookieConsentValue,
} from "@/lib/privacy/cookie-consent"

describe("cookie consent", () => {
  it("accepts only supported consent values", () => {
    expect(isCookieConsentValue(COOKIE_CONSENT_VALUES.accepted)).toBe(true)
    expect(isCookieConsentValue(COOKIE_CONSENT_VALUES.declined)).toBe(true)
    expect(isCookieConsentValue("")).toBe(false)
    expect(isCookieConsentValue("true")).toBe(false)
    expect(isCookieConsentValue(null)).toBe(false)
  })

  it("enables analytics only for accepted optional cookies", () => {
    expect(hasAnalyticsCookieConsent(COOKIE_CONSENT_VALUES.accepted)).toBe(true)
    expect(hasAnalyticsCookieConsent(COOKIE_CONSENT_VALUES.declined)).toBe(false)
    expect(hasAnalyticsCookieConsent(undefined)).toBe(false)
  })
})
