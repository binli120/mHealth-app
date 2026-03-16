// Type is defined in types.ts; re-exported here for backward compatibility.
import type { HouseholdRelationshipHint } from "./types"
export type { HouseholdRelationshipHint }

const HOUSEHOLD_RELATIONSHIP_ALIASES: Record<string, string> = {
  wife: "spouse",
  husband: "spouse",
  spouse: "spouse",
  partner: "partner",
  boyfriend: "partner",
  girlfriend: "partner",
  child: "child",
  son: "son",
  daughter: "daughter",
  mother: "mother",
  father: "father",
  brother: "brother",
  sister: "sister",
  grandchild: "grandchild",
  grandson: "grandchild",
  granddaughter: "grandchild",
}

const RELATIONSHIP_PATTERN = new RegExp(
  `\\bmy\\s+(${Object.keys(HOUSEHOLD_RELATIONSHIP_ALIASES).join("|")})\\b(?:\\s+([a-z][a-z'-]{1,30}))?`,
  "gi",
)

function toNormalizedRelationship(rawRelationship: string): string {
  const normalized = rawRelationship.trim().toLowerCase()
  if (!normalized) {
    return "household member"
  }

  return HOUSEHOLD_RELATIONSHIP_ALIASES[normalized] ?? normalized
}

function toCapitalizedName(rawName: string): string {
  const trimmed = rawName.trim()
  if (!trimmed) {
    return ""
  }

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`
}

export function extractHouseholdRelationshipHints(message: string): HouseholdRelationshipHint[] {
  const hints: HouseholdRelationshipHint[] = []
  const seen = new Set<string>()

  for (const match of message.matchAll(RELATIONSHIP_PATTERN)) {
    const relationshipRaw = match[1] ?? ""
    const nameRaw = match[2] ?? ""
    const relationship = toNormalizedRelationship(relationshipRaw)
    const memberName = nameRaw ? toCapitalizedName(nameRaw) : undefined
    const key = `${relationship}:${memberName ?? ""}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    hints.push({ relationship, memberName })
  }

  return hints
}

export function countHouseholdRelationshipMentions(message: string): number {
  return extractHouseholdRelationshipHints(message).length
}

