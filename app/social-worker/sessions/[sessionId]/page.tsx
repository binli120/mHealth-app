/**
 * Social Worker — Session room page
 * @author Bin Lee
 */

"use client"

import { use } from "react"
import { SessionRoom } from "@/components/collaborative-sessions/SessionRoom"
import type { SessionPageProps } from "./page.types"

export default function SWSessionRoomPage({ params }: SessionPageProps) {
  const { sessionId } = use(params)

  return (
    <SessionRoom
      sessionId={sessionId}
      role="sw"
      backHref="/social-worker/sessions"
    />
  )
}
