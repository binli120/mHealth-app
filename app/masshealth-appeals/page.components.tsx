/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Small presentational sub-components used exclusively by the MassHealth
 * Appeals page. Extracted here to keep page.tsx focused on page logic.
 */

import { Paperclip } from "lucide-react"
import { Label } from "@/components/ui/label"
import { getTrustTierBadgeClass } from "./page.utils"
import type { TrustTier } from "./page.types"

/**
 * Renders a coloured badge showing an appeal document's AI trust tier
 * (e.g. VERIFIED, HIGH_CONFIDENCE, UNCERTAIN).
 */
export function TrustTierBadge({ tier }: { tier: TrustTier }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${getTrustTierBadgeClass(tier)}`}>
      {tier.replace("_", " ")}
    </span>
  )
}

/**
 * Styled dashed-border label that acts as the visible trigger for a hidden
 * `<input type="file">` element. Uses `htmlFor` to link the two.
 */
export function FileUploadTrigger({ htmlFor, label }: { htmlFor: string; label: string }) {
  return (
    <Label
      htmlFor={htmlFor}
      className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      <Paperclip className="h-4 w-4 shrink-0" />
      {label}
    </Label>
  )
}
