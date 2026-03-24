/**
 * useSessionRealtime
 * Manages the Supabase Realtime channel for a collaborative session.
 *
 * Strategy: Supabase Broadcast (no table-level Realtime publication needed)
 *   • "new-message"   — delivered after the REST API call succeeds
 *   • "status-change" — delivered after a PATCH /api/sessions/[id] succeeds
 *
 * Presence: tracks who is currently viewing the room so the SW can see
 * when the patient goes online/offline.
 *
 * @author Bin Lee
 */

"use client"

import { useCallback, useEffect, useRef } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { getSupabaseClient } from "@/lib/supabase/client"
import { useAppDispatch } from "@/lib/redux/hooks"
import {
  appendMessage,
  updateActiveSession,
  setPatientOnline,
} from "@/lib/redux/features/collaborative-session-slice"
import type {
  SessionMessage,
  SessionStatus,
} from "@/lib/collaborative-sessions/types"

// ── Broadcast event shapes ────────────────────────────────────────────────────

export type BroadcastNewMessage = {
  type: "new-message"
  message: SessionMessage
}

export type BroadcastStatusChange = {
  type: "status-change"
  status: SessionStatus
  startedAt?: string | null
  endedAt?: string | null
}

export type BroadcastPayload = BroadcastNewMessage | BroadcastStatusChange

// ── Presence state per user ───────────────────────────────────────────────────

interface PresenceEntry {
  userId: string
  role: "sw" | "patient"
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface Options {
  sessionId: string
  userId: string | null
  role: "sw" | "patient"
}

/**
 * Returns a stable `broadcast` function that sends an event to every other
 * participant in the room channel.  The channel subscription is set up on
 * mount and torn down on unmount.
 */
export function useSessionRealtime({ sessionId, userId, role }: Options) {
  const dispatch = useAppDispatch()
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Stable broadcast function — safe to pass as a prop / dependency
  const broadcast = useCallback((payload: BroadcastPayload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: payload.type,
      payload,
    })
  }, [])

  useEffect(() => {
    if (!sessionId || !userId) return

    const supabase = getSupabaseClient()

    const channel = supabase.channel(`session-room-${sessionId}`, {
      config: {
        broadcast: { self: false },       // don't echo to the sender
        presence:  { key: userId },
      },
    })

    channelRef.current = channel

    // ── Presence: sync ───────────────────────────────────────────────────────
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceEntry>()
      // Check if any presence entry belongs to a patient
      const patientOnline = Object.values(state).some((presences) =>
        presences.some((p) => p.role === "patient"),
      )
      dispatch(setPatientOnline(patientOnline))
    })

    // ── Broadcast: new message ───────────────────────────────────────────────
    channel.on(
      "broadcast",
      { event: "new-message" },
      ({ payload }: { payload: BroadcastNewMessage }) => {
        if (payload?.message) {
          dispatch(appendMessage(payload.message))
        }
      },
    )

    // ── Broadcast: session status change ─────────────────────────────────────
    channel.on(
      "broadcast",
      { event: "status-change" },
      ({ payload }: { payload: BroadcastStatusChange }) => {
        if (!payload?.status) return
        dispatch(
          updateActiveSession({
            status: payload.status,
            ...(payload.startedAt !== undefined && { startedAt: payload.startedAt }),
            ...(payload.endedAt   !== undefined && { endedAt:   payload.endedAt   }),
          }),
        )
      },
    )

    // ── Subscribe & track presence ───────────────────────────────────────────
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId, role } satisfies PresenceEntry)
      }
    })

    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId, userId, role, dispatch])

  return { broadcast }
}
