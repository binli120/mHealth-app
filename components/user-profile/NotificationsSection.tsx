"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { InfoBox } from "@/components/shared/InfoBox"
import { FieldRow } from "@/components/user-profile/FieldRow"
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose which alerts to receive and how you&apos;d like to be contacted.
          </CardDescription>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={handleEdit} className="shrink-0">
            Edit
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <InfoBox variant="neutral">
          <p className="text-sm">
            Notification sending is coming soon. Your preferences will be used once the
            notification system is activated.
          </p>
        </InfoBox>

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
                  <div key={key} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={prefs[key]}
                      onCheckedChange={() => toggle(key)}
                      aria-label={`Enable ${title.toLowerCase()}`}
                    />
                  </div>
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
