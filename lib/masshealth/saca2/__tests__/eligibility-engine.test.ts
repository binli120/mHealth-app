/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
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

describe("evaluateSaca2Eligibility: default-policy and precedence", () => {
  it("under the shipped policy the complete fixtures never reach LIKELY_ELIGIBLE or PENDING_DOCUMENTS", () => {
    for (const build of [completeSingleSenior, completeFacilityCouple, completeRichHousehold, completeHomeWithAllSupplements]) {
      expect(["NEEDS_REVIEW", "LIKELY_INELIGIBLE", "REDIRECT_ACA3"]).toContain(evaluateSaca2Eligibility(build(), SACA2_FIGURES, ON).status)
    }
    expect(evaluateSaca2Eligibility(completeSingleSenior(), SACA2_FIGURES, ON).status).toBe("NEEDS_REVIEW")
  })

  it("with every rule confirmed, a citizenship-proof need alone gives PENDING_DOCUMENTS", () => {
    const a = completeSingleSenior()
    a.persons[0].hasMedicareOrSsiOrSsdi = "no"
    const r = evaluateSaca2Eligibility(a, SACA2_FIGURES, ON, { policy: ALL_CONFIRMED })
    expect(r.rules.find((x) => x.id === "SACA2_R2_CITIZENSHIP")?.verdict).toBe("documents")
    expect(r.status).toBe("PENDING_DOCUMENTS")
  })

  it("a redirect beats a simultaneous fail", () => {
    const a = completeSingleSenior()
    a.persons[0].caregiverOfChildUnder19 = "yes"
    a.persons[0].caregiverChildren = [{ name: "Test Child", dateOfBirth: "2015-01-01" }]
    a.assets.gates.bankAccounts = "yes"
    a.assets.bankAccounts = [{ ownerName: "Edna Testcase", accountType: "savings", institution: "Example Bank", accountNumber: "1", currentBalance: 90000, balanceOnAdmissionDate: null, open: true, closedOn: null, balanceWhenClosed: null }]
    const r = evaluateSaca2Eligibility(a, SACA2_FIGURES, ON, { policy: ALL_CONFIRMED })
    expect(r.rules.find((x) => x.id === "SACA2_R3_ASSETS")?.verdict).toBe("fail")
    expect(r.status).toBe("REDIRECT_ACA3")
  })
})

/** Specifiers of every runtime import in `source` (TypeScript AST): skips whole-statement type-only imports/exports. */
export function scanRuntimeImports(source: string): string[] {
  const specs: string[] = []
  const file = ts.createSourceFile("scan.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      let runtime = true
      if (clause) {
        if (clause.isTypeOnly) runtime = false
        else if (!clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          const els = clause.namedBindings.elements
          runtime = els.length === 0 || els.some((el) => !el.isTypeOnly)
        }
      }
      if (runtime) specs.push(node.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      let runtime = !node.isTypeOnly
      if (runtime && node.exportClause && ts.isNamedExports(node.exportClause)) {
        const els = node.exportClause.elements
        runtime = els.length === 0 || els.some((el) => !el.isTypeOnly)
      }
      if (runtime) specs.push(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0]
      if (arg && ts.isStringLiteralLike(arg)) specs.push(arg.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return specs
}

describe("scanRuntimeImports", () => {
  it.each([
    ['import { a } from "x"', ["x"]],
    ["import a from 'x'", ["x"]],
    ['import * as a from "x"', ["x"]],
    ['import a, { b } from "x"', ["x"]],
    ['import "server-only"', ["server-only"]],
    ["import 'server-only'", ["server-only"]],
    ['export { a } from "x"', ["x"]],
    ['export * from "x"', ["x"]],
    ['const m = await import("x")', ["x"]],
    ['import type { A } from "x"', []],
    ['export type { A } from "x"', []],
    ['import {\n  a,\n  b,\n} from "x"\nimport "y"', ["x", "y"]],
    ['export type A = { a: number }\nexport { b } from "./pdf/pdf-fill"', ["./pdf/pdf-fill"]],
    ['import x from "a"\nexport type T = number\nimport { q } from "b"', ["a", "b"]],
    ['export interface I { a: number }\nimport { q } from "b"', ["b"]],
    ['import { type X, y } from "m"', ["m"]],
    ['import { type X } from "m"', []],
    ['import type X, { y } from "m"', []],
  ])("%s", (source, expected) => {
    expect(scanRuntimeImports(source)).toEqual(expected)
  })
})

describe("client-bundle safety", () => {
  const ROOT = process.cwd()
  const ENTRY = "lib/masshealth/saca2/eligibility-engine.ts"
  const FORBIDDEN = /^(pdf-lib|server-only|node:.*)$|(^|\/)pdf\/(pdf-fill|template)$|^\.\/(pdf-fill|template)$/

  function resolveFile(specifier: string, from: string): string | null {
    let base: string
    if (specifier.startsWith("@/")) base = specifier.slice(2)
    else if (specifier.startsWith(".")) base = path.posix.join(path.posix.dirname(from), specifier)
    else return null
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
      if (/\.tsx?$/.test(candidate) && existsSync(path.join(ROOT, candidate))) return candidate
    }
    throw new Error(`Unresolved import ${specifier} in ${from}`)
  }

  const FORBIDDEN_FILE = /^lib\/masshealth\/saca2\/pdf\/(pdf-fill|template)(\.[a-z]+|\/index\.[a-z]+)?$/

  function walk() {
    const visited = new Set<string>()
    const offenders: string[] = []
    const queue = [ENTRY]
    while (queue.length) {
      const file = queue.pop() as string
      if (visited.has(file)) continue
      visited.add(file)
      for (const specifier of scanRuntimeImports(readFileSync(path.join(ROOT, file), "utf8"))) {
        if (FORBIDDEN.test(specifier)) offenders.push(`${file} -> ${specifier}`)
        const next = resolveFile(specifier, file)
        if (next && FORBIDDEN_FILE.test(next)) offenders.push(`${file} -> ${next}`)
        if (next && !visited.has(next)) queue.push(next)
      }
    }
    return { visited, offenders }
  }

  it("walks the real import graph from the engine", () => {
    const { visited } = walk()
    expect(visited.size).toBeGreaterThan(30)
    expect(visited).toContain("lib/applications/navigation.ts")
    expect(visited).toContain("lib/masshealth/saca2/figures-2026.ts")
  })

  it("has no runtime import of server-only modules anywhere in the graph", () => {
    expect(walk().offenders).toEqual([])
  })

  it("flags forbidden specifiers", () => {
    for (const bad of ["pdf-lib", "server-only", "node:fs", "@/lib/masshealth/saca2/pdf/pdf-fill", "./pdf/template", "../pdf/pdf-fill"]) {
      expect(FORBIDDEN.test(bad)).toBe(true)
    }
    expect(FORBIDDEN.test("react")).toBe(false)
    expect(FORBIDDEN_FILE.test("lib/masshealth/saca2/pdf/pdf-fill.ts")).toBe(true)
    expect(FORBIDDEN_FILE.test("lib/masshealth/saca2/pdf/template/index.ts")).toBe(true)
    expect(FORBIDDEN_FILE.test("lib/masshealth/saca2/pdf/visible-reader.ts")).toBe(false)
  })
})
