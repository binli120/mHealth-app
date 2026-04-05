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
import bwipjs from "bwip-js/node"

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

  // Security: only allow QR codes pointing to our own origin or local LAN IPs.
  // In dev the mobile URL uses the machine's LAN IPv4 (192.168.x.x / 10.x.x.x)
  // rather than localhost, so we allow private-range http:// addresses as well.
  const appOrigin = new URL(APP_URL).origin
  const isLocalDev =
    url.startsWith("http://localhost") ||
    url.startsWith("http://127.") ||
    /^http:\/\/10\./.test(url) ||
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\./.test(url) ||
    /^http:\/\/192\.168\./.test(url)
  if (!url.startsWith(appOrigin) && !isLocalDev) {
    return new NextResponse("Invalid url", { status: 400 })
  }

  try {
    const svg = bwipjs.toSVG({
      bcid: "qrcode",
      text: url,
      scale: 3,
      paddingwidth: 4,
      paddingheight: 4,
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
