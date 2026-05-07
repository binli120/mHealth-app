import { notFound } from "next/navigation"
import Link from "next/link"
import { compileMDX } from "next-mdx-remote/rsc"
import remarkGfm from "remark-gfm"
import { Info } from "lucide-react"

import { loadPrivacyContent, listPrivacyVersions } from "@/lib/privacy/load-content"
import { rehypePrivacyHeadings } from "@/lib/privacy/rehype-privacy-headings"
import { privacyMdxComponents } from "@/app/privacy/mdx-components"
import { PrintHeader } from "@/components/privacy/print-header"

export async function generateStaticParams() {
  return listPrivacyVersions().map((versionId) => ({ versionId }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ versionId: string }>
}) {
  const { versionId } = await params
  return {
    title: `Privacy Statement v${versionId}`,
    robots: { index: false, follow: false },
  }
}

export default async function PrivacyVersionPage({
  params,
}: {
  params: Promise<{ versionId: string }>
}) {
  const { versionId } = await params
  const content = loadPrivacyContent(versionId)
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
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to current version
          </Link>
        </div>
      </header>

      {/* Version banner */}
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-2 text-sm">
          <Info className="h-4 w-4 shrink-0 text-warning-foreground" aria-hidden="true" />
          <p>
            You are viewing version <strong>{content.frontmatter.version}</strong>{" "}
            effective <strong>{content.frontmatter.effectiveDate}</strong>.{" "}
            <Link href="/privacy" className="font-medium underline">
              View the current version
            </Link>
            .
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <PrintHeader frontmatter={content.frontmatter} />

        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Privacy & Compliance Statement
        </h1>
        <p className="mb-8 text-muted-foreground">
          Version {content.frontmatter.version} — Effective{" "}
          {content.frontmatter.effectiveDate}
        </p>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          {mdxContent}
        </article>
      </main>
    </div>
  )
}
