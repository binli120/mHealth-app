/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { notFound } from "next/navigation"
import { compileMDX } from "next-mdx-remote/rsc"
import Link from "next/link"
import remarkGfm from "remark-gfm"

import { loadPrivacyContent } from "@/lib/privacy/load-content"
import { REQUIRED_SECTIONS } from "@/lib/privacy/sections"
import { rehypePrivacyHeadings } from "@/lib/privacy/rehype-privacy-headings"
import { TableOfContents } from "@/components/privacy/table-of-contents"
import { DsrCta } from "@/components/privacy/dsr-cta"
import { PrintHeader } from "@/components/privacy/print-header"
import { MobileAccordionWrapper } from "@/components/privacy/mobile-accordion-wrapper"
import { privacyMdxComponents } from "@/app/privacy/mdx-components"

export default async function PrivacyPage() {
  const content = loadPrivacyContent()
  if (!content) notFound()

  const { content: mdxContent } = await compileMDX({
    source: content.source,
    components: privacyMdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypePrivacyHeadings],
      },
    },
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to HealthCompass
          </Link>
          <span className="text-xs text-muted-foreground">
            Effective {content.frontmatter.effectiveDate} · v{content.frontmatter.version}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <PrintHeader frontmatter={content.frontmatter} />

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" tabIndex={-1}>
            Privacy & Compliance Statement
          </h1>
          <p className="mt-2 text-muted-foreground">
            Effective {content.frontmatter.effectiveDate} · Version{" "}
            {content.frontmatter.version}
          </p>
        </div>

        {/* Top DSR CTA */}
        <DsrCta />

        {/* Two-column layout: ToC + content */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
          <TableOfContents sections={REQUIRED_SECTIONS} />

          <MobileAccordionWrapper>
            {mdxContent}
          </MobileAccordionWrapper>
        </div>

        {/* Bottom DSR CTA */}
        <div className="mt-12">
          <DsrCta />
        </div>
      </main>

      {/* Page footer */}
      <footer className="border-t border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-7xl">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          {" · "}
          <Link href="/privacy/cookies" className="hover:text-foreground">
            Cookie Policy
          </Link>
          {" · "}
          <Link href="/privacy/requests" className="hover:text-foreground">
            Data Rights Requests
          </Link>
        </div>
      </footer>
    </div>
  )
}
