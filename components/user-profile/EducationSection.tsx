/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldRow } from "@/components/user-profile/FieldRow"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { EDUCATION_LEVEL_OPTIONS } from "@/lib/user-profile/constants"
import type { UserProfile, EducationInfo, EducationLevel } from "@/lib/user-profile/types"

interface Props {
  profile: UserProfile
  onSaved: (updated: Partial<UserProfile>) => void
}

export function EducationSection({ profile, onSaved }: Props) {
  const existing = profile.profileData.education
  const [isEditing, setIsEditing] = useState(false)
  const [level, setLevel] = useState<EducationLevel | "">(existing?.level ?? "")
  const [currentlyEnrolled, setCurrentlyEnrolled] = useState(existing?.currentlyEnrolled ?? false)
  const [schoolName, setSchoolName] = useState(existing?.schoolName ?? "")
  const [saving, setSaving] = useState(false)

  const handleEdit = () => {
    const ed = profile.profileData.education
    setLevel(ed?.level ?? "")
    setCurrentlyEnrolled(ed?.currentlyEnrolled ?? false)
    setSchoolName(ed?.schoolName ?? "")
    setIsEditing(true)
  }

  const handleCancel = () => setIsEditing(false)

  const handleSave = async () => {
    if (!level) {
      toast.error("Please select your education level.")
      return
    }
    setSaving(true)
    try {
      const education: EducationInfo = {
        level: level as EducationLevel,
        currentlyEnrolled,
        schoolName: schoolName || undefined,
      }
      const res = await authenticatedFetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "profile",
          data: { ...profile.profileData, education },
        }),
      })
      if (!res.ok) throw new Error("Save failed.")
      onSaved({ profileData: { ...profile.profileData, education } })
      toast.success("Education info saved.")
      setIsEditing(false)
    } catch {
      toast.error("Could not save education info. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const levelLabel =
    EDUCATION_LEVEL_OPTIONS.find((o) => o.value === existing?.level)?.label ?? null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Education</CardTitle>
          <CardDescription>
            Education level may affect eligibility for student loan assistance, childcare, and job
            training programs.
          </CardDescription>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={handleEdit} className="shrink-0">
            Edit
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── View mode ── */}
        {!isEditing && (
          <dl className="divide-y divide-border">
            <FieldRow label="Highest level of education" value={levelLabel} />
            <FieldRow
              label="Currently enrolled"
              value={existing ? (existing.currentlyEnrolled ? "Yes" : "No") : null}
            />
            {existing?.currentlyEnrolled && (
              <FieldRow label="School or program" value={existing.schoolName ?? null} />
            )}
          </dl>
        )}

        {/* ── Edit mode ── */}
        {isEditing && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="educationLevel">Highest level of education</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as EducationLevel)}>
                <SelectTrigger id="educationLevel">
                  <SelectValue placeholder="Select education level…" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium text-sm">Currently enrolled in school</p>
                <p className="text-xs text-muted-foreground">
                  Includes community college, university, vocational training, or adult education
                </p>
              </div>
              <Switch
                checked={currentlyEnrolled}
                onCheckedChange={setCurrentlyEnrolled}
                aria-label="Currently enrolled in school"
              />
            </div>

            {currentlyEnrolled && (
              <div className="space-y-1.5">
                <Label htmlFor="schoolName">School or program name (optional)</Label>
                <Input
                  id="schoolName"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Bunker Hill Community College"
                />
              </div>
            )}

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
