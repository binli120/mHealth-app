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
import { useAppDispatch } from "@/lib/redux/hooks"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n/languages"
import type { UserProfile, AccessibilityPrefs } from "@/lib/user-profile/types"

interface Props {
  profile: UserProfile
  onSaved: (updated: Partial<UserProfile>) => void
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No"
}

export function AppSettingsSection({ profile, onSaved }: Props) {
  const dispatch = useAppDispatch()
  const [isEditing, setIsEditing] = useState(false)
  const [lang, setLang] = useState<SupportedLanguage>(profile.profileData.preferredLanguage)
  const [accessibility, setAccessibility] = useState<AccessibilityPrefs>({
    ...profile.profileData.accessibility,
  })
  const [saving, setSaving] = useState(false)

  const toggleAccessibility = (key: keyof AccessibilityPrefs) => {
    setAccessibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleEdit = () => {
    setLang(profile.profileData.preferredLanguage)
    setAccessibility({ ...profile.profileData.accessibility })
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
          data: {
            ...profile.profileData,
            preferredLanguage: lang,
            accessibility,
          },
        }),
      })
      if (!res.ok) throw new Error("Save failed.")

      dispatch(setLanguage(lang))
      onSaved({
        profileData: {
          ...profile.profileData,
          preferredLanguage: lang,
          accessibility,
        },
      })
      toast.success("App settings saved.")
      setIsEditing(false)
    } catch {
      toast.error("Could not save settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === profile.profileData.preferredLanguage)?.label ?? null
  const a11y = profile.profileData.accessibility
  const accessibilityItems = [
    {
      key: "needsReadingAssistance" as const,
      title: "Reading assistance",
      desc: "Highlight and enlarge text; enable simplified language mode",
    },
    {
      key: "needsTranslation" as const,
      title: "Translation support",
      desc: "Request a certified interpreter for in-person appointments",
    },
    {
      key: "needsVoiceAssistant" as const,
      title: "Voice assistant",
      desc: "Enable screen reader compatibility and audio guidance",
    },
  ] as const

  return (
    <EditableSectionCard
      title="App Settings"
      description="Language preference and accessibility options — applied across the entire app."
      isEditing={isEditing}
      onEdit={handleEdit}
    >
        {/* ── View mode ── */}
        {!isEditing && (
          <>
            <dl className="divide-y divide-border">
              <FieldRow label="Preferred language" value={langLabel} />
            </dl>

            <Separator />

            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Accessibility
              </h3>
              <dl className="divide-y divide-border">
                <FieldRow label="Reading assistance" value={yesNo(a11y.needsReadingAssistance)} />
                <FieldRow label="Translation support" value={yesNo(a11y.needsTranslation)} />
                <FieldRow label="Voice assistant" value={yesNo(a11y.needsVoiceAssistant)} />
              </dl>
            </div>
          </>
        )}

        {/* ── Edit mode ── */}
        {isEditing && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="language">Preferred language</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as SupportedLanguage)}>
                <SelectTrigger id="language" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Changing language here will update the entire app immediately.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="mb-3 text-sm font-medium">Accessibility needs</h3>
              <div className="space-y-3">
                {accessibilityItems.map(({ key, title, desc }) => (
                  <PreferenceToggleRow
                    key={key}
                    title={title}
                    description={desc}
                    checked={accessibility[key]}
                    onCheckedChange={() => toggleAccessibility(key)}
                    ariaLabel={`Enable ${title.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            <SectionActions onCancel={handleCancel} onSave={handleSave} isSaving={saving} />
          </>
        )}
    </EditableSectionCard>
  )
}
