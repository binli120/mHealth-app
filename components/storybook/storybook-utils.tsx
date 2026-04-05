"use client"

import { useMemo, type ReactNode } from "react"
import { Provider } from "react-redux"
import type { ApplicationCheckResult } from "@/lib/masshealth/application-checks"
import type { AppealAnalysis } from "@/lib/appeals/types"
import type { BenefitResult, BenefitStack } from "@/lib/benefit-orchestration/types"
import { ThemeProvider } from "@/components/theme-provider"
import { setLanguage, type AppState } from "@/lib/redux/features/app-slice"
import { setNotifications, setUnreadCount } from "@/lib/redux/features/notifications-slice"
import { makeStore } from "@/lib/redux/store"
import type { SupportedLanguage } from "@/lib/i18n/languages"
import type { EligibilityReport, ScreenerData } from "@/lib/eligibility-engine"
import type { Notification } from "@/lib/notifications/types"

interface StorybookAppState {
  language?: SupportedLanguage
  notifications?: Notification[]
  unreadCount?: number
}

interface StorybookProvidersProps {
  children: ReactNode
  appState?: StorybookAppState
  padded?: boolean
}

export function StorybookProviders({
  children,
  appState,
  padded = true,
}: StorybookProvidersProps) {
  const { language, notifications, unreadCount } = appState ?? {}
  const store = useMemo(() => {
    const nextStore = makeStore()

    if (language) nextStore.dispatch(setLanguage(language))
    if (notifications) nextStore.dispatch(setNotifications(notifications))
    if (typeof unreadCount === "number") nextStore.dispatch(setUnreadCount(unreadCount))

    return nextStore
  }, [language, notifications, unreadCount])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange enableSystem={false}>
      <Provider store={store}>
        <div className={padded ? "min-h-screen bg-background px-6 py-8 text-foreground" : "min-h-screen bg-background text-foreground"}>
          {children}
        </div>
      </Provider>
    </ThemeProvider>
  )
}

export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notification-1",
    userId: "user-1",
    type: "status_change",
    title: "Application approved",
    body: "Your MassHealth application has been approved and coverage starts next month.",
    metadata: {},
    readAt: null,
    emailSentAt: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    ...overrides,
  }
}

export const sampleNotifications: Notification[] = [
  makeNotification(),
  makeNotification({
    id: "notification-2",
    type: "document_request",
    title: "Document request",
    body: "Upload proof of income to keep your application moving.",
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  }),
  makeNotification({
    id: "notification-3",
    type: "new_direct_message",
    title: "Message from your social worker",
    body: "I found an earlier appointment slot for you.",
    metadata: { senderUserId: "sw-1", senderName: "Maria Santos" },
    readAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    createdAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
  }),
]

export const sampleAppealAnalysis: AppealAnalysis = {
  explanation:
    "MassHealth appears to have counted temporary overtime as recurring income. The denial can be challenged with updated wage documents and a clarification letter from the employer.",
  appealLetter: `Dear MassHealth,

I am requesting a fair hearing because the income used in my denial notice does not reflect my current household situation. My recent pay periods included temporary overtime that is no longer available.

I have attached updated pay stubs and an employer note confirming my regular schedule.

Sincerely,
Applicant`,
  evidenceChecklist: [
    "Three recent pay stubs showing regular earnings",
    "Employer note confirming overtime ended",
    "Any denial notice pages listing the disputed income amount",
  ],
}

export function makeBenefitResult(overrides: Partial<BenefitResult> = {}): BenefitResult {
  return {
    programId: "snap",
    programName: "SNAP",
    programShortName: "SNAP",
    category: "food",
    administeredBy: "Department of Transitional Assistance",
    eligibilityStatus: "likely",
    confidence: 92,
    estimatedMonthlyValue: 487,
    estimatedAnnualValue: 5844,
    valueNote: "Estimated for a household of 3 in Worcester County.",
    score: 96,
    priority: 1,
    applicationMethods: ["online", "phone"],
    applicationUrl: "https://dtaconnect.eohhs.mass.gov",
    applicationPhone: "877-382-2363",
    applicationNote: "Applying online is usually the fastest option.",
    waitlistWarning: undefined,
    keyRequirements: [
      "Massachusetts resident",
      "Household income below program threshold",
      "Identity verification for all applying members",
    ],
    requiredDocuments: ["Photo ID", "Recent pay stubs", "Lease or address proof"],
    bundleWith: ["masshealth_standard"],
    bundleNote: "SNAP and MassHealth can be pursued in parallel.",
    processingTime: "Up to 30 days",
    nextSteps: ["Start the online DTA application", "Upload wage proof", "Respond to any follow-up notice within 10 days"],
    ...overrides,
  }
}

