/**
 * ScreenSharePanel
 *
 * Renders differently for each role:
 *
 *  SW (sharer)
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │ 🟢  You are sharing your screen          [Stop Sharing ✕]  │
 *  └─────────────────────────────────────────────────────────────┘
 *
 *  Patient (viewer) — three states:
 *    connecting  → spinner + "Waiting for screen share…"
 *    connected   → full <video> element (resizable, min/max toggle)
 *    idle        → nothing rendered
 *
 * @author Bin Lee
 */

"use client"

import { useEffect, useRef, useState } from "react"
import {
  Monitor,
  MonitorOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react"

import type { SharePeerState } from "@/hooks/use-webrtc-screenshare"

// ── SW panel ──────────────────────────────────────────────────────────────────

interface SWSharingBarProps {
  peerState: SharePeerState
  onStop: () => void
}

export function SWSharingBar({ peerState, onStop }: SWSharingBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-green-900/50 border-b border-green-700/40">
      <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
        {peerState === "connecting" ? (
          <>
            <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" />
            <span className="text-green-300">Waiting for patient to connect…</span>
          </>
        ) : peerState === "connected" ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-green-300 font-medium">Sharing your screen</span>
            <span className="text-green-600 text-xs">· Patient can see your screen</span>
          </>
        ) : (
          <>
            <MonitorOff className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-xs">Screen share connection failed</span>
          </>
        )}
      </div>
      <button
        onClick={onStop}
        className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        <MonitorOff className="w-3.5 h-3.5" />
        Stop Sharing
      </button>
    </div>
  )
}

// ── Patient viewer panel ───────────────────────────────────────────────────────

interface PatientViewerProps {
  stream: MediaStream
  peerState: SharePeerState
}

export function PatientScreenViewer({ stream, peerState }: PatientViewerProps) {
  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Attach the stream to the video element
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = stream
    el.play().catch(() => null)
    return () => {
      el.srcObject = null
    }
  }, [stream])

  // Fullscreen toggle
  function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setFullscreen(true)).catch(() => null)
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => null)
    }
  }

  useEffect(() => {
    function onFsChange() {
      setFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  return (
    <div className="flex-shrink-0 border-b border-slate-700 bg-slate-950">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80">
        <Monitor className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-medium text-slate-200 flex-1">
          Social Worker&apos;s Screen
        </span>
        {peerState === "connected" && (
          <span className="flex items-center gap-1 text-[11px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        )}
        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 text-slate-400 hover:text-white transition-colors"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {/* Fullscreen */}
        {expanded && (
          <button
            onClick={toggleFullscreen}
            className="text-slate-400 hover:text-white transition-colors"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen
              ? <Minimize2 className="w-4 h-4" />
              : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Video */}
      {expanded && (
        <div
          ref={containerRef}
          className="relative w-full bg-black"
          style={{ maxHeight: "45vh" }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
            style={{ maxHeight: "45vh" }}
          />
          {peerState !== "connected" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              <p className="text-slate-300 text-sm">Connecting to screen share…</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Patient: "connecting" placeholder (before stream arrives) ─────────────────

export function PatientConnectingBanner() {
  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
      <Loader2 className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0" />
      <span className="text-sm text-slate-300">
        Your social worker is starting the screen share…
      </span>
    </div>
  )
}
