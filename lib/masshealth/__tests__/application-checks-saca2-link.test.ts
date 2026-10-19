/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { describe, expect, it } from "vitest"
import { runApplicationChecks } from "@/lib/masshealth/application-checks"

const data = (dob: string) => ({
  contact: { p1_name: "", p1_dob: dob },
  persons: [{ identity: {}, ssn: {}, coverage: { applying_for_coverage: "yes" }, income: {} }],
})

describe("application checks: SACA-2 link on the senior warning", () => {
  it("links 65+ applicants to the SACA-2 chooser", () => {
    const senior = runApplicationChecks(data("01/15/1940")).find((r) => r.id === "age.0.senior")
    expect(senior).toMatchObject({ actionHref: "/application/type?recommended=saca2", actionLabel: "Start a SACA-2 application" })
  })

  it("adds no link to other age checks", () => {
    const minor = runApplicationChecks(data("01/15/2015")).find((r) => r.id === "age.0.minor")
    expect(minor).toBeDefined()
    expect(minor?.actionHref).toBeUndefined()
  })
})
