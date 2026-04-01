import { describe, expect, it } from "vitest"

import {
  buildAppealDraftFilename,
  buildAppealDraftPrefill,
  buildAppealDraftWordHtml,
  fillAppealDraftPlaceholders,
} from "@/lib/appeals/draft-personalization"
import type { UserProfile } from "@/lib/user-profile/types"

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    firstName: "Maria",
    lastName: "Santos",
    dateOfBirth: null,
    phone: "(617) 555-1212",
    addressLine1: "123 Main St",
    addressLine2: "Apt 4B",
    city: "Boston",
    state: "MA",
    zip: "02118",
    citizenshipStatus: null,
    profileData: {
      preferredName: "Maria Santos",
      preferredLanguage: "en",
      accessibility: {
        needsReadingAssistance: false,
        needsTranslation: false,
        needsVoiceAssistant: false,
      },
      notifications: {
        deadlineReminders: true,
        qualificationAlerts: true,
        regulationUpdates: false,
        channel: "email",
        reminderLeadDays: 14,
      },
    },
    hasBankAccount: false,
    bankLastFour: null,
    bankName: null,
    bankAccountType: null,
    avatarUrl: null,
    familyProfileSummary: {
      householdSize: 3,
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    ...overrides,
  }
}

describe("buildAppealDraftPrefill", () => {
  it("builds applicant name, contact block, and household summary from profile data", () => {
    const prefill = buildAppealDraftPrefill({
      profile: makeProfile(),
      email: "maria@example.com",
    })

    expect(prefill.applicantName).toBe("Maria Santos")
    expect(prefill.contactInformation).toBe(
      [
        "123 Main St",
        "Apt 4B",
        "Boston, MA 02118",
        "(617) 555-1212",
        "maria@example.com",
      ].join("\n"),
    )
    expect(prefill.householdSummary).toBe("Household size: 3")
  })

  it("falls back to session name when profile data is unavailable", () => {
    const prefill = buildAppealDraftPrefill({
      profile: null,
      email: "casey@example.com",
      sessionFirstName: "Casey",
      sessionLastName: "Rivera",
    })

    expect(prefill.applicantName).toBe("Casey Rivera")
    expect(prefill.contactInformation).toBe("casey@example.com")
    expect(prefill.householdSummary).toBe("")
  })
})

describe("fillAppealDraftPlaceholders", () => {
  it("replaces known placeholders with provided values", () => {
    const result = fillAppealDraftPlaceholders(
      "I, [YOUR NAME], can be reached at [YOUR CONTACT INFORMATION].",
      {
        applicantName: "Maria Santos",
        contactInformation: "123 Main St\nBoston, MA 02118",
      },
    )

    expect(result).toBe("I, Maria Santos, can be reached at 123 Main St\nBoston, MA 02118.")
  })

  it("leaves placeholders intact when values are missing", () => {
    const result = fillAppealDraftPlaceholders("Signed,\n[YOUR NAME]", {
      applicantName: "",
      contactInformation: null,
    })

    expect(result).toBe("Signed,\n[YOUR NAME]")
  })
})

describe("buildAppealDraftWordHtml", () => {
  it("escapes html and preserves paragraphs", () => {
    const html = buildAppealDraftWordHtml("Hello <Maria>\nLine 2\n\nSecond paragraph")

    expect(html).toContain("Hello &lt;Maria&gt;<br />Line 2")
    expect(html).toContain("<p>Second paragraph</p>")
  })
})

describe("buildAppealDraftFilename", () => {
  it("creates a stable slugged base filename", () => {
    expect(buildAppealDraftFilename("Maria Santos")).toBe("masshealth-appeal-letter-maria-santos")
    expect(buildAppealDraftFilename("")).toBe("masshealth-appeal-letter")
  })
})
