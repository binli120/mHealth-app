/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useCallback, useEffect, useReducer, useState } from "react"

export interface UseAsyncDataResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

type FetchState<T> = {
  data: T | null
  isLoading: boolean
  error: string | null
}

type FetchAction<T> =
  | { type: "loading" }
  | { type: "success"; data: T }
  | { type: "error"; error: string }

/**
 * Generic hook for data fetching with loading/error/data state.
 *
 * Pass a stable `fetcher` (wrapped in `useCallback`) — the hook re-runs
 * whenever `fetcher` identity changes, which naturally respects dependencies.
 * Handles cancellation so stale responses are discarded on unmount or re-fetch.
 *
 * Uses `useReducer` internally so the effect only calls `dispatch` once per
 * phase (loading / success / error), avoiding the `set-state-in-effect` lint rule
 * that flags multiple synchronous `setState` calls inside an effect body.
 *
 * Used by: dashboard, status list, any page that loads remote data on mount.
 *
 * @example
 * const fetcher = useCallback(async () => {
 *   const res = await authenticatedFetch("/api/applications")
 *   const payload = await res.json()
 *   if (!payload.ok) throw new Error(payload.error)
 *   return payload.records
 * }, [])
 *
 * const { data, isLoading, error, reload } = useAsyncData(fetcher)
 */
export function useAsyncData<T>(fetcher: () => Promise<T>): UseAsyncDataResult<T> {
  const [state, dispatch] = useReducer(
    (s: FetchState<T>, action: FetchAction<T>): FetchState<T> => {
      switch (action.type) {
        case "loading":
          // Preserve previous data so UI can show stale-while-revalidate if desired
          return { data: s.data, isLoading: true, error: null }
        case "success":
          return { data: action.data, isLoading: false, error: null }
        case "error":
          return { data: null, isLoading: false, error: action.error }
      }
    },
    { data: null, isLoading: true, error: null },
  )

  // Increment to trigger a manual reload without changing `fetcher` identity
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    dispatch({ type: "loading" })

    fetcher()
      .then((result) => {
        if (!cancelled) dispatch({ type: "success", data: result })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          dispatch({
            type: "error",
            error: err instanceof Error ? err.message : "Failed to load data",
          })
      })

    return () => {
      cancelled = true
    }
  }, [fetcher, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  return { ...state, reload }
}
