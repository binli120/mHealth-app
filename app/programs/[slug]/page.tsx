/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Public, fully server-rendered landing page for one benefit program.
 * Everything here must be crawlable HTML — no client components, no
 * data fetched after hydration.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProgramBySlug, PROGRAM_PAGES } from "../program-content"

export function generateStaticParams() {
  return PROGRAM_PAGES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const program = getProgramBySlug(slug)
  if (!program) return {}
  return {
    title: program.metaTitle,
    description: program.metaDescription,
    alternates: { canonical: `/programs/${program.slug}` },
    openGraph: {
      title: program.metaTitle,
      description: program.metaDescription,
      url: `/programs/${program.slug}`,
    },
  }
}

function faqJsonLd(program: NonNullable<ReturnType<typeof getProgramBySlug>>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: program.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }
}

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const program = getProgramBySlug(slug)
  if (!program) notFound()

  return (
    <main className="min-h-screen bg-background">
      {/* JSON-LD data block — not executable, readable by crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(program)) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/programs" className="hover:text-foreground">Programs</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{program.name}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {program.h1}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{program.intro}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/prescreener">
              Check my eligibility free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/knowledge-center">Learn more in the Knowledge Center</Link>
          </Button>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-foreground">What {program.name} provides</h2>
          <ul className="mt-4 space-y-2">
            {program.benefitSummary.map((item) => (
              <li key={item} className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {program.incomeLimits && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold text-foreground">Income limits</h2>
            <Card className="mt-4">
              <CardContent className="pt-6">
                <table className="w-full text-left">
                  <caption className="mb-3 caption-top text-sm font-medium text-foreground">
                    {program.incomeLimits.caption}
                  </caption>
                  <thead>
                    <tr className="border-b text-sm text-muted-foreground">
                      <th scope="col" className="pb-2 font-medium">Household size</th>
                      <th scope="col" className="pb-2 font-medium">{program.incomeLimits.columnLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {program.incomeLimits.rows.map((row) => (
                      <tr key={row.householdSize} className="border-b last:border-0">
                        <td className="py-2 text-foreground">{row.householdSize}</td>
                        <td className="py-2 font-medium text-foreground">{row.limit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {program.incomeLimits.footnote && (
                  <p className="mt-3 text-sm text-muted-foreground">{program.incomeLimits.footnote}</p>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-foreground">Who qualifies</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
            {program.eligibilityPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-foreground">How to apply</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-muted-foreground">
            {program.howToApply.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-foreground">Frequently asked questions</h2>
          <div className="mt-4 space-y-4">
            {program.faqs.map((faq) => (
              <Card key={faq.question}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-foreground">Official resources</h2>
          <ul className="mt-4 space-y-2">
            {program.officialLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                >
                  {link.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-lg bg-primary p-6 text-primary-foreground sm:p-8">
          <h2 className="text-2xl font-semibold">See everything you qualify for — in one check</h2>
          <p className="mt-2 text-primary-foreground/85">
            HealthCompass checks {program.name} and 8 other Massachusetts benefit programs in about 5
            minutes. Free, available in 6 languages, with live social worker support.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-4">
            <Link href="/prescreener">
              Start my free eligibility check <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  )
}
