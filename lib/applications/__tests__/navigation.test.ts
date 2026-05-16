/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"
import {
  buildApplicationContinueHref,
  buildApplicationHref,
  buildApplicationStartHref,
} from "@/lib/applications/navigation"

describe("application navigation", () => {
  it("builds wizard continuation URLs for draft resumes", () => {
    expect(buildApplicationContinueHref("app-123")).toBe("/application/new?applicationId=app-123&mode=wizard")
  })

  it("builds chat start URLs for newly selected applications", () => {
    expect(buildApplicationStartHref("app-123")).toBe("/application/new?applicationId=app-123&mode=chat")
  })

  it("omits mode only when no mode is requested", () => {
    expect(buildApplicationHref("app-123")).toBe("/application/new?applicationId=app-123")
  })
})
