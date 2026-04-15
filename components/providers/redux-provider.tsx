/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Provider } from "react-redux"

import { setLanguage } from "@/lib/redux/features/app-slice"
import { isSupportedLanguage } from "@/lib/i18n/languages"
import { makeStore } from "@/lib/redux/store"

const LANGUAGE_STORAGE_KEY = "hcma_language"

interface ReduxProviderProps {
  children: ReactNode
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  const [store] = useState(makeStore)
  const initializedRef = useRef(false)

  // On first mount, restore persisted language from localStorage
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved && isSupportedLanguage(saved)) store.dispatch(setLanguage(saved))
    } catch {}
  }, [store])

  // Subscribe to language changes — persist to localStorage and update <html lang>
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const lang = store.getState().app.language
      try { localStorage.setItem(LANGUAGE_STORAGE_KEY, lang) } catch {}
      try { document.documentElement.lang = lang } catch {}
    })
    return unsubscribe
  }, [store])

  return <Provider store={store}>{children}</Provider>
}
