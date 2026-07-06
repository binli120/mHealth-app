/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Public index of all benefit program guides. Server-rendered for SEO.
 */

import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/PageHeader"
import { PROGRAM_PAGES } from "./program-content"

export const metadata: Metadata = {
  title: "Massachusetts Benefit Programs: Eligibility Guides 2026",
  description:
    "Plain-language 2026 eligibility guides for MassHealth, SNAP, LIHEAP fuel assistance, WIC, and the Earned Income Tax Credit in Massachusetts. Check what you qualify for — free.",
  alternates: { canonical: "/programs" },
}

export default function ProgramsIndexPage() {
  return (
    <main className="min-h-screen bg-background">
      <PageHeader
        backHref="/"
        backLabel="Home"
        breadcrumbs={[{ label: "Programs" }]}
        maxWidth="w-full sm:w-2/3 max-w-6xl"
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:w-2/3 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Massachusetts Benefit Programs: 2026 Eligibility Guides
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Plain-language guides to the major benefit programs available to Massachusetts
          residents — current 2026 income limits, benefit amounts, and step-by-step
          application help. Or skip the reading and check all of them at once with our free
          5-minute eligibility prescreener.
        </p>

        <Button asChild size="lg" className="mt-6">
          <Link href="/prescreener">
            Check all programs at once <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>

        <div className="mt-10 space-y-4">
          {PROGRAM_PAGES.map((program) => (
            <Card key={program.slug}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  <Link
                    href={`/programs/${program.slug}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {program.h1}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {program.metaDescription}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
