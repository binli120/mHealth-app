"use client"

import { useState, type ReactNode } from "react"
import { Provider } from "react-redux"

import { makeStore } from "@/lib/redux/store"

interface ReduxProviderProps {
  children: ReactNode
}

export function ReduxProvider({ children }: ReduxProviderProps) {
  const [store] = useState(makeStore)

  return <Provider store={store}>{children}</Provider>
}
