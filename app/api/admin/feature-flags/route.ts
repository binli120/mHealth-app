/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  listFeatureFlags,
  setFlagEnabled,
  setFlagEnvOverride,
  removeFlagEnvOverride,
} from "@/lib/db/feature-flags"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const flags = await listFeatureFlags()
  return NextResponse.json({ ok: true, flags })
}

export async function PATCH(request: Request) {
  const authResult = await requireAdmin(request)
  if (!authResult.ok) return authResult.response

  const body = await request.json()
  const { flagId, action, enabled, environment } = body

  if (!flagId || !action) {
    return NextResponse.json({ ok: false, error: "flagId and action are required" }, { status: 400 })
  }

  switch (action) {
    case "set_global":
      if (typeof enabled !== "boolean") {
        return NextResponse.json({ ok: false, error: "enabled must be boolean" }, { status: 400 })
      }
      await setFlagEnabled(flagId, enabled)
      break

    case "set_env_override":
      if (!environment || typeof enabled !== "boolean") {
        return NextResponse.json({ ok: false, error: "environment and enabled are required" }, { status: 400 })
      }
      await setFlagEnvOverride(flagId, environment, enabled)
      break

    case "remove_env_override":
      if (!environment) {
        return NextResponse.json({ ok: false, error: "environment is required" }, { status: 400 })
      }
      await removeFlagEnvOverride(flagId, environment)
      break

    default:
      return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
