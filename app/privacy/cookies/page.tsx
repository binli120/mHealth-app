import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Cookie } from "lucide-react"

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "HealthCompass cookie policy and usage information.",
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Privacy Statement
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Cookie className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Cookie Policy
          </h1>
          <p className="mb-8 text-muted-foreground">
            Information about how HealthCompass uses cookies and similar
            technologies.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            A detailed cookie policy is being prepared and will be published
            here. For questions, contact{" "}
            <a
              href="mailto:privacy@healthcompass.cloud"
              className="text-primary hover:underline"
            >
              privacy@healthcompass.cloud
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
