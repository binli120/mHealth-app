/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"

export interface AddressValue {
  line1: string
  line2: string
  city: string
  state: string
  zip: string
}

interface AddressFieldsProps {
  value: AddressValue
  onChange: (updated: AddressValue) => void
  /** Prefix for all HTML ids — must be unique per page if multiple address blocks exist */
  idPrefix?: string
  disabled?: boolean
}

/**
 * Reusable address field group (street, apt, city, state, zip).
 * Pasting a full US address into the street line auto-populates city, state, and ZIP
 * using the existing parsePastedUsAddress utility.
 */
export function AddressFields({
  value,
  onChange,
  idPrefix = "addr",
  disabled = false,
}: AddressFieldsProps) {
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch })

  const handleStreetPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text")
    const parsed = parsePastedUsAddress(pasted)
    if (!parsed) return
    e.preventDefault()
    onChange({
      ...value,
      line1: parsed.streetAddress,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zipCode,
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-line1`}>Street address</Label>
        <Input
          id={`${idPrefix}-line1`}
          value={value.line1}
          onChange={(e) => set({ line1: e.target.value })}
          onPaste={handleStreetPaste}
          placeholder="123 Main St — or paste a full address"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Paste a full address (e.g. &ldquo;123 Main St, Boston, MA 02101&rdquo;) to auto-fill the fields below.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-line2`}>Apt / unit (optional)</Label>
        <Input
          id={`${idPrefix}-line2`}
          value={value.line2}
          onChange={(e) => set({ line2: e.target.value })}
          placeholder="Apt 4B"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={(e) => set({ city: e.target.value })}
            placeholder="Boston"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-state`}>State</Label>
          <Input
            id={`${idPrefix}-state`}
            value={value.state}
            onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="MA"
            maxLength={2}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-zip`}>ZIP code</Label>
          <Input
            id={`${idPrefix}-zip`}
            value={value.zip}
            onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            placeholder="02101"
            inputMode="numeric"
            maxLength={5}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