const sampleLikelyResult = makeBenefitResult()
const samplePossibleResult = makeBenefitResult({
  programId: "liheap",
  programName: "LIHEAP Energy Assistance",
  programShortName: "LIHEAP",
  category: "utility",
  eligibilityStatus: "possibly",
  confidence: 74,
  estimatedMonthlyValue: 85,
  estimatedAnnualValue: 1020,
  valueNote: "Seasonal estimate based on heating costs.",
  score: 71,
  priority: 2,
  applicationMethods: ["online", "phone", "mail"],
  applicationUrl: "https://toapply.org/MassLIHEAP",
  applicationPhone: "800-632-8175",
  waitlistWarning: "Funding is limited during peak winter demand.",
  processingTime: "2 to 4 weeks",
  nextSteps: ["Call the local agency to confirm intake dates", "Gather utility bills", "Prepare proof of residence"],
})

export const sampleBenefitStack: BenefitStack = {
  profileId: "profile-1",
  generatedAt: "2026-04-04T14:30:00.000Z",
  fplPercent: 142,
  annualFPL: 25820,
  totalMonthlyIncome: 3050,
  householdSize: 3,
  results: [sampleLikelyResult, samplePossibleResult],
  likelyPrograms: [sampleLikelyResult],
  possiblePrograms: [samplePossibleResult],
  quickWins: [sampleLikelyResult],
  totalEstimatedMonthlyValue: 572,
  totalEstimatedAnnualValue: 6864,
  bundles: [
    {
      bundleId: "bundle-1",
      bundleName: "Food + Health Coverage",
      description: "A shared paperwork path for the highest-priority public benefits.",
      programIds: ["snap", "masshealth_standard"],
      sharedApplicationName: "Start combined intake",
      applicationUrl: "/application/new",
      applicationPhone: "800-841-2900",
      estimatedTime: "45 to 60 minutes",
      totalEstimatedMonthlyValue: 487,
    },
  ],
  summary:
    "This household is likely eligible for SNAP now and may qualify for utility support. Starting with the bundled intake will reduce duplicate document requests.",
}

export const sampleApplicationChecks: ApplicationCheckResult[] = [
  {
    id: "income.0.total_mismatch",
    severity: "warning",
    category: "income_consistency",
    title: "Annual income total may be inconsistent",
    message: "Reported annual income differs from the listed pay frequencies by more than 20%.",
  },
  {
    id: "ssn.1.missing",
    severity: "error",
    category: "ssn_coverage",
    title: "SSN missing for applying member",
    message: "Household Member 2 is applying for coverage but has no SSN or exception recorded.",
  },
  {
    id: "forms.aca3ap",
    severity: "info",
    category: "form_supplements",
    title: "Supplement may be required",
    message: "Household size suggests ACA-3-AP should be reviewed before submission.",
  },
]

export const sampleScreenerData: Partial<ScreenerData> = {
  householdSize: 3,
  annualIncome: 36000,
}

export const sampleEligibilityReport: EligibilityReport = {
  fplPercent: 139,
  annualFPL: 25820,
  monthlyFPL: 2152,
  summary:
    "This household appears close to the MassHealth CarePlus threshold and should also review ConnectorCare options.",
  results: [
    {
      code: "careplus",
      program: "MassHealth CarePlus",
      status: "likely",
      tagline: "Coverage looks strong if current monthly income remains stable.",
      details:
        "Adults without Medicare under the 138% threshold often qualify for full Medicaid-style coverage with no monthly premium.",
      actionLabel: "Start application",
      actionHref: "/application/new",
      color: "green",
      priority: 1,
    },
    {
      code: "connectorcare",
      program: "ConnectorCare",
      status: "possibly",
      tagline: "A fallback path if income is verified slightly higher.",
      details:
        "ConnectorCare can provide reduced premium marketplace plans for households above Medicaid but within subsidy limits.",
      actionLabel: "Compare plans",
      actionHref: "https://www.mahealthconnector.org",
      color: "yellow",
      priority: 2,
    },
  ],
}

export const sampleWizardSteps = [
  { id: "personal", title: "Personal Information", shortTitle: "Personal", completed: true, current: false },
  { id: "household", title: "Household Details", shortTitle: "Household", completed: false, current: true },
  { id: "income", title: "Income", shortTitle: "Income", completed: false, current: false },
  { id: "review", title: "Review and Submit", shortTitle: "Review", completed: false, current: false },
]

export const defaultAppState: AppState = {
  language: "en",
}
