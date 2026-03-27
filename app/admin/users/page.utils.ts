/**
 * Utility functions for the Admin Users page.
 * @author Bin Lee
 */

import type { AdminUser } from "./page.types"

export function fullName(u: AdminUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || "—"
}
