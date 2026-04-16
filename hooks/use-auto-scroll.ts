/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useEffect, useRef } from "react"

/**
 * Returns a ref that scrolls into view whenever any of the given `deps` change.
 * Attach this ref to a sentinel element at the bottom of a scrollable list.
 *
 * Used by: chat widget, pre-screener chat, any component with auto-scrolling messages.
 *
 * @example
 * const bottomRef = useAutoScroll([messages, isLoading])
 * return (
 *   <div>
 *     {messages.map(...)}
 *     <div ref={bottomRef} />
 *   </div>
 * )
 */
export function useAutoScroll<T extends HTMLElement = HTMLDivElement>(
  deps: unknown[],
): React.RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" })
    // deps intentionally spread — callers control when scrolling fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
