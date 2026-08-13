/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ ok: true })
}
