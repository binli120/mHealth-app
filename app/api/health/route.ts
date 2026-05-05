/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ ok: true })
}
