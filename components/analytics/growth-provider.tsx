/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
// Vercel Analytics only works on Vercel — disabled on self-hosted VPS
// import { Analytics as VercelAnalytics } from "@vercel/analytics/react"

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    mixpanel?: {
      track?: (eventName: string, properties?: Record<string, unknown>) => void
      register_once?: (properties: Record<string, unknown>) => void
    }
  }
}

const REFERRAL_COOKIE = "hc_ref"
const REFERRAL_PARAMS = ["ref", "referral", "referral_code", "utm_referral"]
const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function getSearchParam(searchParams: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = searchParams.get(name)?.trim()
    if (value) return value.slice(0, 128)
  }

  return null
}

function getCampaign(searchParams: URLSearchParams) {
  return CAMPAIGN_PARAMS.reduce<Record<string, string>>((acc, name) => {
    const value = searchParams.get(name)?.trim()
    if (value) acc[name] = value.slice(0, 256)
    return acc
  }, {})
}

function setReferralCookie(referralCode: string) {
  document.cookie = [
    `${REFERRAL_COOKIE}=${encodeURIComponent(referralCode)}`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    window.location.protocol === "https:" ? "Secure" : "",
  ].filter(Boolean).join("; ")
}

function postJson(path: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" })
    navigator.sendBeacon(path, blob)
    return
  }

  void fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

export function GrowthProvider() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = useMemo(() => searchParams.toString(), [searchParams])

  useEffect(() => {
    const currentSearchParams = new URLSearchParams(search)
    const path = `${pathname}${search ? `?${search}` : ""}`
    const title = document.title

    window.gtag?.("event", "page_view", {
      page_path: path,
      page_title: title,
      page_location: window.location.href,
    })

    window.mixpanel?.track?.("Page Viewed", {
      path: pathname,
      url: window.location.href,
      title,
      ...getCampaign(currentSearchParams),
    })
  }, [pathname, search])

  useEffect(() => {
    const currentSearchParams = new URLSearchParams(search)
    const referralCode = getSearchParam(currentSearchParams, REFERRAL_PARAMS)
    if (!referralCode) return

    const campaign = getCampaign(currentSearchParams)
    setReferralCookie(referralCode)
    window.mixpanel?.register_once?.({ referral_code: referralCode })
    window.mixpanel?.track?.("Referral Captured", {
      referral_code: referralCode,
      path: pathname,
      ...campaign,
    })

    postJson("/api/growth/referrals", {
      referralCode,
      landingPath: `${pathname}${search ? `?${search}` : ""}`,
      referrer: document.referrer || null,
      campaign,
    })
  }, [pathname, search])

  return null
}
