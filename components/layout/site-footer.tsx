"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// /mobile/* is a focused, full-screen handoff shell with no site chrome —
// the footer both breaks that layout and pushes page height past the viewport.
const SUPPRESS_PREFIXES = ["/mobile"]

export function SiteFooter() {
  const pathname = usePathname()

  if (SUPPRESS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  return (
    <footer className="border-t border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
      <p>© 2026 HealthCompass MA. Not affiliated with the Commonwealth of Massachusetts. All rights reserved.</p>
      <p className="mt-1">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        {" · "}
        <Link href="/privacy/cookies" className="hover:text-foreground">Cookies</Link>
      </p>
    </footer>
  )
}
