/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import {
  buildApplicationContinueHref,
  buildApplicationHref,
  buildApplicationStartHref,
  buildRecommendedApplicationTypeHref,
} from "@/lib/applications/navigation"

describe("application navigation", () => {
  it("builds chat continuation URLs for draft resumes", () => {
    expect(buildApplicationContinueHref("app-123")).toBe("/application/new?applicationId=app-123&mode=chat")
  })

  it("builds chat start URLs for newly selected applications", () => {
    expect(buildApplicationStartHref("app-123")).toBe("/application/new?applicationId=app-123&mode=chat")
  })

  it("omits mode only when no mode is requested", () => {
    expect(buildApplicationHref("app-123")).toBe("/application/new?applicationId=app-123")
  })

  it("builds static chooser links with one type highlighted", () => {
    expect(buildRecommendedApplicationTypeHref("saca2")).toBe("/application/type?recommended=saca2")
    expect(buildRecommendedApplicationTypeHref("aca3")).toBe("/application/type?recommended=aca3")
  })
})
