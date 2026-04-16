/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Camera, Trash2, ScanLine, CheckCircle2, ShieldCheck, ShieldAlert, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { InfoBox } from "@/components/shared/InfoBox"
import { AddressFields, type AddressValue } from "@/components/shared/AddressFields"
import { FieldRow } from "@/components/user-profile/FieldRow"
import { EditableSectionCard, SectionActions } from "@/components/user-profile/section-primitives"
import { UserAvatar } from "@/components/shared/UserAvatar"
import { ProfileScanModal, type ProfileScanResult } from "@/components/identity/ProfileScanModal"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { CITIZENSHIP_OPTIONS } from "@/lib/constants/form-options"
import { GENDER_OPTIONS } from "@/lib/user-profile/constants"
import { useAppSelector } from "@/lib/redux/hooks"
import { cn } from "@/lib/utils"
import type { UserProfile, Gender } from "@/lib/user-profile/types"
import type { CitizenshipStatus } from "@/lib/benefit-orchestration/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  profile: UserProfile
  onSaved: (updated: Partial<UserProfile>) => void
}

/** Which fields were populated by the last license scan */
type ScannedFields = Set<"firstName" | "lastName" | "addressLine1" | "city" | "state" | "zip">

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Small badge shown next to a field that was auto-filled from the license scan */
function ScanBadge() {
  return (
    <Badge
      className="h-4 px-1.5 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/10 border-primary/20"
    >
      <ScanLine className="mr-1 h-2.5 w-2.5" />
      From license
    </Badge>
  )
}

// ─── Identity status pill ─────────────────────────────────────────────────────

function IdentityStatusPill({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        <ShieldCheck className="h-3 w-3" /> Identity Verified
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
        <Clock className="h-3 w-3" /> Under Review
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <ShieldAlert className="h-3 w-3" /> Not Verified
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PersonalSection({ profile, onSaved }: Props) {
  const identityStatus = useAppSelector((s) => s.identityVerification.status)
  const [isEditing, setIsEditing] = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)

  // ── Avatar upload (independent of the edit form) ──────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append("image", file)
      const res = await authenticatedFetch("/api/user-profile/avatar", { method: "POST", body: form })
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

  // ── Edit-mode form state ──────────────────────────────────────────────────
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

  /** Fields auto-filled from the most recent license scan — cleared on save/cancel */
  const [scannedFields, setScannedFields] = useState<ScannedFields>(new Set())
  /** Raw barcode from camera scan — used for verification after save */
  const [pendingRawBarcode, setPendingRawBarcode] = useState<string | null>(null)
  /** Whether identity was verified as part of this edit session */
  const [sessionVerified, setSessionVerified] = useState(false)

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
    setScannedFields(new Set())
    setPendingRawBarcode(null)
    setSessionVerified(false)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setScannedFields(new Set())
    setPendingRawBarcode(null)
    setSessionVerified(false)
    setIsEditing(false)
  }

  // ── Apply scan result to form ─────────────────────────────────────────────
  const handleScanApply = (result: ProfileScanResult) => {
    const filled: ScannedFields = new Set()
    const { fields, rawBarcode } = result

    if (fields.firstName) { setFirstName(fields.firstName); filled.add("firstName") }
    if (fields.lastName) { setLastName(fields.lastName); filled.add("lastName") }

    setAddress((prev) => {
      const next = { ...prev }
      if (fields.addressLine1) { next.line1 = fields.addressLine1; filled.add("addressLine1") }
      if (fields.city) { next.city = fields.city; filled.add("city") }
      if (fields.state) { next.state = fields.state; filled.add("state") }
      if (fields.zip) { next.zip = fields.zip; filled.add("zip") }
      return next
    })

    setScannedFields(filled)
    if (rawBarcode) setPendingRawBarcode(rawBarcode)

    const count = filled.size
    toast.success(`${count} field${count !== 1 ? "s" : ""} filled from your license.`, {
      description: "Review and adjust before saving.",
    })
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Save applicant core fields
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

      // 2. Save profile preferences
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

      // 3. If a camera scan was done, run verification now that profile is saved
      if (pendingRawBarcode && identityStatus !== "verified") {
        try {
          const verifyRes = await authenticatedFetch("/api/identity/verify-license", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawBarcode: pendingRawBarcode }),
          })
          const verifyData = await verifyRes.json().catch(() => ({})) as { ok?: boolean; status?: string }
          if (verifyData.ok && verifyData.status === "verified") {
            setSessionVerified(true)
            toast.success("Identity verified!", {
              description: "Your license has been confirmed against your profile.",
            })
          } else if (verifyData.ok && verifyData.status === "needs_review") {
            toast.info("Profile saved. Identity is under review.", {
              description: "A staff member will confirm your identity shortly.",
            })
          }
        } catch {
          // Non-fatal — profile save succeeded; verification can be retried
        }
      }

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

      if (!pendingRawBarcode) toast.success("Personal info saved.")
      setScannedFields(new Set())
      setPendingRawBarcode(null)
      setIsEditing(false)
    } catch {
      toast.error("Could not save personal info. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <ProfileScanModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onApply={handleScanApply}
      />

      <EditableSectionCard
        title="Personal Information"
        description="Your name, contact details, and address — used to auto-fill benefit applications."
        isEditing={isEditing}
        onEdit={handleEdit}
      >
        {/* ── Avatar (always visible) ── */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              firstName={profile.firstName}
              lastName={profile.lastName}
              size="xl"
            />
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">Profile photo</p>
              <IdentityStatusPill status={identityStatus} />
            </div>
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
                year: "numeric", month: "long", day: "numeric",
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
            {/* ── Scan banner ── */}
            <div className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
              scannedFields.size > 0
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-muted/40",
            )}>
              <div className="space-y-0.5">
                {scannedFields.size > 0 ? (
                  <>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {scannedFields.size} field{scannedFields.size !== 1 ? "s" : ""} filled from license
                    </p>
                    <p className="text-xs text-muted-foreground pl-5.5">
                      Review below and adjust before saving.
                      {pendingRawBarcode && identityStatus !== "verified" &&
                        " Identity will be verified when you save."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Auto-fill from your license</p>
                    <p className="text-xs text-muted-foreground">
                      Scan the barcode on the back of your driver&apos;s license to fill in name and address instantly.
                    </p>
                  </>
                )}
              </div>
              <Button
                type="button"
                variant={scannedFields.size > 0 ? "outline" : "default"}
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setScanModalOpen(true)}
              >
                <ScanLine className="h-3.5 w-3.5" />
                {scannedFields.size > 0 ? "Re-scan" : "Scan License"}
              </Button>
            </div>

            {/* ── Name fields ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="firstName">First name</Label>
                  {scannedFields.has("firstName") && <ScanBadge />}
                </div>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setScannedFields((p) => { const n = new Set(p); n.delete("firstName"); return n }) }}
                  placeholder="First name"
                  className={cn(scannedFields.has("firstName") && "ring-1 ring-primary/40")}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="lastName">Last name</Label>
                  {scannedFields.has("lastName") && <ScanBadge />}
                </div>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setScannedFields((p) => { const n = new Set(p); n.delete("lastName"); return n }) }}
                  placeholder="Last name"
                  className={cn(scannedFields.has("lastName") && "ring-1 ring-primary/40")}
                />
              </div>
            </div>

            {/* ── Preferred name + gender ── */}
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

            {/* ── Phone ── */}
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

            {/* ── Citizenship ── */}
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

            {/* ── Address (with scan badges per-field) ── */}
            <AddressFieldsWithBadges
              address={address}
              onChange={(val, changedKey) => {
                setAddress(val)
                if (changedKey) {
                  setScannedFields((p) => {
                    const n = new Set(p)
                    n.delete(changedKey as ScannedFieldKey)
                    return n
                  })
                }
              }}
              scannedFields={scannedFields}
              disabled={saving}
            />

            {/* ── Session verified banner ── */}
            {sessionVerified && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Identity verified — your license has been confirmed.
                </p>
              </div>
            )}

            <SectionActions onCancel={handleCancel} onSave={handleSave} isSaving={saving} />
          </>
        )}
      </EditableSectionCard>
    </>
  )
}

