import type { Metadata } from "next"
import Link from "next/link"
import { FileText, ArrowLeft, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Data Subject Requests",
  description:
    "Submit a privacy request to HealthCompass — access, amendment, or other data rights.",
}

export default function PrivacyRequestsPage() {
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
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Data Subject Requests
          </h1>
          <p className="mb-8 text-muted-foreground">
            Use this page to exercise your privacy rights under HIPAA and
            Massachusetts law.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="mb-4 text-muted-foreground">
            The online request intake form is coming soon. In the meantime,
            please contact the HealthCompass Privacy Office directly:
          </p>
          <a
            href="mailto:privacy@healthcompass.cloud"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <Mail className="h-4 w-4" />
            privacy@healthcompass.cloud
          </a>
          <p className="mt-4 text-xs text-muted-foreground">
            Access requests are acknowledged within 30 days.
          </p>
        </div>
      </main>
    </div>
  )
}
