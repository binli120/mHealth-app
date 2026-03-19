/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useEffect, useState } from "react"

/**
 * Debounces a value — returns the last value that hasn't changed for `delay` ms.
 *
 * Used by: status list page search input, any search/filter that should wait
 * before triggering an API call.
 *
 * @example
 * const debouncedSearch = useDebounce(searchInput, 250)
 * // Only re-fetch when debouncedSearch changes, not on every keystroke
 * const fetcher = useCallback(() => fetch(`/api/search?q=${debouncedSearch}`), [debouncedSearch])
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}
