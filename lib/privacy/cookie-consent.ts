/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export const COOKIE_CONSENT_COOKIE = "hc_cookie_consent"
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

export const COOKIE_CONSENT_VALUES = {
  accepted: "accepted",
  declined: "declined",
} as const

export type CookieConsentValue = typeof COOKIE_CONSENT_VALUES[keyof typeof COOKIE_CONSENT_VALUES]

export function isCookieConsentValue(value: string | undefined | null): value is CookieConsentValue {
  return value === COOKIE_CONSENT_VALUES.accepted || value === COOKIE_CONSENT_VALUES.declined
}

export function hasAnalyticsCookieConsent(value: string | undefined | null) {
  return value === COOKIE_CONSENT_VALUES.accepted
}
