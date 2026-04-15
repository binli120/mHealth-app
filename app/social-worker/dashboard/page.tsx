"use client"

/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, FileText, ArrowRight, MapPin } from "lucide-react"
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status"
import { SOCIAL_WORKER_PATIENT_STATUS_STYLES } from "@/lib/social-worker/constants"
import type { SocialWorkerPatient } from "@/lib/social-worker/types"
import { getSocialWorkerPatientDisplayName } from "@/lib/social-worker/utils"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

export default function SocialWorkerDashboardPage() {
  const [patients, setPatients] = useState<SocialWorkerPatient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authenticatedFetch("/api/social-worker/patients")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPatients(data.patients)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  const activeApps = patients.reduce((sum, p) => sum + p.application_count, 0)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your assigned patients</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="bg-blue-50 p-2.5 rounded-lg">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{patients.length}</div>
            <div className="text-xs text-gray-500">Active Patients</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="bg-emerald-50 p-2.5 rounded-lg">
            <FileText className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{activeApps}</div>
            <div className="text-xs text-gray-500">Total Applications</div>
          </div>
        </div>
      </div>

      {/* Recent patients */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Patients</h2>
          <Link
            href="/social-worker/patients"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : patients.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No patients yet. Patients can add you from their dashboard.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {patients.slice(0, 8).map((p) => (
              <Link
                key={p.access_id}
                href={`/social-worker/patients/${p.patient_user_id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-sm font-medium text-blue-700">
                  {(p.first_name?.[0] ?? p.email[0]).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{getSocialWorkerPatientDisplayName(p)}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="truncate">{p.email}</span>
                      {p.city && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          <MapPin className="w-3 h-3" />{p.city}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-xs text-gray-500">{p.application_count} apps</div>
                  {p.latest_application_status && (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SOCIAL_WORKER_PATIENT_STATUS_STYLES[p.latest_application_status] ?? "bg-gray-100 text-gray-600"}`}>
                      {APPLICATION_STATUS_LABELS[p.latest_application_status] ?? p.latest_application_status.replace("_", " ")}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
