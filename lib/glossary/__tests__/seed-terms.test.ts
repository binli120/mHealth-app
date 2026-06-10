import { describe, expect, it } from "vitest"

import { SEED_TERMS } from "@/lib/glossary/seed-terms"

const VALID_CATEGORIES = new Set(["program", "insurance", "aca", "medical"])

describe("SEED_TERMS", () => {
  it("contains unique, well-formed glossary entries", () => {
    expect(SEED_TERMS.length).toBeGreaterThan(50)

    const slugs = new Set<string>()
    for (const term of SEED_TERMS) {
      expect(term.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(slugs.has(term.slug)).toBe(false)
      slugs.add(term.slug)

      expect(term.term_en.trim()).toBe(term.term_en)
      expect(term.term_en.length).toBeGreaterThan(0)
      expect(term.definition_en.length).toBeGreaterThan(40)
      expect(term.definition_es.length).toBeGreaterThan(20)
      expect(VALID_CATEGORIES.has(term.category)).toBe(true)
      expect(Array.isArray(term.aliases)).toBe(true)
      expect(Array.isArray(term.related_slugs)).toBe(true)
    }
  })

  it("only links related terms that exist in the seed list", () => {
    const slugs = new Set(SEED_TERMS.map((term) => term.slug))

    for (const term of SEED_TERMS) {
      for (const relatedSlug of term.related_slugs) {
        expect(slugs.has(relatedSlug), `${term.slug} links missing ${relatedSlug}`).toBe(true)
      }
    }
  })

  it("keeps aliases scoped to the owning term", () => {
    for (const term of SEED_TERMS) {
      const aliasesForTerm = new Set<string>()

      for (const alias of term.aliases) {
        const normalizedAlias = alias.trim().toLowerCase()

        expect(alias).toBe(alias.trim())
        expect(normalizedAlias.length).toBeGreaterThan(0)
        expect(normalizedAlias).not.toBe(term.term_en.toLowerCase())
        expect(aliasesForTerm.has(normalizedAlias)).toBe(false)

        aliasesForTerm.add(normalizedAlias)
      }
    }
  })

  it("includes the expected MassHealth navigation anchors", () => {
    const bySlug = new Map(SEED_TERMS.map((term) => [term.slug, term]))

    expect(bySlug.get("masshealth-standard")?.category).toBe("program")
    expect(bySlug.get("masshealth-careplus")?.aliases).toContain("CarePlus")
    expect(bySlug.get("connectorcare")?.related_slugs).toContain("aptc")
    expect(bySlug.get("health-safety-net")?.term_en).toBe("Health Safety Net")
  })
})
