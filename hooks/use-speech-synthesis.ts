/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupportedLanguage } from "@/lib/i18n/languages"

// Maps our app's language codes to BCP-47 tags supported by SpeechSynthesis
const LANG_TO_BCP47: Record<SupportedLanguage, string> = {
  "en": "en-US",
  "zh-CN": "zh-CN",
  "ht": "fr",        // Haitian Creole — fall back to French (closest supported)
  "pt-BR": "pt-BR",
  "es": "es-US",
  "vi": "vi-VN",
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false)
  // Lazy initializer runs once on the client; avoids setState inside an effect.
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  )
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Cancel any in-progress speech when the component unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, language: SupportedLanguage = "en") => {
      if (!supported || !text.trim()) return

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = LANG_TO_BCP47[language] ?? "en-US"
      utterance.rate = 0.95
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [supported],
  )

  return { speak, stop, speaking, supported }
}
