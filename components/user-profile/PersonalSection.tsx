/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Camera, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { InfoBox } from "@/components/shared/InfoBox"
import { AddressFields, type AddressValue } from "@/components/shared/AddressFields"
import { FieldRow } from "@/components/user-profile/FieldRow"
import { EditableSectionCard, SectionActions } from "@/components/user-profile/section-primitives"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { CITIZENSHIP_OPTIONS } from "@/lib/constants/form-options"
import { GENDER_OPTIONS } from "@/lib/user-profile/constants"
import type { UserProfile, Gender } from "@/lib/user-profile/types"
import type { CitizenshipStatus } from "@/lib/benefit-orchestration/types"

interface Props {
  profile: UserProfile
  onSaved: (updated: Partial<UserProfile>) => void
}

function labelFor<T extends string>(
  options: { value: T; label: string }[],
  value: T | null | undefined,
): string | null {
  return options.find((o) => o.value === value)?.label ?? null
}

function formatAddress(profile: UserProfile): string | null {
  const parts = [
    profile.addressLine1,
    profile.addressLine2,
    [profile.city, profile.state].filter(Boolean).join(", "),
    profile.zip,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join("\n") : null
}

export function PersonalSection({ profile, onSaved }: Props) {
  const [isEditing, setIsEditing] = useState(false)

  // ── Avatar upload (independent of the edit form) ──────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected if needed
    e.target.value = ""

    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append("image", file)
      const res = await authenticatedFetch("/api/user-profile/avatar", {
        method: "POST",
        body: form,
      })
      const payload = (await res.json().catch(() => ({}))) as { ok: boolean; avatarUrl?: string; error?: string }
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "Upload failed.")
      onSaved({ avatarUrl: payload.avatarUrl ?? null })
      toast.success("Profile photo updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo. Please try again.")
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true)
    try {
      const res = await authenticatedFetch("/api/user-profile/avatar", { method: "DELETE" })
      if (!res.ok) throw new Error("Remove failed.")
      onSaved({ avatarUrl: null })
      toast.success("Profile photo removed.")
    } catch {
      toast.error("Could not remove photo. Please try again.")
    } finally {
      setAvatarUploading(false)
    }
  }

  // ── Edit-mode form state (re-synced from prop on each entry) ─────────────
  const [firstName, setFirstName] = useState(profile.firstName)
  const [lastName, setLastName] = useState(profile.lastName)
  const [phone, setPhone] = useState(profile.phone ?? "")
  const [address, setAddress] = useState<AddressValue>({
    line1: profile.addressLine1 ?? "",
    line2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    zip: profile.zip ?? "",
  })
  const [citizenshipStatus, setCitizenshipStatus] = useState<CitizenshipStatus | "">(
    profile.citizenshipStatus ?? "",
  )
  const [preferredName, setPreferredName] = useState(profile.profileData.preferredName ?? "")
  const [gender, setGender] = useState<Gender | "">(profile.profileData.gender ?? "")
  const [saving, setSaving] = useState(false)

  const handleEdit = () => {
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setPhone(profile.phone ?? "")
    setAddress({
      line1: profile.addressLine1 ?? "",
      line2: profile.addressLine2 ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      zip: profile.zip ?? "",
    })
    setCitizenshipStatus(profile.citizenshipStatus ?? "")
    setPreferredName(profile.profileData.preferredName ?? "")
    setGender(profile.profileData.gender ?? "")
    setIsEditing(true)
  }

  const handleCancel = () => setIsEditing(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const applicantRes = await authenticatedFetch("/api/user-profile/applicant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || undefined,
          addressLine1: address.line1 || undefined,
          addressLine2: address.line2 || undefined,
          city: address.city || undefined,
          state: address.state || undefined,
          zip: address.zip || undefined,
        }),
      })
      if (!applicantRes.ok) throw new Error("Failed to save personal info.")

      const profileRes = await authenticatedFetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "profile",
          data: {
            ...profile.profileData,
            preferredName: preferredName || undefined,
            gender: gender || undefined,
          },
        }),
      })
      if (!profileRes.ok) throw new Error("Failed to save profile preferences.")

      onSaved({
        firstName,
        lastName,
        phone: phone || null,
        addressLine1: address.line1 || null,
        addressLine2: address.line2 || null,
        city: address.city || null,
        state: address.state || null,
        zip: address.zip || null,
        citizenshipStatus: (citizenshipStatus as CitizenshipStatus) || null,
        profileData: {
          ...profile.profileData,
          preferredName: preferredName || undefined,
          gender: (gender as Gender) || undefined,
        },
      })
      toast.success("Personal info saved.")
      setIsEditing(false)
    } catch {
      toast.error("Could not save personal info. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <EditableSectionCard
      title="Personal Information"
      description="Your name, contact details, and address — used to auto-fill benefit applications."
      isEditing={isEditing}
      onEdit={handleEdit}
    >
        {/* ── Avatar section (always visible, independent of edit mode) ── */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              firstName={profile.firstName}
              lastName={profile.lastName}
              size="xl"
            />
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={avatarUploading}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · max 5 MB</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
              >
                <Camera className="h-3.5 w-3.5" />
                {avatarUploading ? "Uploading…" : profile.avatarUrl ? "Change photo" : "Upload photo"}
              </Button>
              {profile.avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {profile.dateOfBirth && (
          <InfoBox variant="neutral">
            <span className="text-sm">
              <strong>Date of birth:</strong>{" "}
              {new Date(profile.dateOfBirth).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {" "}(read-only — contact support to correct)
            </span>
          </InfoBox>
        )}

        {/* ── View mode ── */}
        {!isEditing && (
          <dl className="divide-y divide-border">
            <FieldRow label="Full name" value={[profile.firstName, profile.lastName].filter(Boolean).join(" ")} />
            <FieldRow label="Preferred name" value={profile.profileData.preferredName} />
            <FieldRow label="Gender" value={labelFor(GENDER_OPTIONS, profile.profileData.gender)} />
            <FieldRow label="Phone" value={profile.phone} />
            <FieldRow
              label="Citizenship / immigration status"
              value={labelFor(CITIZENSHIP_OPTIONS, profile.citizenshipStatus)}
            />
            <FieldRow label="Address" value={formatAddress(profile)} multiline />
          </dl>
        )}

        {/* ── Edit mode ── */}
        {isEditing && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="preferredName">Preferred name (optional)</Label>
                <Input
                  id="preferredName"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="Name you go by"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender (optional)</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(617) 555-0100"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="citizenshipStatus">Citizenship / immigration status</Label>
              <Select
                value={citizenshipStatus}
                onValueChange={(v) => setCitizenshipStatus(v as CitizenshipStatus)}
              >
                <SelectTrigger id="citizenshipStatus">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {CITIZENSHIP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AddressFields value={address} onChange={setAddress} idPrefix="profile" disabled={saving} />

            <SectionActions onCancel={handleCancel} onSave={handleSave} isSaving={saving} />
          </>
        )}
    </EditableSectionCard>
  )
}
