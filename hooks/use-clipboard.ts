"use client"

import { useCallback, useState } from "react"

interface UseClipboardResult {
  copied: boolean
  copy: (text: string) => Promise<void>
}

/**
 * Copy text to the clipboard with temporary "copied" feedback state.
 *
 * Used by: AppealResultView (copy appeal letter), any future copy-to-clipboard action.
 *
 * @param resetDelay ms before `copied` resets to false (default 2000)
 *
 * @example
 * const { copied, copy } = useClipboard()
 * <Button onClick={() => copy(text)}>
 *   {copied ? "Copied!" : "Copy"}
 * </Button>
 */
export function useClipboard(resetDelay = 2000): UseClipboardResult {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), resetDelay)
      } catch {
        // Clipboard API not available — silent fail
      }
    },
    [resetDelay],
  )

  return { copied, copy }
}
