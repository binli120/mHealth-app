/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { ApplicationEntryMode } from "@/lib/applications/types"
import type { MassHealthApplicationType } from "@/lib/masshealth/types"

export function buildApplicationHref(
  applicationId: string,
  mode?: ApplicationEntryMode,
): string {
  const params = new URLSearchParams({ applicationId })
  if (mode) {
    params.set("mode", mode)
  }

  return `/application/new?${params.toString()}`
}

export function buildApplicationContinueHref(applicationId: string): string {
  return buildApplicationHref(applicationId, "chat")
}

export function buildApplicationStartHref(applicationId: string): string {
  return buildApplicationHref(applicationId, "chat")
}

/** The application chooser with one type highlighted. Static: never carries applicant data. */
export function buildRecommendedApplicationTypeHref(type: MassHealthApplicationType): string {
  return `/application/type?${new URLSearchParams({ recommended: type }).toString()}`
}
