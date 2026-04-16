/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getSafeSupabaseUser } from "@/lib/supabase/client"
import { toUserFacingError } from "@/lib/errors/user-facing"
import {
  extractMasshealthWorkflow,
  type ExtractWorkflowResponse,
} from "@/lib/masshealth/extract-workflow-client"

type ExtractWorkflowStatus = "idle" | "loading" | "succeeded" | "failed"

export interface ExtractWorkflowState {
  status: ExtractWorkflowStatus
  data: ExtractWorkflowResponse | null
  error: string | null
}

const initialState: ExtractWorkflowState = {
  status: "idle",
  data: null,
  error: null,
}

const extractWorkflowSlice = createSlice({
  name: "extractWorkflow",
  initialState,
  reducers: {
    requestStarted: (state) => {
      state.status = "loading"
      state.error = null
    },
    requestSucceeded: (state, action: PayloadAction<ExtractWorkflowResponse>) => {
      state.status = "succeeded"
      state.data = action.payload
      state.error = null
    },
    requestFailed: (state, action: PayloadAction<string>) => {
      state.status = "failed"
      state.error = action.payload
    },
    resetExtractWorkflowState: () => initialState,
  },
})

export const {
  requestStarted,
  requestSucceeded,
  requestFailed,
  resetExtractWorkflowState,
} = extractWorkflowSlice.actions

export function requestExtractWorkflow(payload: { file: File; userId?: string }) {
  return async (dispatch: AppDispatch): Promise<ExtractWorkflowResponse | null> => {
    dispatch(requestStarted())

    try {
      const isPdf =
        payload.file.type === "application/pdf" ||
        payload.file.name.toLowerCase().endsWith(".pdf")
      if (!isPdf) {
        throw new Error("Only PDF files are supported.")
      }

      const resolvedUserId = payload.userId ?? (await resolveCurrentUserId())
      const data = await extractMasshealthWorkflow({
        userId: resolvedUserId,
        file: payload.file,
      })

      dispatch(requestSucceeded(data))
      return data
    } catch (error) {
      dispatch(
        requestFailed(
          toUserFacingError(error, "Failed to extract workflow from uploaded PDF."),
        ),
      )
      return null
    }
  }
}

async function resolveCurrentUserId(): Promise<string> {
  const { user, error } = await getSafeSupabaseUser()

  if (error || !user?.id) {
    throw new Error("You must be signed in to extract workflow data.")
  }

  return user.id
}

export const selectExtractWorkflowState = (state: RootState) => state.extractWorkflow

export const extractWorkflowReducer = extractWorkflowSlice.reducer
