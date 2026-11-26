/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { isSaca2Enabled } from "@/lib/masshealth/saca2/flag"

export const dynamic = "force-dynamic"

/** Public, non-sensitive rollout flag for the SACA-2 wizard. */
export async function GET() {
  return NextResponse.json({ enabled: isSaca2Enabled() }, { headers: { "Cache-Control": "no-store" } })
}
