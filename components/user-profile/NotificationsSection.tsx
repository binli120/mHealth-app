/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { FieldRow } from "@/components/user-profile/FieldRow"
import {
  EditableSectionCard,
  PreferenceToggleRow,
  SectionActions,
} from "@/components/user-profile/section-primitives"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { NOTIFICATION_CHANNEL_OPTIONS, REMINDER_LEAD_DAY_OPTIONS } from "@/lib/user-profile/constants"
import type { UserProfile, NotificationPrefs, NotificationChannel, ReminderLeadDays } from "@/lib/user-profile/types"

interface Props {
  profile: UserProfile
  onSaved: (updated: Partial<UserProfile>) => void
}

const ALERT_ITEMS = [
  {
    key: "deadlineReminders" as const,
    title: "Deadline reminders",
    desc: "Renewals, enrollment periods, and application deadlines",
  },
  {
    key: "qualificationAlerts" as const,
    title: "Qualification alerts",
    desc: "Notified when new programs match your profile",
  },
  {
    key: "regulationUpdates" as const,
    title: "Regulation updates",
    desc: "Changes to income limits, program rules, or eligibility criteria",
  },
]

export function NotificationsSection({ profile, onSaved }: Props) {
  const existing = profile.profileData.notifications
  const [isEditing, setIsEditing] = useState(false)
  const [prefs, setPrefs] = useState<NotificationPrefs>({ ...existing })
  const [saving, setSaving] = useState(false)

  const toggle = (key: keyof Pick<NotificationPrefs, "deadlineReminders" | "qualificationAlerts" | "regulationUpdates">) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleEdit = () => {
    setPrefs({ ...profile.profileData.notifications })
    setIsEditing(true)
  }

  const handleCancel = () => setIsEditing(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await authenticatedFetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "profile",
          data: { ...profile.profileData, notifications: prefs },
        }),
      })
      if (!res.ok) throw new Error("Save failed.")
      onSaved({ profileData: { ...profile.profileData, notifications: prefs } })
      toast.success("Notification preferences saved.")
      setIsEditing(false)
    } catch {
      toast.error("Could not save preferences. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const channelLabel = NOTIFICATION_CHANNEL_OPTIONS.find((o) => o.value === existing.channel)?.label ?? null
  const leadDaysLabel = REMINDER_LEAD_DAY_OPTIONS.find((o) => o.value === String(existing.reminderLeadDays))?.label ?? null

  return (
    <EditableSectionCard
      title="Notifications"
      description="Choose which alerts to receive and how you'd like to be contacted."
      isEditing={isEditing}
      onEdit={handleEdit}
    >
        {/* ── View mode ── */}
        {!isEditing && (
          <>
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Alert types
              </h3>
              <dl className="divide-y divide-border">
                {ALERT_ITEMS.map(({ key, title }) => (
                  <FieldRow key={key} label={title} value={existing[key] ? "Enabled" : "Disabled"} />
                ))}
              </dl>
            </div>
            <Separator />
            <dl className="divide-y divide-border">
              <FieldRow label="Notification channel" value={channelLabel} />
              <FieldRow label="Reminder lead time" value={leadDaysLabel} />
            </dl>
          </>
        )}

        {/* ── Edit mode ── */}
        {isEditing && (
          <>
            <div>
              <h3 className="mb-3 text-sm font-medium">Alert types</h3>
              <div className="space-y-3">
                {ALERT_ITEMS.map(({ key, title, desc }) => (
                  <PreferenceToggleRow
                    key={key}
                    title={title}
                    description={desc}
                    checked={prefs[key]}
                    onCheckedChange={() => toggle(key)}
                    ariaLabel={`Enable ${title.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="channel">Notification channel</Label>
                <Select
                  value={prefs.channel}
                  onValueChange={(v) => setPrefs((p) => ({ ...p, channel: v as NotificationChannel }))}
                >
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_CHANNEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="leadDays">Remind me</Label>
                <Select
                  value={String(prefs.reminderLeadDays)}
                  onValueChange={(v) =>
                    setPrefs((p) => ({ ...p, reminderLeadDays: Number(v) as ReminderLeadDays }))
                  }
                >
                  <SelectTrigger id="leadDays">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_LEAD_DAY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SectionActions onCancel={handleCancel} onSave={handleSave} isSaving={saving} />
          </>
        )}
    </EditableSectionCard>
  )
}
