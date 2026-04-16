/**
 * SessionRoom
 * Full collaborative session room for both SW and patient roles.
 *
 * Layout (when screen share is active):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Header: info · status · presence · controls         │ fixed
 *   ├──────────────────────────────────────────────────────┤
 *   │  [SW] SWSharingBar  OR  [Patient] PatientScreenViewer│ optional
 *   ├──────────────────────────────────────────────────────┤
 *   │  Messages (scrollable)                               │ flex-1
 *   ├──────────────────────────────────────────────────────┤
 *   │  ChatInput                                           │ sticky bottom
 *   └──────────────────────────────────────────────────────┘
 *
 * @author Bin Lee
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  ArrowLeft,
  Loader2,
  Circle,
  CheckCircle2,
  Users,
  Clock,
  AlertTriangle,
} from "lucide-react"

import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  setActiveSession,
  setMessages,
  appendMessage,
  updateActiveSession,
  resetSession,
  clearRoomState,
} from "@/lib/redux/features/collaborative-session-slice"
import { useSessionRTC } from "@/lib/collaborative-sessions/session-rtc-context"
import { useSessionRealtime }     from "@/hooks/use-session-realtime"
import { useWebRTCScreenShare }   from "@/hooks/use-webrtc-screenshare"
import { authenticatedFetch }     from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError }      from "@/lib/errors/user-facing"
import { getSafeSupabaseUser }    from "@/lib/supabase/client"
import { ChatBubble }             from "./ChatBubble"
import { ChatInput }              from "./ChatInput"
import {
  SWSharingBar,
  PatientScreenViewer,
  PatientConnectingBanner,
} from "./ScreenSharePanel"
import type {
  SessionMessage,
  SessionSummary,
  SessionStatus,
} from "@/lib/collaborative-sessions/types"

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<SessionStatus, { label: string; dot: string; text: string }> = {
  scheduled: { label: "Invited",   dot: "bg-violet-400",              text: "text-violet-300" },
  active:    { label: "Live",      dot: "bg-green-400 animate-pulse", text: "text-green-300"  },
  ended:     { label: "Ended",     dot: "bg-gray-400",                text: "text-gray-400"   },
  cancelled: { label: "Cancelled", dot: "bg-red-400",                 text: "text-red-400"    },
}

function elapsedStr(isoStart: string | null): string {
  if (!isoStart) return ""
  const secs = Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string
  role: "sw" | "patient"
  backHref: string
}

export function SessionRoom({ sessionId, role, backHref }: Props) {
  const dispatch = useAppDispatch()
  const router   = useRouter()

  const { activeSession, messages, patientOnline } = useAppSelector(
    (s) => s.collaborativeSession,
  )

  const [userId,     setUserId]     = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [elapsed,    setElapsed]    = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isActive       = activeSession?.status === "active"

  // ── Realtime chat + presence ───────────────────────────────────────────────
  const { broadcast } = useSessionRealtime({ sessionId, userId, role })

  // ── WebRTC screen share ────────────────────────────────────────────────────
  // For SW: the layout-level SWSessionProvider owns the channel — consume its
  // context to avoid a duplicate Supabase subscription.
  // For patient: no provider in their layout, so call the hook directly.
  const rtcContext = useSessionRTC()
  const rtcHook    = useWebRTCScreenShare({
    sessionId,
    userId,
    role,
    // SW: hook is a no-op (isSessionActive: false) — context is used instead
    isSessionActive: role === "patient" ? isActive : false,
  })
  const { isSharing, peerState, remoteStream, shareError, startShare, stopShare } =
    (role === "sw" && rtcContext != null) ? rtcContext : rtcHook

  // ── Elapsed timer (active sessions only) ──────────────────────────────────
  useEffect(() => {
    if (!isActive || !activeSession?.startedAt) return
    const id = setInterval(
      () => setElapsed(elapsedStr(activeSession.startedAt)),
      1000,
    )
    setElapsed(elapsedStr(activeSession.startedAt))
    return () => clearInterval(id)
  }, [isActive, activeSession?.startedAt])

  // ── Load user + session + message history ─────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError(null)

      const { user } = await getSafeSupabaseUser()
      if (user) setUserId(user.id)

      const [sessRes, msgRes] = await Promise.all([
        authenticatedFetch(`/api/sessions/${sessionId}`),
        authenticatedFetch(`/api/sessions/${sessionId}/messages?limit=50`),
      ])

      const sessData = (await sessRes.json()) as {
        ok: boolean
        session?: SessionSummary
        error?: string
      }
      if (!sessData.ok) {
        setLoadError(toUserFacingError(sessData.error, "Session not found."))
        setLoading(false)
        return
      }
      dispatch(setActiveSession(sessData.session!))

      const msgData = (await msgRes.json()) as {
        ok: boolean
        messages?: SessionMessage[]
      }
      if (msgData.ok) {
        dispatch(setMessages(msgData.messages ?? []))
      }

      setLoading(false)
    }
    load()

    // Preserve activeSession in Redux so the FloatingSessionBar + WebRTC hook
    // in the SW layout keep running after the SW navigates away from this page.
    // resetSession() is called only by the FloatingSessionBar when the session ends.
    return () => { dispatch(role === "sw" ? clearRoomState() : resetSession()) }
  }, [sessionId, dispatch, role])

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  // Attach messagesEndRef to the scroll container, then set scrollTop directly.
  // scrollIntoView({ behavior: "smooth" }) is unreliable on initial load and
  // when the sentinel is nested inside a flex child — scrollTop = scrollHeight
  // is unambiguous and works in every browser.
  useEffect(() => {
    const el = messagesEndRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // ── New message sent by THIS user ─────────────────────────────────────────
  const handleMessageSent = useCallback(
    (message: SessionMessage) => {
      dispatch(appendMessage(message))
      broadcast({ type: "new-message", message })
    },
    [dispatch, broadcast],
  )

  // ── Session lifecycle controls (SW) ───────────────────────────────────────
  async function patchStatus(newStatus: "active" | "ended" | "cancelled") {
    setActionBusy(true)
    try {
      const res  = await authenticatedFetch(`/api/sessions/${sessionId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      })
      const data = (await res.json()) as {
        ok: boolean
        session?: SessionSummary
      }
      if (!data.ok) return

      const updated = data.session!
      dispatch(updateActiveSession({
        status:    updated.status,
        startedAt: updated.startedAt,
        endedAt:   updated.endedAt,
      }))
      broadcast({
        type:      "status-change",
        status:    updated.status,
        startedAt: updated.startedAt ?? undefined,
        endedAt:   updated.endedAt   ?? undefined,
      })

      if (newStatus === "ended" || newStatus === "cancelled") {
        if (isSharing) stopShare()
        router.replace(backHref)
      }
    } finally {
      setActionBusy(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Connecting to session…</p>
        </div>
      </div>
    )
  }

  if (loadError || !activeSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 gap-4 p-6 text-center">
        <VideoOff className="w-10 h-10 text-white/40" />
        <p className="text-white/70 text-sm">{loadError ?? "Session not found."}</p>
        <Link href={backHref} className="text-xs text-violet-400 hover:text-violet-300 underline">
          ← Back
        </Link>
      </div>
    )
  }

  const statusCfg  = STATUS_CFG[activeSession.status]
  const otherParty = role === "sw" ? activeSession.patientName : activeSession.swName
  const isEnded    = activeSession.status === "ended" || activeSession.status === "cancelled"

  // Patient: show viewer when stream is present OR peer is connecting
  const showPatientViewer  = role === "patient" && !!remoteStream
  const showPatientConnect = role === "patient" && peerState === "connecting" && !remoteStream

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shadow-md z-10">

        <Link
          href={backHref}
          className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
            ${isActive ? "bg-green-500/20" : "bg-violet-500/20"}`}
        >
          <Video className={`w-4 h-4 ${isActive ? "text-green-400" : "text-violet-400"}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{otherParty}</span>

            {/* Session status */}
            <span className={`inline-flex items-center gap-1 text-xs ${statusCfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>

            {/* Elapsed */}
            {isActive && elapsed && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                {elapsed}
              </span>
            )}

            {/* Screen share state badge (SW) */}
            {role === "sw" && isSharing && peerState === "connected" && (
              <span className="inline-flex items-center gap-1 text-xs text-green-400">
                <Monitor className="w-3 h-3" />
                Sharing
              </span>
            )}
          </div>

          {/* Presence / connection sub-line */}
          {role === "sw" && !isEnded && (
            <div className="flex items-center gap-1 mt-0.5">
              {patientOnline ? (
                <span className="flex items-center gap-1 text-[11px] text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Patient is online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Circle className="w-3 h-3" />
                  Waiting for patient…
                </span>
              )}
            </div>
          )}

          {role === "patient" && isActive && (
            <span className="flex items-center gap-1 text-[11px] text-green-400 mt-0.5">
              <Users className="w-3 h-3" />
              Connected with {activeSession.swName}
            </span>
          )}
        </div>

        {/* ── SW action buttons ─────────────────────────────────────────── */}
        {role === "sw" && (
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Start Session */}
            {activeSession.status === "scheduled" && (
              <button
                onClick={() => patchStatus("active")}
                disabled={actionBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {actionBusy
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Video   className="w-3.5 h-3.5" />}
                Start Session
              </button>
            )}

            {/* Screen share controls (active only) */}
            {activeSession.status === "active" && (
              <>
                {isSharing ? (
                  <button
                    onClick={stopShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <MonitorOff className="w-3.5 h-3.5" />
                    Stop Share
                  </button>
                ) : (
                  <button
                    onClick={startShare}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Share Screen
                  </button>
                )}
              </>
            )}

            {/* End Session */}
            {activeSession.status === "active" && (
              <button
                onClick={() => patchStatus("ended")}
                disabled={actionBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {actionBusy
                  ? <Loader2  className="w-3.5 h-3.5 animate-spin" />
                  : <VideoOff className="w-3.5 h-3.5" />}
                End Session
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Context banners ───────────────────────────────────────────────── */}
      {activeSession.status === "scheduled" && (
        <div className="flex-shrink-0 px-4 py-2.5 text-xs text-center bg-violet-900/40 text-violet-300">
          {role === "sw"
            ? "Session is scheduled — click Start Session when you're ready."
            : `${activeSession.swName} has invited you to a session. It will begin shortly.`}
        </div>
      )}

      {isEnded && (
        <div className="flex-shrink-0 px-4 py-2.5 text-xs text-center bg-slate-700/50 text-slate-400">
          This session has ended. The chat history is read-only.
        </div>
      )}

      {/* ── Screen share: SW sharing bar ─────────────────────────────────── */}
      {role === "sw" && isSharing && (
        <SWSharingBar peerState={peerState} onStop={stopShare} />
      )}

      {/* ── Screen share: SW error ────────────────────────────────────────── */}
      {role === "sw" && shareError && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-900/40 border-b border-red-700/40 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {shareError}
        </div>
      )}

      {/* ── Screen share: patient connecting placeholder ──────────────────── */}
      {showPatientConnect && <PatientConnectingBanner />}

      {/* ── Screen share: patient video viewer ───────────────────────────── */}
      {showPatientViewer && remoteStream && (
        <PatientScreenViewer stream={remoteStream} peerState={peerState} />
      )}

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      {/* ref lives on the scroll container itself so useEffect can do
          el.scrollTop = el.scrollHeight — the only 100% reliable way to
          pin to bottom across browsers without CSS tricks               */}
      <div ref={messagesEndRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
            <Video className="w-8 h-8 opacity-30" />
            <p className="text-sm text-center">
              {isActive
                ? "No messages yet — say hello!"
                : "Chat will be available once the session starts."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...messages]
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.senderId === userId}
                  sessionId={sessionId}
                />
              ))}
          </div>
        )}
      </div>

      {/* ── Chat input ────────────────────────────────────────────────────── */}
      {!isEnded && (
        <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-slate-800 border-t border-slate-700">
          <ChatInput
            sessionId={sessionId}
            disabled={!isActive}
            onMessageSent={handleMessageSent}
          />
        </div>
      )}
    </div>
  )
}
