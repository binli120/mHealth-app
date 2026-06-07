/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect } from "react"
import { openobserveLogs } from "@openobserve/browser-logs"
import { DefaultPrivacyLevel, openobserveRum } from "@openobserve/browser-rum"

let hasInitializedOpenObserveRum = false

const DEFAULT_SAMPLE_RATE = 100
const DEFAULT_REPLAY_SAMPLE_RATE = 0

const SENSITIVE_EVENT_KEYS = [
  "authorization",
  "cookie",
  "dob",
  "email",
  "name",
  "password",
  "phone",
  "ssn",
  "token",
]

function isEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes"].includes(value?.trim().toLowerCase() ?? "")
}

function getNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(0, parsed))
}

function getPrivacyLevel() {
  const configured = process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_PRIVACY_LEVEL?.trim()

  if (configured === DefaultPrivacyLevel.ALLOW) return DefaultPrivacyLevel.ALLOW
  if (configured === DefaultPrivacyLevel.MASK) return DefaultPrivacyLevel.MASK
  if (configured === DefaultPrivacyLevel.MASK_UNLESS_ALLOWLISTED) {
    return DefaultPrivacyLevel.MASK_UNLESS_ALLOWLISTED
  }

  return DefaultPrivacyLevel.MASK_USER_INPUT
}

function sanitizeUrl(value: unknown): unknown {
  if (typeof value !== "string") return value

  try {
    const url = new URL(value, window.location.origin)
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return value
  }
}

function scrubSensitiveFields(value: unknown): unknown {
  if (!value || typeof value !== "object") return value

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = scrubSensitiveFields(value[index])
    }
    return value
  }

  const record = value as Record<string, unknown>
  for (const [key, fieldValue] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase()

    if (normalizedKey === "url" || normalizedKey.endsWith("_url")) {
      record[key] = sanitizeUrl(fieldValue)
      continue
    }

    if (SENSITIVE_EVENT_KEYS.some((sensitiveKey) => normalizedKey.includes(sensitiveKey))) {
      record[key] = "[redacted]"
      continue
    }

    record[key] = scrubSensitiveFields(fieldValue)
  }

  return record
}

function beforeSend(event: unknown): boolean {
  scrubSensitiveFields(event)
  return true
}

function getRumConfig() {
  const clientToken = process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_CLIENT_TOKEN?.trim()
  const site = process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_SITE?.trim()

  if (!clientToken || !site) return null

  return {
    clientToken,
    applicationId:
      process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_APPLICATION_ID?.trim() ??
      "healthcompass-web",
    site,
    service:
      process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_SERVICE?.trim() ??
      "healthcompass-web",
    env:
      process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_ENV?.trim() ??
      process.env.NODE_ENV ??
      "production",
    version:
      process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_VERSION?.trim() ??
      process.env.NEXT_PUBLIC_APP_VERSION ??
      "0.0.0",
    organizationIdentifier:
      process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_ORG?.trim() ??
      process.env.NEXT_PUBLIC_OPENOBSERVE_ORG?.trim() ??
      "default",
    insecureHTTP: isEnabled(process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_INSECURE_HTTP),
    apiVersion: process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_API_VERSION?.trim() ?? "v1",
    sessionSampleRate: getNumberEnv(
      process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_SESSION_SAMPLE_RATE,
      DEFAULT_SAMPLE_RATE,
    ),
    sessionReplaySampleRate: getNumberEnv(
      process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_REPLAY_SAMPLE_RATE,
      DEFAULT_REPLAY_SAMPLE_RATE,
    ),
  }
}

export function OpenObserveRumProvider() {
  useEffect(() => {
    if (hasInitializedOpenObserveRum) return
    if (!isEnabled(process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_ENABLED)) return

    const config = getRumConfig()
    if (!config) return

    hasInitializedOpenObserveRum = true

    openobserveRum.init({
      ...config,
      trackResources: true,
      trackLongTasks: true,
      trackUserInteractions: true,
      defaultPrivacyLevel: getPrivacyLevel(),
      startSessionReplayRecordingManually: true,
      beforeSend,
      silentMultipleInit: true,
    })

    openobserveLogs.init({
      clientToken: config.clientToken,
      site: config.site,
      organizationIdentifier: config.organizationIdentifier,
      service: config.service,
      env: config.env,
      version: config.version,
      forwardErrorsToLogs: true,
      insecureHTTP: config.insecureHTTP,
      apiVersion: config.apiVersion,
      beforeSend,
      silentMultipleInit: true,
    })

    if (
      config.sessionReplaySampleRate > 0 &&
      isEnabled(process.env.NEXT_PUBLIC_OPENOBSERVE_RUM_SESSION_REPLAY_ENABLED)
    ) {
      openobserveRum.startSessionReplayRecording()
    }
  }, [])

  return null
}
