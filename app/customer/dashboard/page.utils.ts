/**
 * Utility functions for the Customer Dashboard page.
 * @author Bin Lee
 */

import { APPLICATION_TYPE_LABELS } from "./page.constants"

export function getApplicationTypeLabel(type: string | null): string {
  if (!type) {
    return "Application"
  }

  return APPLICATION_TYPE_LABELS.get(type) ?? type.toUpperCase()
}
