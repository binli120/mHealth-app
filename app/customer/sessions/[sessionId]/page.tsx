/**
 * Patient — Session room page
 * @author Bin Lee
 */

"use client"

import { use } from "react"
import { SessionRoom } from "@/components/collaborative-sessions/SessionRoom"

interface Props {
  params: Promise<{ sessionId: string }>
}

export default function CustomerSessionRoomPage({ params }: Props) {
  const { sessionId } = use(params)

  return (
    <SessionRoom
      sessionId={sessionId}
      role="patient"
      backHref="/customer/sessions"
    />
  )
}
