import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { MassHealthApplicationType } from "@/lib/masshealth/application-types"

export interface HouseholdMember {
  id: string
  firstName: string
  lastName: string
  relationship: string
  dob: string
  ssn: string
  pregnant: boolean
  disabled: boolean
  over65: boolean
}

export interface IncomeSource {
  id: string
  type: string
  employer: string
  amount: string
  frequency: string
}

export interface ApplicationFormData {
  applicationType: MassHealthApplicationType | ""
  firstName: string
  lastName: string
  dob: string
  ssn: string
  email: string
  address: string
  apartment: string
  city: string
  state: string
  zip: string
  county: string
  phone: string
  otherPhone: string
  citizenship: string
  preferredSpokenLanguage: string
  preferredWrittenLanguage: string
  signatureDate: string
  existingCoverageId: string
  longTermCareNeed: "" | "yes" | "no"
  medicareClaimNumber: string
  medicarePartAStart: string
  medicarePartBStart: string
  householdMembers: HouseholdMember[]
  incomeSources: IncomeSource[]
  hasAssets: string
  bankAccounts: string
  investments: string
  property: string
  documents: string[]
  aca3QuestionResponses: Record<string, string | string[]>
  certify: boolean
}

export interface ApplicationRecord {
  id: string
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  newApplicationForm: ApplicationFormData
  aca3Wizard: Record<string, unknown> | null
}

export interface ApplicationState {
  activeApplicationId: string | null
  applicationOrder: string[]
  applicationsById: Record<string, ApplicationRecord>
}

export const DEFAULT_APPLICATION_ID = "app-default"

export const initialApplicationFormData: ApplicationFormData = {
  applicationType: "",
  firstName: "",
  lastName: "",
  dob: "",
  ssn: "",
  email: "",
  address: "",
  apartment: "",
  city: "",
  state: "MA",
  zip: "",
  county: "",
  phone: "",
  otherPhone: "",
  citizenship: "",
  preferredSpokenLanguage: "",
  preferredWrittenLanguage: "",
  signatureDate: "",
  existingCoverageId: "",
  longTermCareNeed: "",
  medicareClaimNumber: "",
  medicarePartAStart: "",
  medicarePartBStart: "",
  householdMembers: [],
  incomeSources: [],
  hasAssets: "no",
  bankAccounts: "",
  investments: "",
  property: "",
  documents: [],
  aca3QuestionResponses: {},
  certify: false,
}

function createApplicationRecord(
  applicationId: string,
  applicationType?: MassHealthApplicationType | "",
): ApplicationRecord {
  const now = new Date().toISOString()

  return {
    id: applicationId,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    newApplicationForm: {
      ...initialApplicationFormData,
      ...(applicationType ? { applicationType } : {}),
    },
    aca3Wizard: null,
  }
}

function ensureApplication(state: ApplicationState, applicationId: string): ApplicationRecord {
  const existing = state.applicationsById[applicationId]
  if (existing) {
    return existing
  }

  const created = createApplicationRecord(applicationId)
  state.applicationsById[applicationId] = created
  state.applicationOrder.push(applicationId)
  return created
}

function resolveApplicationId(state: ApplicationState, applicationId?: string): string {
  const resolved = applicationId ?? state.activeApplicationId ?? DEFAULT_APPLICATION_ID
  ensureApplication(state, resolved)
  if (!state.activeApplicationId) {
    state.activeApplicationId = resolved
  }
  return resolved
}

function touchApplication(record: ApplicationRecord): void {
  record.updatedAt = new Date().toISOString()
}

function maskSsn(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length < 4) {
    return ""
  }

  return `***-**-${digits.slice(-4)}`
}

function sanitizeHouseholdMember(member: HouseholdMember): HouseholdMember {
  return {
    ...member,
    ssn: maskSsn(member.ssn),
  }
}

function sanitizeApplicationForm(form: ApplicationFormData): ApplicationFormData {
  return {
    ...form,
    ssn: maskSsn(form.ssn),
    householdMembers: form.householdMembers.map(sanitizeHouseholdMember),
  }
}

function sanitizeApplicationPatch(patch: Partial<ApplicationFormData>): Partial<ApplicationFormData> {
  const nextPatch: Partial<ApplicationFormData> = { ...patch }

  if (typeof patch.ssn === "string") {
    nextPatch.ssn = maskSsn(patch.ssn)
  }

  if (Array.isArray(patch.householdMembers)) {
    nextPatch.householdMembers = patch.householdMembers.map(sanitizeHouseholdMember)
  }

  return nextPatch
}

type PatchFormPayload =
  | Partial<ApplicationFormData>
  | {
      applicationId?: string
      patch: Partial<ApplicationFormData>
    }

type SetFormPayload =
  | ApplicationFormData
  | {
      applicationId?: string
      form: ApplicationFormData
    }

const initialRecord = createApplicationRecord(DEFAULT_APPLICATION_ID)

const initialState: ApplicationState = {
  activeApplicationId: DEFAULT_APPLICATION_ID,
  applicationOrder: [DEFAULT_APPLICATION_ID],
  applicationsById: {
    [DEFAULT_APPLICATION_ID]: initialRecord,
  },
}

