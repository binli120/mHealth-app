/**
 * Social Worker — Session room page
 * @author Bin Lee
 */

"use client"

import { use } from "react"
import { SessionRoom } from "@/components/collaborative-sessions/SessionRoom"

interface Props {
  params: Promise<{ sessionId: string }>
}

export default function SWSessionRoomPage({ params }: Props) {
  const { sessionId } = use(params)

  return (
    <SessionRoom
      sessionId={sessionId}
      role="sw"
      backHref="/social-worker/sessions"
    />
  )
}
