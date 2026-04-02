/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 *
 * GET /api/identity/qrcode?url=<encoded-url>
 *
 * Generates a QR code SVG for the given URL using bwip-js.
 * Returns the SVG as image/svg+xml so it can be rendered
 * directly as an <img src="/api/identity/qrcode?url=..."> tag.
 *
 * Security: The `url` param must start with the app origin to prevent
 * this endpoint from being used as an open QR-code-for-any-URL proxy.
 */

import { NextResponse } from "next/server"
import bwipjs from "bwip-js"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_VERCEL_URL ||
  "http://localhost:3000"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")?.trim()

  if (!url) {
    return new NextResponse("url param is required", { status: 400 })
  }

  // Security: only allow QR codes that point to our own origin
  const appOrigin = new URL(APP_URL).origin
  if (!url.startsWith(appOrigin) && !url.startsWith("http://localhost")) {
    return new NextResponse("Invalid url", { status: 400 })
  }

  try {
    const svg = bwipjs.toSVG({
      bcid: "qrcode",
      text: url,
      scale: 3,
      eclevel: "M",      // Medium error correction — good balance of size vs reliability
      padding: 4,
    })

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, max-age=600",
      },
    })
  } catch (err) {
    console.error("[qrcode] bwip-js error:", err)
    return new NextResponse("Failed to generate QR code", { status: 500 })
  }
}
