/**
 * Utility functions for the Customer Dashboard page.
 * @author Bin Lee
 */

import { getApplicationTypeLabel as libGetApplicationTypeLabel } from "@/lib/masshealth/application-types"

/**
 * Resolve a display label for the given application type id.
 * Delegates to the shared lib utility with the English-only default fallback.
 */
export function getApplicationTypeLabel(type: string | null): string {
  return libGetApplicationTypeLabel(type, "Application")
}
