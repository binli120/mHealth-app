/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

'use client'

import { useEffect } from 'react'

// Module-level guard so React StrictMode's double-invoked effect (dev only)
// logs the banner just once per page load.
let logged = false

/**
 * Logs the build stamp to the browser console on first client render.
 * Open Chrome DevTools → Console to see e.g. `HealthCompass MA v1.0.327 (a1b2c3d)`.
 * Renders nothing.
 */
export function BuildBanner() {
  useEffect(() => {
    if (logged) return
    logged = true

    const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
    const sha = process.env.NEXT_PUBLIC_BUILD_SHA
    const label = sha ? `v${version} (${sha})` : `v${version}`

    // Constant format string; `label` is a build-time constant passed as an arg.
    console.info(
      '%cHealthCompass MA%c %s',
      'font-weight:bold',
      'color:gray;font-weight:normal',
      label,
    )
  }, [])

  return null
}
