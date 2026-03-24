/**
 * Unit tests for collaborativeSessionSlice reducers.
 * Pure logic — no mocks required.
 * @author Bin Lee
 */

import { describe, it, expect } from "vitest"
import {
  collaborativeSessionSlice,
  type CollaborativeSessionState,
  upsertSession,
  removeSession,
  appendMessage,
  updateActiveSession,
  setActiveSession,
  clearRoomState,
  resetSession,
} from "@/lib/redux/features/collaborative-session-slice"
import type { SessionSummary, SessionMessage } from "@/lib/collaborative-sessions/types"

const reducer = collaborativeSessionSlice.reducer

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "session-1",
    swUserId: "sw-user-1",
    swName: "Jane SW",
    patientUserId: "patient-1",
    patientName: "John Patient",
    status: "scheduled",
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    inviteMessage: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeMessage(overrides: Partial<SessionMessage> = {}): SessionMessage {
  return {
    id: "msg-1",
    sessionId: "session-1",
    senderId: "sw-user-1",
    senderName: "Jane SW",
    type: "text",
    content: "Hello",
    storagePath: null,
    signedUrl: null,
    durationSec: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const emptyState: CollaborativeSessionState = reducer(undefined, { type: "@@INIT" })

// ── upsertSession ─────────────────────────────────────────────────────────────

describe("upsertSession", () => {
  it("prepends a new session to an empty list", () => {
    const s = makeSession()
    const state = reducer(emptyState, upsertSession(s))
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].id).toBe("session-1")
  })

  it("prepends a new session before existing ones", () => {
    const first = makeSession({ id: "session-old" })
    const s1 = reducer(emptyState, upsertSession(first))
    const second = makeSession({ id: "session-new" })
    const s2 = reducer(s1, upsertSession(second))
    expect(s2.sessions[0].id).toBe("session-new")
    expect(s2.sessions[1].id).toBe("session-old")
  })

  it("updates an existing session in-place without duplicating", () => {
    const original = makeSession({ status: "scheduled" })
    const s1 = reducer(emptyState, upsertSession(original))
    const updated = makeSession({ status: "active" })
    const s2 = reducer(s1, upsertSession(updated))
    expect(s2.sessions).toHaveLength(1)
    expect(s2.sessions[0].status).toBe("active")
  })
})

// ── removeSession ─────────────────────────────────────────────────────────────

describe("removeSession", () => {
  it("removes the matching session", () => {
    const a = makeSession({ id: "a" })
    const b = makeSession({ id: "b" })
    const s1 = reducer(reducer(emptyState, upsertSession(a)), upsertSession(b))
    const s2 = reducer(s1, removeSession("a"))
    expect(s2.sessions).toHaveLength(1)
    expect(s2.sessions[0].id).toBe("b")
  })

  it("is a no-op when the id does not exist", () => {
    const a = makeSession({ id: "a" })
    const s1 = reducer(emptyState, upsertSession(a))
    const s2 = reducer(s1, removeSession("nonexistent"))
    expect(s2.sessions).toHaveLength(1)
  })
})

// ── appendMessage ─────────────────────────────────────────────────────────────

describe("appendMessage", () => {
  it("appends a new message", () => {
    const msg = makeMessage()
    const state = reducer(emptyState, appendMessage(msg))
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].id).toBe("msg-1")
  })

  it("deduplicates messages with the same id", () => {
    const msg = makeMessage()
    const s1 = reducer(emptyState, appendMessage(msg))
    const s2 = reducer(s1, appendMessage(msg))
    expect(s2.messages).toHaveLength(1)
  })

  it("keeps messages in insertion order", () => {
    const m1 = makeMessage({ id: "msg-1", content: "first" })
    const m2 = makeMessage({ id: "msg-2", content: "second" })
    const s1 = reducer(reducer(emptyState, appendMessage(m1)), appendMessage(m2))
    expect(s1.messages[0].content).toBe("first")
    expect(s1.messages[1].content).toBe("second")
  })
})

// ── updateActiveSession ───────────────────────────────────────────────────────

describe("updateActiveSession", () => {
  it("merges a partial update into the active session", () => {
    const session = makeSession({ status: "scheduled" })
    const s1 = reducer(emptyState, setActiveSession(session))
    const s2 = reducer(s1, updateActiveSession({ status: "active", startedAt: "2026-01-01T00:00:00Z" }))
    expect(s2.activeSession?.status).toBe("active")
    expect(s2.activeSession?.startedAt).toBe("2026-01-01T00:00:00Z")
    // Unchanged fields are preserved
    expect(s2.activeSession?.patientName).toBe("John Patient")
  })

  it("is a no-op when there is no active session", () => {
    const state = reducer(emptyState, updateActiveSession({ status: "active" }))
    expect(state.activeSession).toBeNull()
  })
})

// ── clearRoomState ────────────────────────────────────────────────────────────

describe("clearRoomState", () => {
  it("clears messages, peerStatus, and patientOnline", () => {
    const session = makeSession({ status: "active" })
    const msg = makeMessage()
    let state = reducer(emptyState, setActiveSession(session))
    state = reducer(state, appendMessage(msg))
    state = { ...state, peerStatus: "connected", patientOnline: true, isRecording: true }

    const after = reducer(state, clearRoomState())
    expect(after.messages).toHaveLength(0)
    expect(after.peerStatus).toBe("idle")
    expect(after.patientOnline).toBe(false)
    expect(after.isRecording).toBe(false)
  })

  it("preserves activeSession so FloatingSessionBar stays alive", () => {
    const session = makeSession({ status: "active" })
    const s1 = reducer(emptyState, setActiveSession(session))
    const after = reducer(s1, clearRoomState())
    expect(after.activeSession).not.toBeNull()
    expect(after.activeSession?.id).toBe("session-1")
  })

  it("preserves the sessions list", () => {
    const session = makeSession()
    const s1 = reducer(emptyState, upsertSession(session))
    const after = reducer(s1, clearRoomState())
    expect(after.sessions).toHaveLength(1)
  })
})

// ── resetSession ──────────────────────────────────────────────────────────────

describe("resetSession", () => {
  it("clears activeSession, messages, and all room state", () => {
    const session = makeSession({ status: "active" })
    const msg = makeMessage()
    let state = reducer(emptyState, setActiveSession(session))
    state = reducer(state, appendMessage(msg))

    const after = reducer(state, resetSession())
    expect(after.activeSession).toBeNull()
    expect(after.messages).toHaveLength(0)
    expect(after.peerStatus).toBe("idle")
  })

  it("does NOT clear the sessions list", () => {
    const session = makeSession()
    let state = reducer(emptyState, upsertSession(session))
    state = reducer(state, setActiveSession(session))
    const after = reducer(state, resetSession())
    // sessions list is a separate concern — list page data should survive
    expect(after.sessions).toHaveLength(1)
  })
})
