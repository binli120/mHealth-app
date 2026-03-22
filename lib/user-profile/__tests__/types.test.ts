/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import { DEFAULT_PROFILE_DATA } from "@/lib/user-profile/types"

describe("lib/user-profile/types — DEFAULT_PROFILE_DATA", () => {
  it("defaults preferredLanguage to English", () => {
    expect(DEFAULT_PROFILE_DATA.preferredLanguage).toBe("en")
  })

  it("defaults all accessibility flags to false", () => {
    expect(DEFAULT_PROFILE_DATA.accessibility.needsReadingAssistance).toBe(false)
    expect(DEFAULT_PROFILE_DATA.accessibility.needsTranslation).toBe(false)
    expect(DEFAULT_PROFILE_DATA.accessibility.needsVoiceAssistant).toBe(false)
  })

  it("defaults notification deadline reminders to true", () => {
    expect(DEFAULT_PROFILE_DATA.notifications.deadlineReminders).toBe(true)
  })

  it("defaults notification qualification alerts to true", () => {
    expect(DEFAULT_PROFILE_DATA.notifications.qualificationAlerts).toBe(true)
  })

  it("defaults regulation updates to false", () => {
    expect(DEFAULT_PROFILE_DATA.notifications.regulationUpdates).toBe(false)
  })

  it("defaults notification channel to email", () => {
    expect(DEFAULT_PROFILE_DATA.notifications.channel).toBe("email")
  })

  it("defaults reminder lead days to 14", () => {
    expect(DEFAULT_PROFILE_DATA.notifications.reminderLeadDays).toBe(14)
  })

  it("does not include optional fields (preferredName, gender, education)", () => {
    expect(DEFAULT_PROFILE_DATA).not.toHaveProperty("preferredName")
    expect(DEFAULT_PROFILE_DATA).not.toHaveProperty("gender")
    expect(DEFAULT_PROFILE_DATA).not.toHaveProperty("education")
  })

  it("is a plain object with the expected top-level keys", () => {
    const keys = Object.keys(DEFAULT_PROFILE_DATA).sort()
    expect(keys).toEqual(["accessibility", "notifications", "preferredLanguage"])
  })
})
