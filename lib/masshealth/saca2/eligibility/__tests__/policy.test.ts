/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  SACA2_POLICY_GATED_RULES,
  SACA2_POLICY_REVIEW_DOC,
  SACA2_RULE_POLICY,
} from "@/lib/masshealth/saca2/eligibility/policy"
import { SACA2_RULE_IDS } from "@/lib/masshealth/saca2/eligibility/types"

interface PolicyRow {
  id: string
  confirmed: string
  reviewer: string
  date: string
  regulation: string
}

const START = "<!-- policy-table:start -->"
const END = "<!-- policy-table:end -->"
const PLACEHOLDERS = new Set(["", "-", "—", "pending", "tbd", "n/a (form-derived)"])

function parsePolicyTable(markdown: string): PolicyRow[] {
  const start = markdown.indexOf(START)
  const end = markdown.indexOf(END)
  if (start < 0 || end < start) throw new Error("policy table markers are missing")
  const lines = markdown
    .slice(start + START.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
  const [header, , ...body] = lines
  const columns = header.split("|").slice(1, -1).map((cell) => cell.trim())
  const column = (name: string) => {
    const index = columns.indexOf(name)
    if (index < 0) throw new Error(`policy table has no "${name}" column`)
    return index
  }
  return body.map((line) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    return {
      id: cells[column("Rule id")],
      confirmed: cells[column("Confirmed")],
      reviewer: cells[column("Reviewer")],
      date: cells[column("Date")],
      regulation: cells[column("Regulation checked")],
    }
  })
}

const rows = parsePolicyTable(readFileSync(path.join(process.cwd(), SACA2_POLICY_REVIEW_DOC), "utf8"))

describe("SACA-2 policy confirmation gate", () => {
  it("has exactly one table row per rule id", () => {
    expect(rows.map((row) => row.id).sort()).toEqual([...SACA2_RULE_IDS].sort())
  })

  it("keeps rules 3-7 behind the 130 CMR review gate (spec §4.4)", () => {
    expect(SACA2_POLICY_GATED_RULES).toEqual([
      "SACA2_R3_ASSETS",
      "SACA2_R4_HOME_EQUITY",
      "SACA2_R5_TRANSFERS",
      "SACA2_R6_INCOME",
      "SACA2_R7_SPOUSAL_ALLOWANCE",
    ])
  })

  it.each(SACA2_RULE_IDS)("%s: the doc's Confirmed column matches the code", (id) => {
    const row = rows.find((r) => r.id === id)
    expect(row?.confirmed === "yes" || row?.confirmed === "no", `Confirmed must be yes or no for ${id}`).toBe(true)
    expect(row?.confirmed === "yes").toBe(SACA2_RULE_POLICY[id].confirmed)
  })

  it.each(SACA2_POLICY_GATED_RULES)("%s: a confirmed gated rule names a reviewer, a date, and a 130 CMR citation", (id) => {
    const row = rows.find((r) => r.id === id)
    if (!SACA2_RULE_POLICY[id].confirmed) return
    expect(PLACEHOLDERS.has((row?.reviewer ?? "").toLowerCase())).toBe(false)
    expect(row?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row?.regulation).toMatch(/130 CMR 5(19|20)\.\d+/)
  })

  it("gives every rule a non-empty label", () => {
    for (const id of SACA2_RULE_IDS) expect(SACA2_RULE_POLICY[id].label.length).toBeGreaterThan(0)
  })
})
