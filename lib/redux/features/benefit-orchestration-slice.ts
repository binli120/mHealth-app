/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { FamilyProfile, BenefitStack } from "@/lib/benefit-orchestration/types"
import { emptyIncome } from "@/lib/benefit-orchestration/fpl-utils"

export interface BenefitOrchestrationState {
  profile: FamilyProfile | null
  stack: BenefitStack | null
  wizardStep: number  // 0–5
  loading: boolean
  error: string | null
}

const defaultProfile: FamilyProfile = {
  age: 0,
  pregnant: false,
  disabled: false,
  blind: false,
  over65: false,
  hasMedicare: false,
  hasPrivateInsurance: false,
  hasEmployerInsurance: false,
  citizenshipStatus: "citizen",
  stateResident: true,
  employmentStatus: "not_working",
  income: emptyIncome(),
  assets: {
    bankAccounts: 0,
    investments: 0,
    realEstate: 0,
    vehicles: 0,
    other: 0,
  },
  housingStatus: "renter",
  utilityTypes: [],
  taxFiler: false,
  householdMembers: [],
  householdSize: 1,
  childrenUnder5: 0,
  childrenUnder13: 0,
  childrenUnder18: 0,
  childrenUnder19: 0,
}

const initialState: BenefitOrchestrationState = {
  profile: null,
  stack: null,
  wizardStep: 0,
  loading: false,
  error: null,
}

export const benefitOrchestrationSlice = createSlice({
  name: "benefitOrchestration",
  initialState,
  reducers: {
    initProfile(state) {
      if (!state.profile) {
        state.profile = { ...defaultProfile }
      }
    },
    setProfile(state, action: PayloadAction<FamilyProfile>) {
      state.profile = action.payload
    },
    updateProfile(state, action: PayloadAction<Partial<FamilyProfile>>) {
      if (state.profile) {
        state.profile = { ...state.profile, ...action.payload }
      } else {
        state.profile = { ...defaultProfile, ...action.payload }
      }
    },
    setStack(state, action: PayloadAction<BenefitStack>) {
      state.stack = action.payload
    },
    setWizardStep(state, action: PayloadAction<number>) {
      state.wizardStep = Math.max(0, Math.min(5, action.payload))
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
      if (action.payload) state.error = null
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
      state.loading = false
    },
    resetOrchestration(state) {
      state.profile = null
      state.stack = null
      state.wizardStep = 0
      state.loading = false
      state.error = null
    },
  },
})

export const {
  initProfile,
  setProfile,
  updateProfile,
  setStack,
  setWizardStep,
  setLoading,
  setError,
  resetOrchestration,
} = benefitOrchestrationSlice.actions

export const benefitOrchestrationReducer = benefitOrchestrationSlice.reducer
