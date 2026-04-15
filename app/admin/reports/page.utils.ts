/**
 * Utilities for the Admin Reports page.
 * @author Bin Lee
 */

import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

export async function downloadCsv(url: string, filename: string) {
  const response = await authenticatedFetch(url)
  if (!response.ok) throw new Error("Export failed")

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}
