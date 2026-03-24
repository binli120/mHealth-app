/**
 * Social Worker — Sessions list page
 * @author Bin Lee
 */

"use client"

import { useState } from "react"
import { Video, Plus } from "lucide-react"

import { SessionListPanel } from "@/components/collaborative-sessions/SessionListPanel"
import { ScheduleSessionModal } from "@/components/collaborative-sessions/ScheduleSessionModal"
import { Button } from "@/components/ui/button"

export default function SWSessionsPage() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Video className="w-6 h-6 text-violet-500" />
            Sessions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Screen-share and chat sessions with your patients
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Session
        </Button>
      </div>

      <SessionListPanel role="sw" />

      <ScheduleSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
