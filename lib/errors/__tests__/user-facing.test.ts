/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import { toUserFacingError } from "@/lib/errors/user-facing"

describe("toUserFacingError", () => {
  it("replaces leaked token errors with a sign-in message", () => {
    expect(toUserFacingError("AuthApiError: Invalid Refresh Token")).toBe(
      "Your sign-in session expired. Please sign in again.",
    )
  })

  it("normalizes invalid credential errors", () => {
    expect(toUserFacingError("Invalid login credentials")).toBe(
      "The email or password you entered does not match our records.",
    )
  })

  it("normalizes failed fetch errors", () => {
    expect(toUserFacingError(new TypeError("Failed to fetch"))).toBe(
      "We could not reach HealthCompass MA. Check your connection and try again.",
    )
  })

  it("keeps readable validation messages", () => {
    expect(toUserFacingError("Email is required.")).toBe("Email is required.")
  })

  it("hides database implementation details", () => {
    expect(toUserFacingError("PGRST116: relation users does not exist", "Could not load profile.")).toBe(
      "Could not load profile.",
    )
  })

  it("supports invitation-specific token guidance", () => {
    expect(toUserFacingError("invalid token", { context: "invitation" })).toBe(
      "This invitation link is invalid or expired. Ask the admin to send a new invitation.",
    )
  })

  it("supports verification-specific token guidance", () => {
    expect(toUserFacingError("Invalid token.", { context: "verification" })).toBe(
      "This verification link is invalid or expired. Please start a new scan from your desktop.",
    )
  })
})
