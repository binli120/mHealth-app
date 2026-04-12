/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { normalizeAuthEmail } from "@/lib/auth/local-auth"

export const CONFIGURED_DEV_ADMIN_EMAIL = "binli120@gmail.com"

export function isConfiguredDevAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false
  }

  return normalizeAuthEmail(email) === CONFIGURED_DEV_ADMIN_EMAIL
}
