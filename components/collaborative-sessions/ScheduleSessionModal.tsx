/**
 * Modal for social workers to schedule or immediately invite a patient to a session.
 * @author Bin Lee
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { X, Video, Calendar, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSupabaseClient } from "@/lib/supabase/client"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { useAppDispatch } from "@/lib/redux/hooks"
import { upsertSession } from "@/lib/redux/features/collaborative-session-slice"
import type { SessionSummary } from "@/lib/collaborative-sessions/types"

interface Patient {
  patient_user_id: string
  email: string
  first_name: string | null
  last_name: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Pre-select a patient (e.g. opened from the patient detail page) */
  preselectedPatient?: { userId: string; name: string }
}

export function ScheduleSessionModal({ open, onClose, preselectedPatient }: Props) {
  const dispatch = useAppDispatch()

  const [patients, setPatients] = useState<Patient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)

  const [patientUserId, setPatientUserId] = useState(preselectedPatient?.userId ?? "")
  const [scheduledAt, setScheduledAt] = useState("")
  const [inviteMessage, setInviteMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstInputRef = useRef<HTMLSelectElement>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return
    setPatientUserId(preselectedPatient?.userId ?? "")
    setScheduledAt("")
    setInviteMessage("")
    setError(null)
    setPatientsLoading(true)

    authenticatedFetch("/api/social-worker/patients")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPatients(data.patients)
      })
      .catch(() => null)
      .finally(() => setPatientsLoading(false))

    setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [open, preselectedPatient?.userId])

  if (!open) return null

  const patientName = (p: Patient) =>
    [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientUserId) {
      setError("Please select a patient.")
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await authenticatedFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientUserId,
          scheduledAt: scheduledAt || null,
          inviteMessage: inviteMessage.trim() || null,
        }),
      })
      const data = (await res.json()) as { ok: boolean; session?: SessionSummary; error?: string }

      if (!data.ok) {
        setError(toUserFacingError(data.error, "Failed to create session."))
        return
      }

      dispatch(upsertSession(data.session!))

      // Notify the patient in real-time — no page refresh needed
      const supabase = getSupabaseClient()
      const ch = supabase.channel(`patient-invites-${patientUserId}`)
      await ch.subscribe()
      ch.send({
        type: "broadcast",
        event: "new-session",
        payload: { session: data.session },
      })
      void supabase.removeChannel(ch)

      onClose()
    } catch (error) {
      setError(toUserFacingError(error, "Failed to create session."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="bg-violet-100 p-1.5 rounded-lg">
              <Video className="w-4 h-4 text-violet-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Schedule Session</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Patient selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Patient <span className="text-red-500">*</span>
            </label>
            {preselectedPatient ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-900">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                  {preselectedPatient.name[0].toUpperCase()}
                </div>
                {preselectedPatient.name}
              </div>
            ) : (
              <select
                ref={firstInputRef}
                value={patientUserId}
                onChange={(e) => setPatientUserId(e.target.value)}
                disabled={patientsLoading}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-gray-50"
              >
                <option value="">
                  {patientsLoading ? "Loading patients…" : "Select a patient"}
                </option>
                {patients.map((p) => (
                  <option key={p.patient_user_id} value={p.patient_user_id}>
                    {patientName(p)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Optional scheduled time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline-block mr-1 text-gray-400" />
              Schedule for (optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave blank to send an ad-hoc invite with no scheduled time.
            </p>
          </div>

          {/* Optional message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Personal note (optional)
            </label>
            <textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="e.g. We'll go over your MassHealth renewal together."
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !patientUserId}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Sending…</>
              ) : (
                <><Video className="w-3.5 h-3.5 mr-1.5" />Send Invitation</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
