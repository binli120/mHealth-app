"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Search, ArrowRight, Users, MapPin, Phone, Calendar,
  ChevronDown, X, Filter, MessageCircle,
} from "lucide-react"
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status"
import {
  SOCIAL_WORKER_CITIZENSHIP_LABELS,
  SOCIAL_WORKER_PATIENT_STATUS_FILTER_OPTIONS,
  SOCIAL_WORKER_PATIENT_STATUS_STYLES,
} from "@/lib/social-worker/constants"
import type { SocialWorkerPatient, SocialWorkerPatientStatusFilter } from "@/lib/social-worker/types"
import { getAgeFromDateOfBirth, getSocialWorkerPatientDisplayName } from "@/lib/social-worker/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getSupabaseClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SwDirectChatPanel, type DirectMessage } from "@/components/chat/sw-direct-chat-panel"

export default function SocialWorkerPatientsPage() {
  const [patients, setPatients] = useState<SocialWorkerPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SocialWorkerPatientStatusFilter>("")
  const [cityFilter, setCityFilter] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [chatPatient, setChatPatient] = useState<SocialWorkerPatient | null>(null)
  // Persist messages per patient so reopening the dialog doesn't flash a loading state.
  // The ref holds the cache; chatInitialMessages carries the snapshot into the panel
  // so we never read ref.current during render (react-hooks/refs).
  const messageCacheRef = useRef<Record<string, DirectMessage[]>>({})
  const [chatInitialMessages, setChatInitialMessages] = useState<DirectMessage[] | undefined>(undefined)

  // Get the SW's own user ID for the chat panel
  useEffect(() => {
    getSupabaseClient().auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    authenticatedFetch("/api/social-worker/patients")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setPatients(data.patients) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  // Unique cities for filter
  const cities = Array.from(new Set(patients.map((p) => p.city).filter(Boolean))).sort() as string[]

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      getSocialWorkerPatientDisplayName(p).toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.city ?? "").toLowerCase().includes(q) ||
      (p.phone ?? "").includes(q)

    const matchStatus = !statusFilter ||
      (statusFilter === "no_applications"
        ? p.application_count === 0
        : p.latest_application_status === statusFilter)

    const matchCity = !cityFilter || p.city === cityFilter

    return matchSearch && matchStatus && matchCity
  })

  const hasFilters = statusFilter || cityFilter

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Patients</h1>
        <p className="text-gray-500 text-sm mt-1">
          {patients.length} active patient{patients.length !== 1 ? "s" : ""} who have granted you access
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, city, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SocialWorkerPatientStatusFilter)}
            className="pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
          >
            {SOCIAL_WORKER_PATIENT_STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {cities.length > 0 && (
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            >
              <option value="">All Cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        )}

        {hasFilters && (
          <button
            onClick={() => { setStatusFilter(""); setCityFilter("") }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Results count when filtering */}
      {(search || hasFilters) && !loading && (
        <p className="text-xs text-gray-500 mb-3">
          Showing {filtered.length} of {patients.length} patients
        </p>
      )}

      {/* Patient cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400 text-sm">
          Loading patients…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400 text-sm">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          {search || hasFilters
            ? "No patients match your search or filters."
            : "No patients yet. Patients can add you from their dashboard."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.access_id}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              {/* Left: avatar + core info */}
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-base font-semibold text-blue-700">
                  {(p.first_name?.[0] ?? p.email[0]).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{getSocialWorkerPatientDisplayName(p)}</span>
                    {p.dob && (
                      <span className="text-xs text-gray-400">Age {getAgeFromDateOfBirth(p.dob)}</span>
                    )}
                    {p.citizenship_status && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {SOCIAL_WORKER_CITIZENSHIP_LABELS[p.citizenship_status] ?? p.citizenship_status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">{p.email}</span>
                    {p.phone && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />{p.phone}
                      </span>
                    )}
                    {p.city && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />{p.city}, {p.state}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: stats + status + actions */}
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  Since {new Date(p.granted_at).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {p.application_count} app{p.application_count !== 1 ? "s" : ""}
                </div>
                {p.latest_application_status ? (
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SOCIAL_WORKER_PATIENT_STATUS_STYLES[p.latest_application_status] ?? "bg-gray-100 text-gray-600"}`}>
                    {APPLICATION_STATUS_LABELS[p.latest_application_status] ?? p.latest_application_status.replace(/_/g, " ")}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">no apps</span>
                )}
                {/* Chat button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    // Read ref in event handler (not render) — safe per react-hooks/refs
                    setChatInitialMessages(messageCacheRef.current[p.patient_user_id])
                    setChatPatient(p)
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                  title={`Chat with ${getSocialWorkerPatientDisplayName(p)}`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chat
                </button>
                <Link
                  href={`/social-worker/patients/${p.patient_user_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center"
                >
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Direct chat dialog */}
      <Dialog
        open={!!chatPatient}
        onOpenChange={(open) => {
          if (!open) {
            setChatPatient(null)
            setChatInitialMessages(undefined)
          }
        }}
      >
        <DialogContent className="flex h-[600px] max-h-[90vh] flex-col gap-0 p-0 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>
              Chat with {chatPatient ? getSocialWorkerPatientDisplayName(chatPatient) : "Patient"}
            </DialogTitle>
          </DialogHeader>
          {chatPatient && currentUserId && (
            <SwDirectChatPanel
              swUserId={chatPatient.patient_user_id}
              swName={getSocialWorkerPatientDisplayName(chatPatient)}
              currentUserId={currentUserId}
              contactRole="Patient"
              initialMessages={chatInitialMessages}
              onMessagesChange={(msgs) => {
                messageCacheRef.current[chatPatient.patient_user_id] = msgs
              }}
              onBack={() => {
                setChatPatient(null)
                setChatInitialMessages(undefined)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
