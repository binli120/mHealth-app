/**
 * useWebRTCScreenShare
 *
 * One-way screen share: SW (offerer) → Patient (answerer/viewer).
 * Signaling via dedicated Supabase Broadcast channel `session-webrtc-{id}`.
 *
 * Race-condition fix: patient broadcasts "patient-ready" once their channel
 * subscription is confirmed. If the SW is already sharing, it re-sends the
 * offer immediately so the patient doesn't stay spinning forever.
 *
 * @author Bin Lee
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { getSupabaseClient } from "@/lib/supabase/client"

// ── ICE / STUN ────────────────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
]

// ── Signal event shapes ───────────────────────────────────────────────────────

type SignalOffer        = { type: "offer";          sdp: string }
type SignalAnswer       = { type: "answer";         sdp: string }
type SignalIce          = { type: "ice";            candidate: RTCIceCandidateInit }
type SignalShareStarted = { type: "share-started" }
type SignalShareStopped = { type: "share-stopped" }
/** Patient → SW: channel is subscribed and ready to receive an offer */
type SignalPatientReady = { type: "patient-ready" }

type SignalEvent =
  | SignalOffer | SignalAnswer | SignalIce
  | SignalShareStarted | SignalShareStopped | SignalPatientReady

// ── Public types ──────────────────────────────────────────────────────────────

export type SharePeerState = "idle" | "connecting" | "connected" | "failed"

export interface WebRTCScreenShareResult {
  isSharing:    boolean
  peerState:    SharePeerState
  remoteStream: MediaStream | null
  shareError:   string | null
  startShare:   () => Promise<void>
  stopShare:    () => void
}

interface Options {
  sessionId:       string
  userId:          string | null
  role:            "sw" | "patient"
  isSessionActive: boolean
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWebRTCScreenShare({
  sessionId,
  userId,
  role,
  isSessionActive,
}: Options): WebRTCScreenShareResult {

  const [isSharing,    setIsSharing]    = useState(false)
  const [peerState,    setPeerState]    = useState<SharePeerState>("idle")
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [shareError,   setShareError]   = useState<string | null>(null)

  // Refs — stable references safe to access from async callbacks
  const channelRef         = useRef<RealtimeChannel | null>(null)
  const pcRef              = useRef<RTCPeerConnection | null>(null)
  const displayStreamRef   = useRef<MediaStream | null>(null)
  const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([])
  const hasRemoteDesc      = useRef(false)

  /**
   * Mirrors isSharing in a ref so channel handlers (captured at mount)
   * can read the latest value without stale closures.
   */
  const isSharingRef = useRef(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  function signal(event: SignalEvent) {
    channelRef.current?.send({
      type:    "broadcast",
      event:   event.type,
      payload: event,
    })
  }

  async function drainIceCandidates() {
    const pc = pcRef.current
    if (!pc) return
    const buffered = iceCandidateBuffer.current.splice(0)
    for (const c of buffered) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => null)
    }
  }

  function teardown() {
    displayStreamRef.current?.getTracks().forEach((t) => t.stop())
    displayStreamRef.current = null

    pcRef.current?.close()
    pcRef.current = null

    iceCandidateBuffer.current = []
    hasRemoteDesc.current      = false
    isSharingRef.current       = false

    setIsSharing(false)
    setRemoteStream(null)
    setPeerState("idle")
  }

