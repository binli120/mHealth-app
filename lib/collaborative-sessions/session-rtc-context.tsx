/**
 * React context that shares the layout-level WebRTC screen share state
 * with any descendant component (e.g. SessionRoom).
 *
 * The SW layout mounts SWSessionProvider (in FloatingSessionBar.tsx) which
 * calls useWebRTCScreenShare once and provides the result here.
 * SessionRoom consumes this instead of calling the hook a second time,
 * avoiding duplicate Supabase channel subscriptions.
 *
 * @author Bin Lee
 */

"use client"

import { createContext, useContext } from "react"
import type { WebRTCScreenShareResult } from "@/hooks/use-webrtc-screenshare"

export const SessionRTCContext = createContext<WebRTCScreenShareResult | null>(null)

/** Returns layout-provided WebRTC state, or null if not inside SWSessionProvider */
export const useSessionRTC = () => useContext(SessionRTCContext)
