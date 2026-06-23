import Link from "next/link"

export function SiteFooter() {
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
