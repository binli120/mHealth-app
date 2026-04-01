/**
 * Prominently surfaces pending session invites at the top of the patient dashboard.
 * @author Bin Lee
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Video, X, ArrowRight } from "lucide-react"

import { formatShortDateTime } from "@/lib/utils/format"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSupabaseClient, getSafeSupabaseUser } from "@/lib/supabase/client"
import type { SessionSummary } from "@/lib/collaborative-sessions/types"

export function SessionInviteBanner() {
  const [invites, setInvites] = useState<SessionSummary[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Initial fetch
    authenticatedFetch("/api/sessions?role=patient")
      .then((r) => r.json())
      .then((data: { ok: boolean; sessions?: SessionSummary[] }) => {
        if (data.ok) {
          const pending = (data.sessions ?? []).filter(
            (s) => s.status === "scheduled" || s.status === "active",
          )
          setInvites(pending)
        }
      })
      .catch(() => null)
  }, [])

  // Real-time: subscribe to new session invites broadcast by the SW
  useEffect(() => {
    let cleanup: (() => void) | undefined

    getSafeSupabaseUser().then(({ user }) => {
      if (!user) return
      const supabase = getSupabaseClient()
      const channel = supabase.channel(`patient-invites-${user.id}`)

      channel.on(
        "broadcast",
        { event: "new-session" },
        ({ payload }: { payload: { session: SessionSummary } }) => {
          if (!payload?.session) return
          setInvites((prev) => {
            if (prev.find((s) => s.id === payload.session.id)) return prev
            return [payload.session, ...prev]
          })
        },
      )

      channel.subscribe()
      cleanup = () => { void supabase.removeChannel(channel) }
    })

    return () => cleanup?.()
  }, [])

  const visible = invites.filter((s) => !dismissed.has(s.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-6">
      {visible.map((session) => {
        const isLive = session.status === "active"
        return (
          <div
            key={session.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm
              ${isLive
                ? "bg-green-50 border-green-200"
                : "bg-violet-50 border-violet-200"
              }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                ${isLive ? "bg-green-100" : "bg-violet-100"}`}
            >
              <Video
                className={`w-4 h-4 ${isLive ? "text-green-600" : "text-violet-600"}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <span className={`font-semibold ${isLive ? "text-green-800" : "text-violet-900"}`}>
                {isLive
                  ? `${session.swName} has started your session`
                  : `${session.swName} invited you to a session`}
              </span>
              {session.scheduledAt && !isLive && (
                <span className="text-violet-600 ml-1.5 text-xs">
                  · {formatShortDateTime(session.scheduledAt)}
                </span>
              )}
            </div>

            <Link
              href={`/customer/sessions/${session.id}`}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors
                ${isLive
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-violet-600 hover:bg-violet-700"
                }`}
            >
              {isLive ? "Join Now" : "View"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {!isLive && (
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, session.id]))}
                className="flex-shrink-0 text-violet-400 hover:text-violet-600 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