  function buildPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) signal({ type: "ice", candidate: candidate.toJSON() })
    }

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connecting":
          setPeerState("connecting")
          break
        case "connected":
          setPeerState("connected")
          break
        case "failed":
        case "disconnected":
          setPeerState("failed")
          break
        case "closed":
          setPeerState("idle")
          break
      }
    }

    // Also watch ICE state as a fallback (connectionState can lag)
    pc.oniceconnectionstatechange = () => {
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setPeerState("connected")
      } else if (pc.iceConnectionState === "failed") {
        setPeerState("failed")
      }
    }

    if (role === "patient") {
      pc.ontrack = ({ streams }) => {
        const stream = streams[0]
        if (stream) {
          setRemoteStream(stream)
          setPeerState("connected")
        }
      }
    }

    pcRef.current = pc
    return pc
  }

  /**
   * (Re-)create the PC, attach current display tracks, and broadcast offer.
   * Called both from startShare and from "patient-ready" handler.
   */
  async function sendOffer() {
    const stream = displayStreamRef.current
    if (!stream) return

    // Close previous PC if re-offering (patient-ready re-trigger)
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current              = null
      hasRemoteDesc.current      = false
      iceCandidateBuffer.current = []
    }

    const pc = buildPeerConnection()

    stream.getVideoTracks().forEach((track) => {
      pc.addTrack(track, stream)
      // Browser "Stop sharing" button
      track.onended = () => {
        signal({ type: "share-stopped" })
        teardown()
      }
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    signal({ type: "offer", sdp: offer.sdp! })
  }

  // ── SW: start share ───────────────────────────────────────────────────────

  const startShare = useCallback(async () => {
    if (!isSessionActive || isSharing) return
    setShareError(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } } as MediaTrackConstraints,
        audio: false,
      })
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : ""
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setShareError(
          err instanceof Error ? err.message : "Screen share unavailable.",
        )
      }
      return
    }

    displayStreamRef.current = stream
    isSharingRef.current     = true
    setIsSharing(true)
    setPeerState("connecting")

    // Announce to patient (so their "connecting" spinner appears)
    signal({ type: "share-started" })

    try {
      await sendOffer()
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to create offer.")
      teardown()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive, isSharing])

  // ── SW: stop share ────────────────────────────────────────────────────────

  const stopShare = useCallback(() => {
    signal({ type: "share-stopped" })
    teardown()
  }, [])

  // ── Supabase signaling channel ────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId || !userId || !isSessionActive) return

    const supabase = getSupabaseClient()
    const channel  = supabase.channel(`session-webrtc-${sessionId}`, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = channel

    // ── offer → patient responds with answer ──────────────────────────────
    channel.on(
      "broadcast",
      { event: "offer" },
      async ({ payload }: { payload: SignalOffer }) => {
        if (role !== "patient") return

        const pc = buildPeerConnection()
        setPeerState("connecting")

        try {
          await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp })
          hasRemoteDesc.current = true
          await drainIceCandidates()

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          signal({ type: "answer", sdp: answer.sdp! })
        } catch (err) {
          console.error("[WebRTC] offer handling failed:", err)
          setPeerState("failed")
        }
      },
    )

    // ── answer → SW completes handshake ───────────────────────────────────
    channel.on(
      "broadcast",
      { event: "answer" },
      async ({ payload }: { payload: SignalAnswer }) => {
        if (role !== "sw" || !pcRef.current) return

        try {
          await pcRef.current.setRemoteDescription({
            type: "answer",
            sdp:  payload.sdp,
          })
          hasRemoteDesc.current = true
          await drainIceCandidates()
        } catch (err) {
          console.error("[WebRTC] answer handling failed:", err)
        }
      },
    )

    // ── ICE candidates (both directions) ──────────────────────────────────
    channel.on(
      "broadcast",
      { event: "ice" },
      async ({ payload }: { payload: SignalIce }) => {
        if (hasRemoteDesc.current && pcRef.current) {
          await pcRef.current
            .addIceCandidate(new RTCIceCandidate(payload.candidate))
            .catch(() => null)
        } else {
          iceCandidateBuffer.current.push(payload.candidate)
        }
      },
    )

    // ── share-started: patient shows connecting spinner ───────────────────
    channel.on("broadcast", { event: "share-started" }, () => {
      if (role === "patient") setPeerState("connecting")
    })

    // ── share-stopped: patient clears video ───────────────────────────────
    channel.on("broadcast", { event: "share-stopped" }, () => {
      if (role === "patient") teardown()
    })

    // ── patient-ready: SW re-sends offer if currently sharing ─────────────
    // This fires when the patient's channel subscription is confirmed,
    // which can happen AFTER the SW already sent the original offer.
    // Re-offering ensures the patient is never stuck spinning.
    channel.on("broadcast", { event: "patient-ready" }, async () => {
      if (role !== "sw" || !isSharingRef.current || !displayStreamRef.current) return
      try {
        await sendOffer()
      } catch (err) {
        console.error("[WebRTC] re-offer (patient-ready) failed:", err)
      }
    })

    // When this side's subscription is confirmed…
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return

      if (role === "patient") {
        // Tell the SW we're ready — handles the race where offer arrived
        // before our subscription was established
        signal({ type: "patient-ready" })
      }
    })

    return () => {
      teardown()
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  // buildPeerConnection / teardown / sendOffer / signal / drainIceCandidates
  // only access refs — safe to capture at mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, role, isSessionActive])

  return { isSharing, peerState, remoteStream, shareError, startShare, stopShare }
}
