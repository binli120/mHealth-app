/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

"use client"

import { useEffect, useState } from "react"
import { abortAfter } from "@/lib/utils/abort-after"

/**
 * Whether the SACA-2 wizard is enabled. `null` while inactive or loading;
 * `false` on any failure (fails closed: the notice is shown, never the wizard).
 */
export function useSaca2Enabled(active: boolean): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const { signal, cancel } = abortAfter(6_000)
    fetch("/api/config/saca2", { cache: "no-store", signal })
      .then(async (res) => {
        if (!res.ok) return false
        const body = (await res.json()) as { enabled?: unknown }
        return body.enabled === true
      })
      .catch(() => false)
      .then((value) => {
        if (!cancelled) setEnabled(value)
      })
      .finally(cancel)
    return () => {
      cancelled = true
      cancel()
    }
  }, [active])

  return active ? enabled : null
}
