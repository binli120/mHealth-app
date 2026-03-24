/**
 * Renders a list of sessions with accept/decline actions for patients.
 * @author Bin Lee
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { Video } from "lucide-react"

import { SessionCard } from "./SessionCard"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  setSessions,
  upsertSession,
  removeSession,
  setLoading,
  setError,
} from "@/lib/redux/features/collaborative-session-slice"
import type { SessionSummary } from "@/lib/collaborative-sessions/types"

interface Props {
  role: "sw" | "patient"
}

export function SessionListPanel({ role }: Props) {
  const dispatch = useAppDispatch()
  const { sessions, loading, error } = useAppSelector((s) => s.collaborativeSession)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    dispatch(setLoading(true))
    try {
      const res = await authenticatedFetch(`/api/sessions?role=${role}`)
      const data = (await res.json()) as { ok: boolean; sessions?: SessionSummary[]; error?: string }
      if (data.ok) {
        dispatch(setSessions(data.sessions ?? []))
      } else {
        dispatch(setError(data.error ?? "Failed to load sessions."))
      }
    } catch {
      dispatch(setError("Network error loading sessions."))
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch, role])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleAccept = useCallback(
    async (sessionId: string) => {
      // For patients "accept" means they navigate to the room page — no status change needed.
      // We route them directly. Keep this as a no-op accept (UI goes to SessionCard link).
      // This handler is wired for future explicit accept flow if desired.
      void sessionId
    },
    [],
  )

  const handleDelete = useCallback(
    async (sessionId: string) => {
      setDeletingId(sessionId)
      try {
        const res = await authenticatedFetch(`/api/sessions/${sessionId}`, { method: "DELETE" })
        const data = (await res.json()) as { ok: boolean }
        if (data.ok) {
          dispatch(removeSession(sessionId))
        }
      } catch {
        // silent — card stays in current state
      } finally {
        setDeletingId(null)
      }
    },
    [dispatch],
  )

  const handleDecline = useCallback(
    async (sessionId: string) => {
      setAcceptingId(sessionId)
      try {
        const res = await authenticatedFetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        })
        const data = (await res.json()) as { ok: boolean; session?: SessionSummary }
        if (data.ok && data.session) {
          dispatch(upsertSession(data.session))
        }
      } catch {
        // silent — card stays in current state
      } finally {
        setAcceptingId(null)
      }
    },
    [dispatch],
  )

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading sessions…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500 text-sm">
        {error}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center mb-3">
          <Video className="w-6 h-6 text-violet-400" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No sessions yet</p>
        <p className="text-xs text-gray-400">
          {role === "sw"
            ? "Schedule a session with a patient to get started."
            : "Your social worker will invite you to a session."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          role={role}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onDelete={handleDelete}
          accepting={acceptingId === session.id}
          deleting={deletingId === session.id}
        />
      ))}
    </div>
  )
}
