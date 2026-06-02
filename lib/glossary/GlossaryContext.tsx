// lib/glossary/GlossaryContext.tsx

"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { GlossaryIndex } from "./types"

interface GlossaryContextValue {
  index: GlossaryIndex
  loading: boolean
}

const GlossaryContext = createContext<GlossaryContextValue>({ index: [], loading: true })

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<GlossaryIndex>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/glossary")
      .then((r) => r.json())
      .then((data: { terms: GlossaryIndex }) => {
        if (Array.isArray(data.terms)) setIndex(data.terms)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  return (
    <GlossaryContext.Provider value={{ index, loading }}>
      {children}
    </GlossaryContext.Provider>
  )
}

export function useGlossaryIndex(): GlossaryContextValue {
  return useContext(GlossaryContext)
}
