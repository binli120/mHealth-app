/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { CheckCircle2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { useAddressValidation, type NormalizedAddress } from "@/hooks/use-address-validation"
import { cn } from "@/lib/utils"

export interface AddressValue {
  line1: string
  line2: string
  city: string
  state: string
  zip: string
}

interface AddressFieldsProps {
  value: AddressValue
  /**
   * changedField is set when the user edits a single field.
   * It is omitted when auto-fill fires (paste or blur-detected full address),
   * so callers can distinguish between the two cases.
   */
  onChange: (updated: AddressValue, changedField?: keyof AddressValue) => void
  /** Prefix for all HTML ids — must be unique per page if multiple address blocks exist */
  idPrefix?: string
  disabled?: boolean
  /** Run geocode validation and show inline status + field errors */
  showValidation?: boolean
  /** Called once when geocode confirms the address is valid */
  onValidated?: (suggestion: NormalizedAddress) => void
  /** Optional extra content rendered next to each field's label (e.g. scan badges) */
  fieldBadge?: Partial<Record<keyof AddressValue, React.ReactNode>>
  /** Add a coloured ring to the field input to indicate it was externally populated */
  fieldHighlight?: Partial<Record<keyof AddressValue, boolean>>
}

/**
 * Reusable address field group (street, apt, city, state, zip).
 *
 * Auto-fill: pasting OR typing a full US address into the street field and
 * then leaving it (onBlur) will parse and populate city, state, and ZIP.
 *
 * Validation: set showValidation to call /api/address/validate after the user
 * fills all fields and show inline geocode results without blocking save.
 */
export function AddressFields({
  value,
  onChange,
  idPrefix = "addr",
  disabled = false,
  showValidation = false,
  onValidated,
  fieldBadge,
  fieldHighlight,
}: AddressFieldsProps) {
  const { isValidating, isValid, errors } = useAddressValidation(
    { line1: value.line1, city: value.city, state: value.state, zip: value.zip },
    { enabled: showValidation, onValidated },
  )

  const set = (patch: Partial<AddressValue>, changedField?: keyof AddressValue) =>
    onChange({ ...value, ...patch }, changedField)

  // Paste: immediate auto-fill
  const handleStreetPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text")
    const parsed = parsePastedUsAddress(pasted)
    if (!parsed) return
    e.preventDefault()
    // No changedField — this is a multi-field auto-fill
    onChange({ ...value, line1: parsed.streetAddress, city: parsed.city, state: parsed.state, zip: parsed.zipCode })
  }

  // Blur: auto-fill if the user typed a full address into line1
  const handleStreetBlur = () => {
    const parsed = parsePastedUsAddress(value.line1)
    if (!parsed || (!parsed.city && !parsed.state && !parsed.zipCode)) return
    // No changedField — this is a multi-field auto-fill
    onChange({ ...value, line1: parsed.streetAddress, city: parsed.city, state: parsed.state, zip: parsed.zipCode })
  }

  const highlight = (field: keyof AddressValue) =>
    cn(fieldHighlight?.[field] && "ring-1 ring-primary/40")

  return (
    <div className="space-y-4">
      {/* Street address */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-line1`}>Street address</Label>
          {fieldBadge?.line1}
        </div>
        <Input
          id={`${idPrefix}-line1`}
          value={value.line1}
          onChange={(e) => set({ line1: e.target.value }, "line1")}
          onPaste={handleStreetPaste}
          onBlur={handleStreetBlur}
          placeholder="123 Main St — or paste a full address"
          disabled={disabled}
          className={highlight("line1")}
        />
        {errors.line1 ? (
          <p className="text-xs text-destructive">{errors.line1}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Paste or type a full address (e.g. &ldquo;123 Main St, Boston, MA 02101&rdquo;) to auto-fill the fields below.
          </p>
        )}
      </div>

      {/* Apt / unit */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-line2`}>Apt / unit (optional)</Label>
          {fieldBadge?.line2}
        </div>
        <Input
          id={`${idPrefix}-line2`}
          value={value.line2}
          onChange={(e) => set({ line2: e.target.value }, "line2")}
          placeholder="Apt 4B"
          disabled={disabled}
          className={highlight("line2")}
        />
      </div>

      {/* City / State / ZIP */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={`${idPrefix}-city`}>City</Label>
            {fieldBadge?.city}
          </div>
          <Input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={(e) => set({ city: e.target.value }, "city")}
            placeholder="Boston"
            disabled={disabled}
            className={highlight("city")}
          />
          {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor={`${idPrefix}-state`}>State</Label>
            {fieldBadge?.state}
          </div>
          <Input
            id={`${idPrefix}-state`}
            value={value.state}
            onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) }, "state")}
            placeholder="MA"
            maxLength={2}
            disabled={disabled}
            className={cn("uppercase", highlight("state"))}
          />
          {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor={`${idPrefix}-zip`}>ZIP code</Label>
            {fieldBadge?.zip}
          </div>
          <Input
            id={`${idPrefix}-zip`}
            value={value.zip}
            onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) }, "zip")}
            placeholder="02101"
            inputMode="numeric"
            maxLength={5}
            disabled={disabled}
            className={highlight("zip")}
          />
          {errors.zip && <p className="text-xs text-destructive">{errors.zip}</p>}
        </div>
      </div>

      {/* Geocode validation status */}
      {showValidation && (
        <div className="h-4">
          {isValidating && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Verifying address…
            </span>
          )}
          {!isValidating && isValid && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Address verified
            </span>
          )}
        </div>
      )}
    </div>
  )
}
