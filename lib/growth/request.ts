/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { createHash } from "crypto"

const FORWARDED_FOR_HEADER = "x-forwarded-for"
const REAL_IP_HEADER = "x-real-ip"

export function getClientIpHash(request: Request) {
  const forwardedFor = request.headers.get(FORWARDED_FOR_HEADER)
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get(REAL_IP_HEADER)?.trim() ||
    null

  if (!ip) return null

  const salt = process.env.GROWTH_IP_HASH_SALT ?? process.env.NEXT_PUBLIC_APP_URL ?? "mhealth-app"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex")
}

export function getUserAgent(request: Request) {
  return request.headers.get("user-agent")?.slice(0, 512) ?? null
}

export function readReferralCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(";").map((part) => part.trim())
  const referralCookie = cookies.find((cookie) => cookie.startsWith("hc_ref="))
  if (!referralCookie) return null

  const value = referralCookie.slice("hc_ref=".length)
  if (!value) return null

  return decodeURIComponent(value).slice(0, 128)
}
