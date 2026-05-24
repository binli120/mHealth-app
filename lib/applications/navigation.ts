/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { ApplicationEntryMode } from "@/lib/applications/types"

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
  return buildApplicationHref(applicationId, "wizard")
}

export function buildApplicationStartHref(applicationId: string): string {
  return buildApplicationHref(applicationId, "chat")
}
