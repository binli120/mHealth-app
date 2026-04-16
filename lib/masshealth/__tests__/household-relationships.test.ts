/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import {
  countHouseholdRelationshipMentions,
  extractHouseholdRelationshipHints,
} from "@/lib/masshealth/household-relationships"

describe("household relationship parsing", () => {
  it("normalizes spouse and partner synonyms", () => {
    expect(extractHouseholdRelationshipHints("My wife Susan lives with me.")).toEqual([
      { relationship: "spouse", memberName: "Susan" },
    ])

    expect(extractHouseholdRelationshipHints("my girlfriend ana is in the home")).toEqual([
      { relationship: "partner", memberName: "Ana" },
    ])
  })

  it("extracts grandchild references", () => {
    expect(extractHouseholdRelationshipHints("my grandchild milo is 4")).toEqual([
      { relationship: "grandchild", memberName: "Milo" },
    ])
  })

  it("counts unique household mentions", () => {
    const message = "My wife Susan and my boyfriend Alex are in the household."
    expect(countHouseholdRelationshipMentions(message)).toBe(2)
  })
})

