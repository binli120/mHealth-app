/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"

import { pingDatabase } from "@/lib/db/server"

export async function GET() {
  try {
    await pingDatabase()

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown database error"
        : "Database connection failed"

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
