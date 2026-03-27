/**
 * Conversation flow steps and lookup maps for the Pre-Screener page.
 * @author Bin Lee
 */

import type { Step } from "./page.types"

export const STEPS: Step[] = [
  {
    id: "intro",
    botMessage:
      "Hi! I'm the MassHealth Eligibility Assistant. I can estimate which health coverage programs you may qualify for in under 5 minutes.\n\nLet's get started — where do you currently live?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Massachusetts", value: true, emoji: "🏠" },
      { label: "Another state", value: false, emoji: "📍" },
    ],
    dataKey: "livesInMA",
    next: (val) => (val === true ? "age" : "not_ma"),
  },
  {
    id: "not_ma",
    botMessage:
      "MassHealth is only available to Massachusetts residents. You may have coverage options in your state — visit healthcare.gov to explore.\n\nAre you planning to move to Massachusetts?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes, I'm moving to MA", value: true, emoji: "📦" },
      { label: "No", value: false, emoji: "✗" },
    ],
    dataKey: null,
    next: (val) => (val === true ? "age" : "done"),
  },
  {
    id: "age",
    botMessage: "How old are you?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Under 1 year", value: 0, emoji: "👶" },
      { label: "1–18 years", value: 10, emoji: "🧒" },
      { label: "19–26 years", value: 22, emoji: "🎓" },
      { label: "27–64 years", value: 40, emoji: "👤" },
      { label: "65 or older", value: 70, emoji: "🧓" },
    ],
    dataKey: "age",
    next: (val) => {
      if ((val as number) < 1) return "household_size"
      if ((val as number) <= 18) return "household_size"
      if ((val as number) >= 65) return "household_size"
      return "pregnancy_check"
    },
  },
  {
    id: "pregnancy_check",
    botMessage: "Are you currently pregnant?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes", value: true, emoji: "🤰" },
      { label: "No", value: false, emoji: "✗" },
    ],
    dataKey: "isPregnant",
    next: "household_size",
  },
  {
    id: "household_size",
    botMessage:
      "How many people are in your household? (Include yourself, your spouse/partner, and any children or other dependents you claim on taxes.)",
    inputType: "number",
    placeholder: "e.g. 1, 2, 3...",
    hint: "Count everyone who lives with you and you'd include on a tax return.",
    min: 1,
    max: 20,
    dataKey: "householdSize",
    next: "income",
  },
  {
    id: "income",
    botMessage:
      "What is your household's estimated annual income before taxes? (Include wages, Social Security, disability, unemployment, and any other regular income.)",
    inputType: "currency",
    placeholder: "e.g. 25000",
    hint: "Round to the nearest dollar. Enter 0 if no income.",
    min: 0,
    dataKey: "annualIncome",
    next: "citizenship",
  },
  {
    id: "citizenship",
    botMessage: "What is your citizenship or immigration status?",
    inputType: "quickreply",
    quickReplies: [
      { label: "U.S. Citizen", value: "citizen", emoji: "🇺🇸" },
      { label: "Lawful Permanent Resident (Green Card)", value: "qualified_immigrant", emoji: "🟩" },
      { label: "Other qualified immigrant", value: "qualified_immigrant", emoji: "📄" },
      { label: "Undocumented / No status", value: "undocumented", emoji: "🔒" },
    ],
    dataKey: "citizenshipStatus",
    next: (_, data) => {
      if (data.citizenshipStatus === "undocumented") return "done"
      if ((data.age ?? 0) >= 60 || (data.hasDisability ?? false)) return "disability"
      return "disability"
    },
  },
  {
    id: "disability",
    botMessage:
      "Do you have a disability, or do you receive SSI (Supplemental Security Income) or SSDI (Social Security Disability Insurance)?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes — SSI/SSDI or documented disability", value: true, emoji: "♿" },
      { label: "No", value: false, emoji: "✗" },
    ],
    dataKey: "hasDisability",
    next: (val, data) => {
      const age = data.age ?? 0
      if (age >= 65 || val === true) return "medicare"
      return "employer_insurance"
    },
  },
  {
    id: "medicare",
    botMessage: "Are you currently enrolled in Medicare (Part A or Part B)?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes, I have Medicare", value: true, emoji: "🏥" },
      { label: "No", value: false, emoji: "✗" },
      { label: "Not sure", value: false, emoji: "❓" },
    ],
    dataKey: "hasMedicare",
    next: "employer_insurance",
  },
  {
    id: "employer_insurance",
    botMessage:
      "Does your employer (or your spouse's employer) currently offer health insurance that you could enroll in?",
    inputType: "quickreply",
    quickReplies: [
      { label: "Yes", value: true, emoji: "🏢" },
      { label: "No / Not applicable", value: false, emoji: "✗" },
    ],
    dataKey: "hasEmployerInsurance",
    next: "done",
  },
  {
    id: "done",
    botMessage: "Thanks — let me check your eligibility now...",
    inputType: "done",
    dataKey: null,
    next: "done",
  },
]

export const STEP_MAP: Record<string, Step> = Object.fromEntries(STEPS.map((s) => [s.id, s]))

export const PROGRESS_STEPS = [
  "intro",
  "age",
  "household_size",
  "income",
  "citizenship",
  "disability",
  "employer_insurance",
  "done",
]
