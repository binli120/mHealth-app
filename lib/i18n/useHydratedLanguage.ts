/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Returns the user's preferred language, but only after the component has
 * mounted on the client.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The Redux store starts with DEFAULT_LANGUAGE ("en") on both server and
 * client. After mount, ReduxProvider restores the persisted language from
 * localStorage (e.g. "zh-CN"). If a page reads from the store during the
 * initial server-side render / RSC reconciliation pass AND the client store
 * already holds a different language, React reports a hydration mismatch.
 *
 * `useSyncExternalStore` is React's built-in solution for this: the third
 * argument (`getServerSnapshot`) is used during SSR and the initial
 * hydration pass, while the second argument (`getSnapshot`) is used on the
 * client after hydration. React handles the transition without logging a
 * mismatch.
 */

"use client"

import { useSyncExternalStore } from "react"
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n/languages"
import { useAppSelector } from "@/lib/redux/hooks"

// A no-op subscribe — we don't need to listen to an external store here;
// we're just using useSyncExternalStore for its server-snapshot semantics.
function subscribe(_callback: () => void): () => void {
  return () => undefined
}

/** Returns true on the client (after hydration), false during SSR. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,   // client snapshot: always hydrated
    () => false,  // server snapshot: not yet hydrated
  )
}

/**
 * Returns the user's language from the Redux store, but falls back to
 * DEFAULT_LANGUAGE during SSR so the server and client render the same
 * initial HTML. After hydration the real language is used and React
 * updates the UI without a mismatch error.
 */
export function useHydratedLanguage(): SupportedLanguage {
  const language = useAppSelector((state) => state.app.language)
  const isClient = useIsClient()
  return isClient ? language : DEFAULT_LANGUAGE
}
