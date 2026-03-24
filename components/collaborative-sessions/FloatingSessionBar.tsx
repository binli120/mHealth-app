/**
 * SWSessionProvider — mounts the WebRTC hook at layout level so screen share
 * persists as the SW navigates between pages (dashboard → patient application).
 *
 * FloatingSessionBar — compact overlay shown on every SW page (except the
 * session room itself) while a session is active. Lets the SW start/stop
 * screen share and jump to chat without going back to the session room.
 *
 * @author Bin Lee
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Monitor,
  MonitorOff,
  MessageCircle,
  VideoOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"

import { useWebRTCScreenShare } from "@/hooks/use-webrtc-screenshare"
import { SessionRTCContext }    from "@/lib/collaborative-sessions/session-rtc-context"
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks"
import { resetSession }         from "@/lib/redux/features/collaborative-session-slice"
import { getSafeSupabaseUser }  from "@/lib/supabase/client"
import { authenticatedFetch }   from "@/lib/supabase/authenticated-fetch"
import type { SessionSummary }  from "@/lib/collaborative-sessions/types"

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Wraps SW layout content with a single long-lived WebRTC hook instance.
 * Renders FloatingSessionBar as a fixed overlay whenever a session is active
 * and the SW is NOT already on that session's room page.
 */
export function SWSessionProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const { activeSession } = useAppSelector((s) => s.collaborativeSession)
  const [userId, setUserId] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    getSafeSupabaseUser().then(({ user }) => setUserId(user?.id ?? null))
  }, [])

  const isSessionActive = activeSession?.status === "active"

  const webrtc = useWebRTCScreenShare({
    sessionId:       activeSession?.id ?? "",
    userId,
    role:            "sw",
    isSessionActive,
  })

  // Hide the floating bar when the SW is already inside that session's room page
  // — the room's own controls are sufficient there
  const isOnThisSessionRoom =
    activeSession != null &&
    pathname.includes(`/sessions/${activeSession.id}`)

  return (
    <SessionRTCContext.Provider value={webrtc}>
      {children}
      {isSessionActive && !isOnThisSessionRoom && (
        <FloatingSessionBar
          session={activeSession}
          webrtc={webrtc}
          onEnded={() => dispatch(resetSession())}
        />
      )}
    </SessionRTCContext.Provider>
  )
}

// ── Floating bar UI ───────────────────────────────────────────────────────────

interface Props {
  session: SessionSummary
  webrtc:  ReturnType<typeof useWebRTCScreenShare>
  onEnded: () => void
}

function FloatingSessionBar({ session, webrtc, onEnded }: Props) {
  const [ending, setEnding] = useState(false)
  const { isSharing, peerState, shareError, startShare, stopShare } = webrtc

  async function endSession() {
    setEnding(true)
    if (isSharing) stopShare()
    try {
      await authenticatedFetch(`/api/sessions/${session.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "ended" }),
      })
    } finally {
      onEnded()
      setEnding(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl text-white w-64 overflow-hidden">

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        <span className="text-xs font-semibold truncate flex-1">{session.patientName}</span>
        <span className="text-[10px] text-green-400 flex-shrink-0">LIVE</span>
      </div>

      {/* Screen share status line */}
      {isSharing && (
        <div className="px-3 pb-1.5 flex items-center gap-1.5 text-[11px]">
          {peerState === "connected" ? (
            <><CheckCircle2 className="w-3 h-3 text-green-400" /><span className="text-green-400">Patient can see your screen</span></>
          ) : peerState === "connecting" ? (
            <><Loader2 className="w-3 h-3 text-slate-400 animate-spin" /><span className="text-slate-400">Connecting to patient…</span></>
          ) : peerState === "failed" ? (
            <><AlertTriangle className="w-3 h-3 text-red-400" /><span className="text-red-400">Connection failed — retry</span></>
          ) : null}
        </div>
      )}

      {shareError && (
        <p className="px-3 pb-1.5 text-[11px] text-red-400">{shareError}</p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1.5 px-3 pb-3">
        {/* Share / Stop */}
        {isSharing ? (
          <button
            onClick={stopShare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-xs font-medium transition-colors flex-1"
          >
            <MonitorOff className="w-3.5 h-3.5" />
            Stop Share
          </button>
        ) : (
          <button
            onClick={startShare}
            disabled={peerState === "connecting"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-medium transition-colors flex-1 disabled:opacity-60"
          >
            <Monitor className="w-3.5 h-3.5" />
            {peerState === "connecting" ? "Connecting…" : "Share Screen"}
          </button>
        )}

        {/* Chat */}
        <Link
          href={`/social-worker/sessions/${session.id}`}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors"
          title="Open chat"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </Link>

        {/* End session */}
        <button
          onClick={endSession}
          disabled={ending}
          title="End session"
          className="flex items-center justify-center px-2.5 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-60"
        >
          {ending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <VideoOff className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}
