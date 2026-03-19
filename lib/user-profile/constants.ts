/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import type { SelectOption } from "@/lib/types/common"
import type {
  EducationLevel,
  Gender,
  BankAccountType,
  NotificationChannel,
  ReminderLeadDays,
} from "./types"

export const EDUCATION_LEVEL_OPTIONS: SelectOption<EducationLevel>[] = [
  { value: "less_than_high_school", label: "Less than high school" },
  { value: "high_school_or_ged", label: "High school diploma or GED" },
  { value: "some_college", label: "Some college (no degree)" },
  { value: "associates", label: "Associate's degree" },
  { value: "bachelors", label: "Bachelor's degree" },
  { value: "graduate_or_professional", label: "Graduate or professional degree" },
]

export const GENDER_OPTIONS: SelectOption<Gender>[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

export const ACCOUNT_TYPE_OPTIONS: SelectOption<BankAccountType>[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
]

export const NOTIFICATION_CHANNEL_OPTIONS: SelectOption<NotificationChannel>[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS / Text message" },
  { value: "both", label: "Email and SMS" },
]

export const REMINDER_LEAD_DAY_OPTIONS: SelectOption<string>[] = [
  { value: "7", label: "7 days before" },
  { value: "14", label: "14 days before" },
  { value: "30", label: "30 days before" },
]

export const ERROR_USER_PROFILE_NOT_FOUND = "Profile not found. Please complete registration first."
export const ERROR_USER_PROFILE_SAVE_FAILED = "Failed to save profile. Please try again."
export const ERROR_USER_PROFILE_INVALID_PAYLOAD = "Invalid profile data submitted."
export const ERROR_USER_PROFILE_LOG_PREFIX = "[user-profile]"
