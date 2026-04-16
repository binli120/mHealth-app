/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SessionMessage, SessionSummary } from "@/lib/collaborative-sessions/types"

export type PeerStatus = "idle" | "connecting" | "connected" | "disconnected" | "error"

export interface CollaborativeSessionState {
  /** The session the user is currently in (room page) */
  activeSession: SessionSummary | null
  /** All sessions for the current user (list page) */
  sessions: SessionSummary[]
  /** Chat messages for the active session */
  messages: SessionMessage[]
  /** WebRTC connection state */
  peerStatus: PeerStatus
  /** Whether the patient is present in the Supabase Realtime channel */
  patientOnline: boolean
  /** Whether the SW is currently recording a voice clip */
  isRecording: boolean
  loading: boolean
  error: string | null
}

const initialState: CollaborativeSessionState = {
  activeSession: null,
  sessions: [],
  messages: [],
  peerStatus: "idle",
  patientOnline: false,
  isRecording: false,
  loading: false,
  error: null,
}

export const collaborativeSessionSlice = createSlice({
  name: "collaborativeSession",
  initialState,
  reducers: {
    setActiveSession(state, action: PayloadAction<SessionSummary | null>) {
      state.activeSession = action.payload
    },
    updateActiveSession(state, action: PayloadAction<Partial<SessionSummary>>) {
      if (state.activeSession) {
        state.activeSession = { ...state.activeSession, ...action.payload }
      }
    },
    setSessions(state, action: PayloadAction<SessionSummary[]>) {
      state.sessions = action.payload
    },
    upsertSession(state, action: PayloadAction<SessionSummary>) {
      const idx = state.sessions.findIndex((s) => s.id === action.payload.id)
      if (idx >= 0) {
        state.sessions[idx] = action.payload
      } else {
        state.sessions.unshift(action.payload)
      }
    },
    setMessages(state, action: PayloadAction<SessionMessage[]>) {
      state.messages = action.payload
    },
    appendMessage(state, action: PayloadAction<SessionMessage>) {
      // Avoid duplicates (Postgres Changes can fire more than once)
      if (!state.messages.find((m) => m.id === action.payload.id)) {
        state.messages.push(action.payload)
      }
    },
    updateMessageSignedUrl(
      state,
      action: PayloadAction<{ messageId: string; signedUrl: string }>,
    ) {
      const msg = state.messages.find((m) => m.id === action.payload.messageId)
      if (msg) msg.signedUrl = action.payload.signedUrl
    },
    setPeerStatus(state, action: PayloadAction<PeerStatus>) {
      state.peerStatus = action.payload
    },
    setPatientOnline(state, action: PayloadAction<boolean>) {
      state.patientOnline = action.payload
    },
    setRecording(state, action: PayloadAction<boolean>) {
      state.isRecording = action.payload
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
      if (action.payload) state.error = null
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
      state.loading = false
    },
    resetSession(state) {
      state.activeSession = null
      state.messages = []
      state.peerStatus = "idle"
      state.patientOnline = false
      state.isRecording = false
      state.loading = false
      state.error = null
    },
    /**
     * Called when leaving the session room page.
     * Clears per-room state (messages, presence) but KEEPS activeSession
     * so the layout-level FloatingSessionBar and WebRTC hook remain alive.
     */
    removeSession(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload)
    },
    clearRoomState(state) {
      state.messages     = []
      state.peerStatus   = "idle"
      state.patientOnline = false
      state.isRecording  = false
      state.loading      = false
      state.error        = null
    },
  },
})

export const {
  setActiveSession,
  updateActiveSession,
  setSessions,
  upsertSession,
  setMessages,
  appendMessage,
  updateMessageSignedUrl,
  setPeerStatus,
  setPatientOnline,
  setRecording,
  setLoading,
  setError,
  removeSession,
  resetSession,
  clearRoomState,
} = collaborativeSessionSlice.actions

export const collaborativeSessionReducer = collaborativeSessionSlice.reducer
