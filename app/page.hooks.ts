/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Custom hooks used by the landing page.
 *   useInView   — fires once when an element enters the viewport
 *   useCounter  — animates a number from 0 → end when triggered
 * @author: Bin Lee
 */

"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Returns a ref to attach to a DOM element and a boolean that becomes true
 * once the element has scrolled into view (fires once, never resets).
 */
export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

/**
 * Animates a stat from 0 up to `end` over `duration` ms once `inView` becomes
 * true. Initializes (and server-renders) at `end`, never 0 — crawlers, link
 * previews, and no-JS visitors only see the first render, and a homepage that
 * reads "0+ programs" to them is worse than one that never animates.
 */
export function useCounter(end: number, inView: boolean, duration = 1600) {
  const [value, setValue] = useState(end)

  useEffect(() => {
    if (!inView) return
    // No synchronous reset to 0 — the first interval tick (16ms in) lands
    // near 0 anyway, and a sync setState here would trigger a cascading
    // render (react-hooks/set-state-in-effect).
    let n = 0
    const step = end / (duration / 16)
    const id = setInterval(() => {
      n += step
      if (n >= end) {
        setValue(end)
        clearInterval(id)
      } else {
        setValue(Math.floor(n))
      }
    }, 16)
    return () => clearInterval(id)
  }, [end, inView, duration])

  return value
}
