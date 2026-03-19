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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoBox } from "@/components/shared/InfoBox"
import { FieldRow } from "@/components/user-profile/FieldRow"
import { Lock, CreditCard } from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/user-profile/constants"
import type { UserProfile, BankAccountType } from "@/lib/user-profile/types"

interface Props {
  profile: UserProfile
  onSaved: (updated: Partial<UserProfile>) => void
}

export function BankSection({ profile, onSaved }: Props) {
  const [isEditing, setIsEditing] = useState(!profile.hasBankAccount)
  const [bankName, setBankName] = useState("")
  const [accountType, setAccountType] = useState<BankAccountType | "">("checking")
  const [routingNumber, setRoutingNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [saving, setSaving] = useState(false)

  const handleEdit = () => {
    setBankName(profile.bankName ?? "")
    setAccountType(profile.bankAccountType ?? "checking")
    setRoutingNumber("")
    setAccountNumber("")
    setIsEditing(true)
  }

  const handleCancel = () => setIsEditing(false)

  const handleSave = async () => {
    if (!bankName.trim()) { toast.error("Bank name is required."); return }
    if (!accountType) { toast.error("Account type is required."); return }
    if (!/^\d{9}$/.test(routingNumber)) { toast.error("Routing number must be exactly 9 digits."); return }
    if (!/^\d{4,17}$/.test(accountNumber)) { toast.error("Account number must be 4–17 digits."); return }

    setSaving(true)
    try {
      const res = await authenticatedFetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "bank",
          data: { bankName, accountType, routingNumber, accountNumber },
        }),
      })
      if (!res.ok) throw new Error("Save failed.")
      onSaved({
        hasBankAccount: true,
        bankLastFour: accountNumber.slice(-4),
        bankName,
        bankAccountType: accountType as BankAccountType,
      })
      // Clear sensitive fields from memory
      setRoutingNumber("")
      setAccountNumber("")
      toast.success("Bank account saved securely.")
      setIsEditing(false)
    } catch {
      toast.error("Could not save bank account. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const accountTypeLabel =
    ACCOUNT_TYPE_OPTIONS.find((o) => o.value === profile.bankAccountType)?.label ?? null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Bank Account</CardTitle>
          <CardDescription>
            Used for direct deposit on benefit applications. Routing and account numbers are
            encrypted with AES-256 and never displayed in full.
          </CardDescription>
        </div>
        {!isEditing && profile.hasBankAccount && (
          <Button variant="outline" size="sm" onClick={handleEdit} className="shrink-0">
            Update
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <InfoBox variant="neutral">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            <span>
              Bank details are encrypted at rest. Only the last 4 digits of your account number
              are visible after saving.
            </span>
          </div>
        </InfoBox>

        {/* ── View mode ── */}
        {!isEditing && profile.hasBankAccount && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <dl className="flex-1 divide-y divide-border">
              <FieldRow label="Bank" value={profile.bankName} />
              <FieldRow
                label="Account"
                value={
                  accountTypeLabel && profile.bankLastFour
                    ? `${accountTypeLabel} ···· ${profile.bankLastFour}`
                    : null
                }
              />
            </dl>
          </div>
        )}

        {/* ── Edit mode (or no account yet) ── */}
        {isEditing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank or credit union name</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Citizens Bank"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accountType">Account type</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as BankAccountType)}>
                <SelectTrigger id="accountType">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="routingNumber">Routing number (9 digits)</Label>
              <Input
                id="routingNumber"
                type="password"
                inputMode="numeric"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="•••••••••"
                maxLength={9}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accountNumber">Account number</Label>
              <Input
                id="accountNumber"
                type="password"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="•••••••••••"
                maxLength={17}
                autoComplete="off"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {profile.hasBankAccount && (
                <Button variant="ghost" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save bank account"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
