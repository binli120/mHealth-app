/**
 * Constants for the Application Status Detail page.
 * @author Bin Lee
 */

import { MASSHEALTH_APPLICATION_TYPES } from "@/lib/masshealth/application-types"

export const APPLICATION_TYPE_LABELS = new Map<string, string>(
  MASSHEALTH_APPLICATION_TYPES.map((item) => [item.id, item.shortLabel]),
)
