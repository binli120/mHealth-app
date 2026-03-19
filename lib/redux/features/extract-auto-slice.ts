/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "@/lib/redux/store"
import { getSafeSupabaseUser } from "@/lib/supabase/client"
import {
  extractMasshealthAuto,
  type ExtractAutoResponse,
  type ExtractAutoMethod,
  type ExtractAutoPdfType,
} from "@/lib/masshealth/extract-auto-client"

type ExtractAutoStatus = "idle" | "loading" | "succeeded" | "failed"

export interface ExtractAutoState {
  status: ExtractAutoStatus
  /**
   * Raw response from the service — null until a successful extraction.
   */
  data: ExtractAutoResponse | null
  /**
   * Shortcut: which path the service chose ("workflow" | "structured").
   * Derived from data.extraction_method; null when data is null.
   */
  extractionMethod: ExtractAutoMethod | null
  /**
   * Shortcut: what the pre-scan detected ("electronic_filled" | "electronic_blank" | "scanned" | "mixed").
   * null when data is null.
   */
  pdfType: ExtractAutoPdfType | null
  /**
   * True when the service returned extraction_method === "electronic_blank".
   * The UI should block submission and ask the user to re-upload.
   */
  isBlankTemplate: boolean
  error: string | null
}

const initialState: ExtractAutoState = {
  status: "idle",
  data: null,
  extractionMethod: null,
  pdfType: null,
  isBlankTemplate: false,
  error: null,
}

const extractAutoSlice = createSlice({
  name: "extractAuto",
  initialState,
  reducers: {
    requestStarted: (state) => {
      state.status = "loading"
      state.error = null
      state.isBlankTemplate = false
    },
    requestSucceeded: (state, action: PayloadAction<ExtractAutoResponse>) => {
      state.status = "succeeded"
      state.data = action.payload
      state.extractionMethod = action.payload.extraction_method
      state.pdfType = action.payload.scan.pdf_type
      state.isBlankTemplate = action.payload.scan.pdf_type === "electronic_blank"
      state.error = null
    },
    requestFailed: (state, action: PayloadAction<string>) => {
      state.status = "failed"
      state.error = action.payload
    },
    resetExtractAutoState: () => initialState,
  },
})

export const {
  requestStarted,
  requestSucceeded,
  requestFailed,
  resetExtractAutoState,
} = extractAutoSlice.actions

// ── Thunk ─────────────────────────────────────────────────────────────────────

export function requestExtractAuto(payload: {
  file: File
  userId?: string
  documentType?: string
}) {
  return async (dispatch: AppDispatch): Promise<ExtractAutoResponse | null> => {
    dispatch(requestStarted())

    try {
      const isPdf =
        payload.file.type === "application/pdf" ||
        payload.file.name.toLowerCase().endsWith(".pdf")
      if (!isPdf) {
        throw new Error("Only PDF files are supported.")
      }

      const resolvedUserId = payload.userId ?? (await resolveCurrentUserId())
      const data = await extractMasshealthAuto({
        userId: resolvedUserId,
        file: payload.file,
        documentType: payload.documentType,
      })

      dispatch(requestSucceeded(data))
      return data
    } catch (error) {
      dispatch(
        requestFailed(
          error instanceof Error
            ? error.message
            : "Failed to extract data from uploaded PDF.",
        ),
      )
      return null
    }
  }
}

async function resolveCurrentUserId(): Promise<string> {
  const { user, error } = await getSafeSupabaseUser()
  if (error || !user?.id) {
    throw new Error("You must be signed in to extract PDF data.")
  }
  return user.id
}

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectExtractAutoState = (state: RootState) => state.extractAuto

export const selectExtractAutoStatus = (state: RootState) => state.extractAuto.status

export const selectExtractAutoData = (state: RootState) => state.extractAuto.data

export const selectExtractAutoMethod = (state: RootState) => state.extractAuto.extractionMethod

export const selectExtractAutoPdfType = (state: RootState) => state.extractAuto.pdfType

export const selectIsBlankTemplate = (state: RootState) => state.extractAuto.isBlankTemplate

export const selectExtractAutoError = (state: RootState) => state.extractAuto.error

/**
 * Selector for the clean workflow_data object — only populated when
 * extraction_method === "workflow".
 */
export const selectWorkflowData = (state: RootState): Record<string, unknown> | null => {
  const data = state.extractAuto.data
  if (!data || data.extraction_method !== "workflow") return null
  const result = data.result as Record<string, unknown>
  return (result.workflow_data as Record<string, unknown>) ?? null
}

/**
 * Selector for the structured sections array — only populated when
 * extraction_method === "structured" (scanned / mixed PDFs).
 */
export const selectStructuredSections = (state: RootState): unknown[] | null => {
  const data = state.extractAuto.data
  if (!data || data.extraction_method !== "structured") return null
  const result = data.result as Record<string, unknown>
  return (result.sections as unknown[]) ?? null
}

export const extractAutoReducer = extractAutoSlice.reducer
