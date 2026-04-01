/**
 * Single session card — used in both SW list and patient list.
 * @author Bin Lee
 */

"use client"

import Link from "next/link"
import { Video, Calendar, Clock, CheckCircle2, XCircle, ArrowRight, Trash2 } from "lucide-react"

import type { SessionSummary, SessionStatus } from "@/lib/collaborative-sessions/types"
import { formatShortDateTime } from "@/lib/utils/format"

interface Props {
  session: SessionSummary
  role: "sw" | "patient"
  onAccept?: (sessionId: string) => void
  onDecline?: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  accepting?: boolean
  deleting?: boolean
}

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; classes: string; dot: string }
> = {
  scheduled: { label: "Invited",  classes: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  active:    { label: "Live",     classes: "bg-green-100  text-green-700",  dot: "bg-green-500 animate-pulse" },
  ended:     { label: "Ended",    classes: "bg-gray-100   text-gray-500",   dot: "bg-gray-400" },
  cancelled: { label: "Cancelled",classes: "bg-red-50     text-red-500",    dot: "bg-red-400" },
}

export function SessionCard({ session, role, onAccept, onDecline, onDelete, accepting, deleting }: Props) {
  const cfg = STATUS_CONFIG[session.status]
  const roomHref =
    role === "sw"
      ? `/social-worker/sessions/${session.id}`
      : `/customer/sessions/${session.id}`

  const otherParty =
    role === "sw" ? session.patientName : session.swName

  const canJoin  = session.status === "active"
  const canStart = role === "sw" && session.status === "scheduled"
  const canAcceptDecline = role === "patient" && session.status === "scheduled"
  const canDelete = role === "sw" && (session.status === "ended" || session.status === "cancelled")

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4 hover:border-violet-200 transition-colors">
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
          ${session.status === "active" ? "bg-green-100" : "bg-violet-50"}`}
      >
        <Video
          className={`w-5 h-5 ${session.status === "active" ? "text-green-600" : "text-violet-500"}`}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900 truncate">{otherParty}</span>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {session.scheduledAt && session.status === "scheduled" && (
          <p className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Calendar className="w-3 h-3" />
            {formatShortDateTime(session.scheduledAt)}
          </p>
        )}

        {session.startedAt && session.status === "active" && (
          <p className="flex items-center gap-1 text-xs text-green-600 mb-1">
            <Clock className="w-3 h-3" />
            Started {formatShortDateTime(session.startedAt)}
          </p>
        )}

        {session.endedAt && (
          <p className="flex items-center gap-1 text-xs text-gray-400 mb-1">
            <Clock className="w-3 h-3" />
            Ended {formatShortDateTime(session.endedAt)}
          </p>
        )}

        {session.inviteMessage && session.status === "scheduled" && (
          <p className="text-xs text-gray-500 italic mt-1 line-clamp-1">
            &ldquo;{session.inviteMessage}&rdquo;
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2.5">
          {canJoin && (
            <Link
              href={roomHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Video className="w-3.5 h-3.5" />
              Join Now
            </Link>
          )}

          {canStart && (
            <Link
              href={roomHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Video className="w-3.5 h-3.5" />
              Start Session
            </Link>
          )}

          {canAcceptDecline && (
            <>
              <button
                onClick={() => onAccept?.(session.id)}
                disabled={accepting}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Accept
              </button>
              <button
                onClick={() => onDecline?.(session.id)}
                disabled={accepting}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                <XCircle className="w-3.5 h-3.5" />
                Decline
              </button>
            </>
          )}

          {(session.status === "ended" || (session.status === "scheduled" && role === "sw")) && (
            <Link
              href={roomHref}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto"
            >
              View <ArrowRight className="w-3 h-3" />
            </Link>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete?.(session.id)}
              disabled={deleting}
              title="Delete session"
              className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors ml-auto disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