const applicationSlice = createSlice({
  name: "application",
  initialState,
  reducers: {
    createApplication: (
      state,
      action: PayloadAction<{
        applicationId: string
        applicationType?: MassHealthApplicationType | ""
        setActive?: boolean
      }>,
    ) => {
      const { applicationId, applicationType } = action.payload
      if (!state.applicationsById[applicationId]) {
        state.applicationsById[applicationId] = createApplicationRecord(
          applicationId,
          applicationType,
        )
        state.applicationOrder.push(applicationId)
      } else if (applicationType) {
        state.applicationsById[applicationId].newApplicationForm.applicationType =
          applicationType
        touchApplication(state.applicationsById[applicationId])
      }

      if (action.payload.setActive !== false) {
        state.activeApplicationId = applicationId
      }
    },
    setActiveApplication: (state, action: PayloadAction<string>) => {
      const applicationId = resolveApplicationId(state, action.payload)
      state.activeApplicationId = applicationId
    },
    patchNewApplicationForm: (state, action: PayloadAction<PatchFormPayload>) => {
      let applicationId: string | undefined
      let patch: Partial<ApplicationFormData>

      if (
        typeof action.payload === "object" &&
        action.payload !== null &&
        "patch" in action.payload
      ) {
        applicationId = action.payload.applicationId
        patch = action.payload.patch
      } else {
        patch = action.payload
      }

      const targetId = resolveApplicationId(state, applicationId)
      const target = ensureApplication(state, targetId)
      const sanitizedPatch = sanitizeApplicationPatch(patch)

      target.newApplicationForm = {
        ...target.newApplicationForm,
        ...sanitizedPatch,
      }
      touchApplication(target)
    },
    setNewApplicationForm: (state, action: PayloadAction<SetFormPayload>) => {
      let applicationId: string | undefined
      let form: ApplicationFormData

      if (
        typeof action.payload === "object" &&
        action.payload !== null &&
        "form" in action.payload
      ) {
        applicationId = action.payload.applicationId
        form = action.payload.form
      } else {
        form = action.payload
      }

      const targetId = resolveApplicationId(state, applicationId)
      const target = ensureApplication(state, targetId)
      target.newApplicationForm = sanitizeApplicationForm(form)
      touchApplication(target)
    },
    addHouseholdMember: (state, action: PayloadAction<HouseholdMember>) => {
      const targetId = resolveApplicationId(state)
      const target = ensureApplication(state, targetId)
      target.newApplicationForm.householdMembers.push(
        sanitizeHouseholdMember(action.payload),
      )
      touchApplication(target)
    },
    removeHouseholdMember: (state, action: PayloadAction<string>) => {
      const targetId = resolveApplicationId(state)
      const target = ensureApplication(state, targetId)
      target.newApplicationForm.householdMembers =
        target.newApplicationForm.householdMembers.filter(
          (member) => member.id !== action.payload,
        )
      touchApplication(target)
    },
    addIncomeSource: (state, action: PayloadAction<IncomeSource>) => {
      const targetId = resolveApplicationId(state)
      const target = ensureApplication(state, targetId)
      target.newApplicationForm.incomeSources.push(action.payload)
      touchApplication(target)
    },
    removeIncomeSource: (state, action: PayloadAction<string>) => {
      const targetId = resolveApplicationId(state)
      const target = ensureApplication(state, targetId)
      target.newApplicationForm.incomeSources =
        target.newApplicationForm.incomeSources.filter(
          (source) => source.id !== action.payload,
        )
      touchApplication(target)
    },
    setApplicationWizardState: (
      state,
      action: PayloadAction<{
        applicationId?: string
        wizardState: Record<string, unknown>
      }>,
    ) => {
      const targetId = resolveApplicationId(state, action.payload.applicationId)
      const target = ensureApplication(state, targetId)
      target.aca3Wizard = action.payload.wizardState
      touchApplication(target)
    },
    markApplicationSubmitted: (
      state,
      action: PayloadAction<{ applicationId?: string } | undefined>,
    ) => {
      const targetId = resolveApplicationId(state, action.payload?.applicationId)
      const target = ensureApplication(state, targetId)
      target.submittedAt = new Date().toISOString()
      touchApplication(target)
    },
    resetNewApplicationForm: (
      state,
      action: PayloadAction<{ applicationId?: string } | undefined>,
    ) => {
      const targetId = resolveApplicationId(state, action.payload?.applicationId)
      const target = ensureApplication(state, targetId)
      target.newApplicationForm = { ...initialApplicationFormData }
      target.aca3Wizard = null
      target.submittedAt = null
      touchApplication(target)
    },
  },
})

export const {
  createApplication,
  setActiveApplication,
  patchNewApplicationForm,
  setNewApplicationForm,
  addHouseholdMember,
  removeHouseholdMember,
  addIncomeSource,
  removeIncomeSource,
  setApplicationWizardState,
  markApplicationSubmitted,
  resetNewApplicationForm,
} = applicationSlice.actions

export const applicationReducer = applicationSlice.reducer
