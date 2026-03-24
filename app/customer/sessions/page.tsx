/**
 * Patient — Sessions list page
 * @author Bin Lee
 */

"use client"

import { Video } from "lucide-react"
import { SessionListPanel } from "@/components/collaborative-sessions/SessionListPanel"

export default function CustomerSessionsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Video className="w-6 h-6 text-violet-500" />
          My Sessions
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Screen-share sessions with your social worker
        </p>
      </div>

      <SessionListPanel role="patient" />
    </div>
  )
}
