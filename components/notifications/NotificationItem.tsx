/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { AlertTriangle, Bell, FileText, RefreshCw, Video } from "lucide-react"

import type { Notification, NotificationType } from "@/lib/notifications/types"

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; dot: string }> = {
  status_change:    { icon: RefreshCw,     color: "text-blue-500",   dot: "bg-blue-500" },
  document_request: { icon: FileText,      color: "text-amber-500",  dot: "bg-amber-500" },
  renewal_reminder: { icon: RefreshCw,     color: "text-green-500",  dot: "bg-green-500" },
  deadline:         { icon: AlertTriangle, color: "text-red-500",    dot: "bg-red-500" },
  general:          { icon: Bell,          color: "text-muted-foreground", dot: "bg-muted-foreground" },
  session_invite:   { icon: Video,         color: "text-violet-500", dot: "bg-violet-500" },
  session_starting: { icon: Video,         color: "text-green-600",  dot: "bg-green-600" },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

interface Props {
  notification: Notification
  onClick?: (notification: Notification) => void
}

export function NotificationItem({ notification, onClick }: Props) {
  const config = TYPE_CONFIG[notification.type]
  const Icon = config.icon
  const isUnread = !notification.readAt

  return (
    <button
      onClick={() => onClick?.(notification)}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${isUnread ? "bg-muted/30" : ""}`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`truncate text-sm ${isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
            {notification.title}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(notification.createdAt)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
      </div>
      {isUnread && (
        <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${config.dot}`} aria-hidden />
      )}
    </button>
  )
}