// ─── Address fields wrapper with per-field scan badges ────────────────────────

type ScannedFieldKey = "firstName" | "lastName" | "addressLine1" | "city" | "state" | "zip"

interface AddressFieldsWithBadgesProps {
  address: AddressValue
  onChange: (val: AddressValue, changedKey?: ScannedFieldKey) => void
  scannedFields: ScannedFields
  disabled: boolean
}

function AddressFieldsWithBadges({ address, onChange, scannedFields, disabled }: AddressFieldsWithBadgesProps) {
  const addressScanned = scannedFields.has("addressLine1") || scannedFields.has("city") ||
    scannedFields.has("state") || scannedFields.has("zip")

  return (
    <div className="space-y-3">
      {/* Line 1 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="profile-line1">Street address</Label>
          {scannedFields.has("addressLine1") && <ScanBadge />}
        </div>
        <Input
          id="profile-line1"
          value={address.line1}
          disabled={disabled}
          placeholder="123 Main St"
          className={cn(scannedFields.has("addressLine1") && "ring-1 ring-primary/40")}
          onChange={(e) => onChange({ ...address, line1: e.target.value }, "addressLine1")}
        />
      </div>

      {/* Line 2 */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-line2">Apt / unit (optional)</Label>
        <Input
          id="profile-line2"
          value={address.line2}
          disabled={disabled}
          placeholder="Apt 4B"
          onChange={(e) => onChange({ ...address, line2: e.target.value })}
        />
      </div>

      {/* City / State / ZIP */}
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="profile-city">City</Label>
            {scannedFields.has("city") && <ScanBadge />}
          </div>
          <Input
            id="profile-city"
            value={address.city}
            disabled={disabled}
            placeholder="Boston"
            className={cn(scannedFields.has("city") && "ring-1 ring-primary/40")}
            onChange={(e) => onChange({ ...address, city: e.target.value }, "city")}
          />
        </div>
        <div className="col-span-1 space-y-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="profile-state">State</Label>
            {scannedFields.has("state") && <ScanBadge />}
          </div>
          <Input
            id="profile-state"
            value={address.state}
            disabled={disabled}
            placeholder="MA"
            maxLength={2}
            className={cn("uppercase", scannedFields.has("state") && "ring-1 ring-primary/40")}
            onChange={(e) => onChange({ ...address, state: e.target.value.toUpperCase() }, "state")}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="profile-zip">ZIP</Label>
            {scannedFields.has("zip") && <ScanBadge />}
          </div>
          <Input
            id="profile-zip"
            value={address.zip}
            disabled={disabled}
            placeholder="02101"
            className={cn(scannedFields.has("zip") && "ring-1 ring-primary/40")}
            onChange={(e) => onChange({ ...address, zip: e.target.value }, "zip")}
          />
        </div>
      </div>

      {addressScanned && (
        <p className="text-xs text-muted-foreground">
          Address filled from your license — please verify it matches your current residence.
        </p>
      )}
    </div>
  )
}
