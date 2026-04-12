"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useState, useCallback } from "react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Tag,
  Zap,
  LayoutGrid,
  Globe2,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

type FlagCategory = "benefit_program" | "integration" | "ui" | "general"

interface EnvOverride {
  id: string
  flag_id: string
  environment: string
  enabled: boolean
  updated_at: string
}

interface FeatureFlag {
  id: string
  key: string
  label: string
  description: string | null
  enabled: boolean
  category: FlagCategory
  env_overrides: EnvOverride[]
  updated_at: string
}

const ENVIRONMENTS = ["development", "staging", "production"]

const CATEGORY_META: Record<FlagCategory, { label: string; icon: React.ReactNode; color: string }> = {
  benefit_program: {
    label: "Benefit Programs",
    icon: <Tag className="w-4 h-4" />,
    color: "text-blue-600 bg-blue-50",
  },
  integration: {
    label: "Integrations",
    icon: <Zap className="w-4 h-4" />,
    color: "text-purple-600 bg-purple-50",
  },
  ui: {
    label: "UI Features",
    icon: <LayoutGrid className="w-4 h-4" />,
    color: "text-emerald-600 bg-emerald-50",
  },
  general: {
    label: "General",
    icon: <Globe2 className="w-4 h-4" />,
    color: "text-gray-600 bg-gray-100",
  },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`flex items-center gap-1 text-sm font-medium transition-colors disabled:opacity-50 ${
        enabled ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-600"
      }`}
      title={enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
    >
      {enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
      <span className="w-16 text-left">{enabled ? "Enabled" : "Disabled"}</span>
    </button>
  )
}

function FlagRow({ flag, onUpdate }: { flag: FeatureFlag; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)

  const patch = async (body: object) => {
    setBusy(true)
    try {
      await authenticatedFetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      onUpdate()
    } finally {
      setBusy(false)
    }
  }

  const toggleGlobal = () => patch({ flagId: flag.id, action: "set_global", enabled: !flag.enabled })

  const getEnvOverride = (env: string) => flag.env_overrides.find((o) => o.environment === env)

  const toggleEnv = async (env: string) => {
    const existing = getEnvOverride(env)
    if (existing) {
      // cycle: enabled → disabled → remove
      if (existing.enabled) {
        await patch({ flagId: flag.id, action: "set_env_override", environment: env, enabled: false })
      } else {
        await patch({ flagId: flag.id, action: "remove_env_override", environment: env })
      }
    } else {
      // add override opposite to global
      await patch({ flagId: flag.id, action: "set_env_override", environment: env, enabled: !flag.enabled })
    }
  }

  const catMeta = CATEGORY_META[flag.category]

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* label + key */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{flag.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${catMeta.color}`}>
              {flag.key}
            </span>
          </div>
          {flag.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{flag.description}</p>
          )}
        </div>

        {/* global toggle */}
        <Toggle enabled={flag.enabled} onChange={toggleGlobal} disabled={busy} />

        {/* expand */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-400 hover:text-gray-600 ml-1"
          title="Per-environment overrides"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* env overrides */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex flex-wrap gap-6">
          <p className="w-full text-xs text-gray-500 mb-1 font-medium">Per-environment overrides</p>
          {ENVIRONMENTS.map((env) => {
            const override = getEnvOverride(env)
            const effective = override !== undefined ? override.enabled : flag.enabled
            const hasOverride = override !== undefined

            return (
              <div key={env} className="flex flex-col items-start gap-1">
                <span className="text-xs font-semibold text-gray-600 capitalize">{env}</span>
                <button
                  onClick={() => toggleEnv(env)}
                  disabled={busy}
                  className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                    hasOverride
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                  title={hasOverride ? "Override active — click to cycle" : "Inherits global — click to add override"}
                >
                  {effective ? (
                    <ToggleRight className="w-4 h-4 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-gray-400" />
                  )}
                  {effective ? "On" : "Off"}
                  {hasOverride && <span className="ml-1 text-amber-600 font-bold">*</span>}
                </button>
                {hasOverride && (
                  <span className="text-[10px] text-amber-600">override</span>
                )}
              </div>
            )
          })}
          <p className="w-full text-[11px] text-gray-400 mt-1">
            * = override active. Click to cycle: off → on → inherit global.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await authenticatedFetch("/api/admin/feature-flags")
      const data = await res.json()
      if (data.ok) setFlags(data.flags)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const grouped = flags.reduce<Record<FlagCategory, FeatureFlag[]>>(
    (acc, f) => { acc[f.category].push(f); return acc },
    { benefit_program: [], integration: [], ui: [], general: [] }
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading feature flags…
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Toggle benefit programs, integrations, and UI features. Expand a row for per-environment overrides.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-8">
        {(Object.entries(CATEGORY_META) as [FlagCategory, typeof CATEGORY_META[FlagCategory]][]).map(
          ([cat, meta]) => {
            const catFlags = grouped[cat]
            if (catFlags.length === 0) return null
            return (
              <section key={cat}>
                <div className={`flex items-center gap-2 mb-3 text-sm font-semibold px-1 ${meta.color} w-fit rounded-full px-3 py-1`}>
                  {meta.icon}
                  {meta.label}
                  <span className="ml-1 text-xs font-normal opacity-70">({catFlags.length})</span>
                </div>
                <div className="space-y-2">
                  {catFlags.map((f) => (
                    <FlagRow key={f.id} flag={f} onUpdate={() => load(true)} />
                  ))}
                </div>
              </section>
            )
          }
        )}
      </div>
    </div>
  )
}
