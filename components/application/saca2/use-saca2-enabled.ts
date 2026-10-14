/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useEffect, useState } from "react"

/**
 * Whether the SACA-2 wizard is enabled. `null` while inactive or loading;
 * `false` on any failure (fails closed: the notice is shown, never the wizard).
 */
export function useSaca2Enabled(active: boolean): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    fetch("/api/config/saca2", { cache: "no-store", signal: AbortSignal.timeout(6_000) })
      .then(async (res) => {
        if (!res.ok) return false
        const body = (await res.json()) as { enabled?: unknown }
        return body.enabled === true
      })
      .catch(() => false)
      .then((value) => {
        if (!cancelled) setEnabled(value)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  return active ? enabled : null
}
