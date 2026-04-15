/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import type { CitizenshipStatus } from "@/lib/benefit-orchestration/types"
import type { SupportedLanguage } from "@/lib/i18n/languages"

// ── Sub-types ─────────────────────────────────────────────────────────────────

export type EducationLevel =
  | "less_than_high_school"
  | "high_school_or_ged"
  | "some_college"
  | "associates"
  | "bachelors"
  | "graduate_or_professional"

export type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say"

export type BankAccountType = "checking" | "savings"

export type NotificationChannel = "email" | "sms" | "both"

export type ReminderLeadDays = 7 | 14 | 30

export interface AccessibilityPrefs {
  needsReadingAssistance: boolean
  needsTranslation: boolean
  needsVoiceAssistant: boolean
}

export interface EducationInfo {
  level: EducationLevel
  currentlyEnrolled: boolean
  schoolName?: string
}

export interface NotificationPrefs {
  deadlineReminders: boolean
  qualificationAlerts: boolean
  regulationUpdates: boolean
  channel: NotificationChannel
  reminderLeadDays: ReminderLeadDays
}

// ── Stored in profile_data JSONB ───────────────────────────────────────────────

export interface UserProfileData {
  preferredName?: string
  gender?: Gender
  preferredLanguage: SupportedLanguage
  accessibility: AccessibilityPrefs
  education?: EducationInfo
  notifications: NotificationPrefs
}

// ── Stored in bank_data JSONB (routing/account numbers AES-256-GCM encrypted) ─

export interface StoredBankData {
  bankName: string
  accountType: BankAccountType
  routingNumberEncrypted: string
  accountNumberEncrypted: string
  lastFourDigits: string
}

// ── Input type used for writes (plaintext from the client form) ────────────────

export interface BankAccountInput {
  bankName: string
  accountType: BankAccountType
  routingNumber: string   // plaintext — encrypted before DB write
  accountNumber: string   // plaintext — encrypted before DB write
}

// ── Full read model returned by the API ───────────────────────────────────────

export interface FamilyProfileSummary {
  householdSize: number
  updatedAt: string
}

export interface UserProfile {
  // From applicants table
  firstName: string
  lastName: string
  dateOfBirth: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  zip: string | null
  citizenshipStatus: CitizenshipStatus | null

  // From user_profiles.profile_data
  profileData: UserProfileData

  // Bank — last 4 digits only; full numbers never returned to client
  hasBankAccount: boolean
  bankLastFour: string | null
  bankName: string | null
  bankAccountType: BankAccountType | null

  // Profile picture — public URL from Supabase Storage, null if not set
  avatarUrl: string | null

  // Summary from family_profiles (benefit-stack wizard data)
  familyProfileSummary: FamilyProfileSummary | null
}

// ── Default values ─────────────────────────────────────────────────────────────

export const DEFAULT_PROFILE_DATA: UserProfileData = {
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
}
