/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  SACA2_SCREENING_LABEL,
  effectiveVerdict,
  evaluateSaca2Eligibility,
} from "@/lib/masshealth/saca2/eligibility-engine"
import { SACA2_RULE_POLICY, type Saca2RulePolicy } from "@/lib/masshealth/saca2/eligibility/policy"
import { SACA2_RULE_IDS } from "@/lib/masshealth/saca2/eligibility/types"
import { SACA2_FIGURES } from "@/lib/masshealth/saca2/figures-2026"
import type { Saca2Answers } from "@/lib/masshealth/saca2/types"
import {
  completeFacilityCouple,
  completeHomeWithAllSupplements,
  completeRichHousehold,
  completeSingleSenior,
} from "./complete-answers"

const ON = new Date("2026-10-13T12:00:00Z")
const ALL_CONFIRMED = Object.fromEntries(
  SACA2_RULE_IDS.map((id) => [id, { ...SACA2_RULE_POLICY[id], confirmed: true }]),
) as Saca2RulePolicy
const codes = (r: { findings: Array<{ code: string }> }) => r.findings.map((f) => f.code)

afterEach(() => vi.restoreAllMocks())

describe("evaluateSaca2Eligibility: gating and status", () => {
  it("as shipped, a clean single senior is NEEDS_REVIEW because rules 3-7 are unconfirmed", () => {
    const r = evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON)
    expect(r.status).toBe("NEEDS_REVIEW")
    expect(r.screening_label).toBe(SACA2_SCREENING_LABEL)
    expect(r.rule_results.map((x) => x.id)).toEqual([...SACA2_RULE_IDS])
    const assets = r.rules.find((x) => x.id === "SACA2_R3_ASSETS")
    expect(assets).toMatchObject({ confirmed: false, verdict: "pass", effective_verdict: "review" })
    expect(r.rule_results.find((x) => x.id === "SACA2_R3_ASSETS")).toMatchObject({ status: "warning" })
    expect(r.rule_results.find((x) => x.id === "SACA2_R3_ASSETS")?.message).toMatch(/not yet been confirmed/)
    expect(r.rules.find((x) => x.id === "SACA2_R1_RESIDENCY_ROUTE")).toMatchObject({ confirmed: true, effective_verdict: "pass" })
    expect(codes(r)).toContain("SACA2_RULES_UNCONFIRMED")
  })

  it("marks every rule with the registry's confirmed flag", () => {
    const r = evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON)
    for (const rule of r.rules) expect(rule.confirmed).toBe(SACA2_RULE_POLICY[rule.id].confirmed)
  })

  it("with every rule confirmed the same answers are LIKELY_ELIGIBLE", () => {
    expect(evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_ELIGIBLE")
  })

  it("never lets an unconfirmed fail become LIKELY_INELIGIBLE", () => {
    const a = completeSingleSenior()
    a.assets.gates.bankAccounts = "yes"
    a.assets.bankAccounts = [{ ownerName: "Edna Testcase", accountType: "savings", institution: "Example Bank", accountNumber: "1", currentBalance: 9000, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null }]
    expect(evaluateSaca2Eligibility(a, SACA2_FIGURES, ON).status).toBe("NEEDS_REVIEW")
    expect(evaluateSaca2Eligibility(a, SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_INELIGIBLE")
  })

  it("uses the figures it is given, not the module constant", () => {
    const a = completeSingleSenior()
    a.assets.gates.bankAccounts = "yes"
    a.assets.bankAccounts = [{ ownerName: "Edna Testcase", accountType: "savings", institution: "Example Bank", accountNumber: "1", currentBalance: 1500, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null }]
    const lower = { ...SACA2_FIGURES, assetLimit: { individual: 1000, marriedCoupleMember: 3000 } }
    expect(evaluateSaca2Eligibility(a, lower, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_INELIGIBLE")
  })

  it("redirects a child caregiver to ACA-3 with a static chooser link", () => {
    const a = completeSingleSenior()
    a.persons[0].caregiverOfChildUnder19 = "yes"
    a.persons[0].caregiverChildren = [{ name: "Test Child", dateOfBirth: "2015-01-01" }]
    const r = evaluateSaca2Eligibility(a, SACA2_FIGURES, ON)
    expect(r.status).toBe("REDIRECT_ACA3")
    expect(r.redirect_href).toBe("/application/type?recommended=aca3")
  })

  it("ignores stale hidden income end to end", () => {
    const a = completeSingleSenior()
    a.persons[0].income = [{ kind: "wages", amount: 9000, frequency: "monthly" }]
    expect(evaluateSaca2Eligibility(a, SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }).status).toBe("LIKELY_ELIGIBLE")
  })

  it("maps verdicts through confirmation", () => {
    expect(effectiveVerdict("pass", false)).toBe("review")
    expect(effectiveVerdict("fail", false)).toBe("review")
    expect(effectiveVerdict("documents", false)).toBe("review")
    expect(effectiveVerdict("notApplicable", false)).toBe("notApplicable")
    expect(effectiveVerdict("fail", true)).toBe("fail")
  })
})

describe("evaluateSaca2Eligibility: never throws", () => {
  it.each([
    ["completeSingleSenior", completeSingleSenior],
    ["completeFacilityCouple", completeFacilityCouple],
    ["completeRichHousehold", completeRichHousehold],
    ["completeHomeWithAllSupplements", completeHomeWithAllSupplements],
  ])("%s evaluates without hitting the fallback", (_name, build) => {
    expect(codes(evaluateSaca2Eligibility(build(), SACA2_FIGURES, ON))).not.toContain("SACA2_SCREENING_ERROR")
  })

  it("falls back to NEEDS_REVIEW with a generic message for malformed answers, a bad date, or figures with no effective entry", () => {
    const malformed = { ...completeSingleSenior(), persons: null } as unknown as Saca2Answers
    for (const r of [
      evaluateSaca2Eligibility(malformed, SACA2_FIGURES, ON),
      evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, new Date("not a date")),
      evaluateSaca2Eligibility(completeFacilityCouple(), SACA2_FIGURES, new Date("2020-01-01T12:00:00Z")),
    ]) {
      expect(r.status).toBe("NEEDS_REVIEW")
      expect(codes(r)).toEqual(["SACA2_SCREENING_ERROR"])
      expect(r.screening_label).toBe(SACA2_SCREENING_LABEL)
    }
  })
})

describe("evaluateSaca2Eligibility: PHI", () => {
  it("never writes to the console", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    evaluateSaca2Eligibility(completeFacilityCouple(), SACA2_FIGURES, ON)
    evaluateSaca2Eligibility({ persons: null } as unknown as Saca2Answers, SACA2_FIGURES, ON)
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it("puts no names, claim numbers, or account numbers in the result", () => {
    const json = JSON.stringify(evaluateSaca2Eligibility(completeFacilityCouple(), SACA2_FIGURES, ON))
    for (const secret of ["Walter", "Dorothy", "Testcase", "1EG4-TE5-MK72", "Example Bank", "Quinn"]) expect(json).not.toContain(secret)
  })

  it("never says APPROVED", () => {
    expect(JSON.stringify(evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON, { policy: ALL_CONFIRMED }))).not.toMatch(/APPROVED/)
  })
})

describe("client-bundle safety", () => {
  const FILES = [
    "lib/masshealth/saca2/eligibility-engine.ts",
    "lib/masshealth/saca2/document-checklist.ts",
    "lib/masshealth/saca2/eligibility/inputs.ts",
    "lib/masshealth/saca2/eligibility/money.ts",
    "lib/masshealth/saca2/eligibility/dates.ts",
    "lib/masshealth/saca2/eligibility/routes.ts",
    "lib/masshealth/saca2/eligibility/income-sum.ts",
    "lib/masshealth/saca2/eligibility/policy.ts",
    "lib/masshealth/saca2/eligibility/rules/assets.ts",
    "lib/masshealth/saca2/eligibility/rules/citizenship.ts",
    "lib/masshealth/saca2/eligibility/rules/home-equity.ts",
    "lib/masshealth/saca2/eligibility/rules/income.ts",
    "lib/masshealth/saca2/eligibility/rules/medicare.ts",
    "lib/masshealth/saca2/eligibility/rules/residency-route.ts",
    "lib/masshealth/saca2/eligibility/rules/spousal-allowance.ts",
    "lib/masshealth/saca2/eligibility/rules/transfers.ts",
    "lib/masshealth/saca2/pdf/derived-assets.ts",
    "lib/masshealth/saca2/pdf/visible-reader.ts",
  ]
  const FORBIDDEN = /^(pdf-lib|server-only|node:.*|.*\/pdf-fill|.*\/template)$/

  it.each(FILES)("%s has no runtime import of server-only modules", (file) => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8")
    const runtimeImports = [...source.matchAll(/import\s+(?!type\b)[^"]*?from\s+"([^"]+)"/g)].map((m) => m[1])
    expect(runtimeImports.filter((specifier) => FORBIDDEN.test(specifier))).toEqual([])
  })
})
