/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * Redux slice — identity verification
 *
 * Tracks the current user's identity verification state client-side so that
 * components (dashboard banner, application submit gate) can react without
 * additional API calls on every render.
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdentityStatus = "unverified" | "pending" | "verified" | "failed"

export interface IdentityVerificationState {
  /** Current verification status for the authenticated applicant */
  status: IdentityStatus
  /** 0–100 match score from the last attempt */
  score: number | null
  /** ISO timestamp of when verification was completed */
  verifiedAt: string | null
  /** Whether the modal is currently open */
  scannerOpen: boolean
  /** Whether a verification API call is in-flight */
  loading: boolean
  /** Error message from the last failed API call */
  error: string | null
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: IdentityVerificationState = {
  status: "unverified",
  score: null,
  verifiedAt: null,
  scannerOpen: false,
  loading: false,
  error: null,
}

// ─── Slice ────────────────────────────────────────────────────────────────────

export const identityVerificationSlice = createSlice({
  name: "identityVerification",
  initialState,
  reducers: {
    /** Hydrate from the API response on page load */
    setIdentityStatus(
      state,
      action: PayloadAction<{
        status: IdentityStatus
        score: number | null
        verifiedAt: string | null
      }>,
    ) {
      state.status = action.payload.status
      state.score = action.payload.score
      state.verifiedAt = action.payload.verifiedAt
    },

    /** Called when a verification attempt succeeds */
    verificationSucceeded(
      state,
      action: PayloadAction<{ score: number; verifiedAt: string }>,
    ) {
      state.status = "verified"
      state.score = action.payload.score
      state.verifiedAt = action.payload.verifiedAt
      state.loading = false
      state.error = null
      state.scannerOpen = false
    },

    /** Called when score is in the review band (50–69) */
    verificationPending(state, action: PayloadAction<{ score: number }>) {
      state.status = "pending"
      state.score = action.payload.score
      state.loading = false
      state.error = null
      state.scannerOpen = false
    },

    /** Called when score < 50 */
    verificationFailed(state, action: PayloadAction<{ score: number; error: string }>) {
      state.status = "failed"
      state.score = action.payload.score
      state.loading = false
      state.error = action.payload.error
    },

    openScanner(state) {
      state.scannerOpen = true
      state.error = null
    },

    closeScanner(state) {
      state.scannerOpen = false
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
      if (action.payload) state.error = null
    },

    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
      state.loading = false
    },

    reset() {
      return initialState
    },
  },
})

export const {
  setIdentityStatus,
  verificationSucceeded,
  verificationPending,
  verificationFailed,
  openScanner,
  closeScanner,
  setLoading,
  setError,
  reset,
} = identityVerificationSlice.actions

export const identityVerificationReducer = identityVerificationSlice.reducer
