import Link from "next/link"
import { ShieldCheck, Scale, ChevronRight, FileText } from "lucide-react"

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "HIPAA-aligned" },
  { icon: Scale, label: "MA 201 CMR 17.00" },
] as const

export function PrivacyPromiseBlock() {
  return (
    <section
      className="border-t border-border bg-card px-4 py-16 md:py-20"
      aria-labelledby="privacy-promise-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="privacy-promise-heading"
          className="mb-4 text-2xl font-bold tracking-tight md:text-3xl"
        >
          Your health data, handled with care.
        </h2>

        <p className="mx-auto mb-6 max-w-2xl text-muted-foreground">
          HealthCompass collects only the information needed to help you access
          Massachusetts health benefits. We never sell your health data and
          comply with HIPAA and Massachusetts privacy law.
        </p>

        {/* Trust badges */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
          {TRUST_BADGES.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium"
            >
              <badge.icon className="h-4 w-4 text-primary" aria-hidden="true" />
              {badge.label}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/privacy"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Read our full Privacy & Compliance commitments
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <Link
            href="/privacy/requests"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Exercise your data rights
          </Link>
        </div>
      </div>
    </section>
  )
}
