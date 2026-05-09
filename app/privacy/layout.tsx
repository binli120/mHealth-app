import type { Metadata } from "next"
import { loadPrivacyContent } from "@/lib/privacy/load-content"
import { buildPrivacyJsonLd } from "@/lib/privacy/json-ld"

export const metadata: Metadata = {
  title: "Privacy & Compliance Statement",
  description:
    "How HealthCompass handles your health data in compliance with HIPAA and Massachusetts law.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy & Compliance Statement | HealthCompass MA",
    description:
      "How HealthCompass handles your health data in compliance with HIPAA and Massachusetts law.",
    url: "/privacy",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Privacy & Compliance Statement | HealthCompass MA",
    description:
      "How HealthCompass handles your health data in compliance with HIPAA and Massachusetts law.",
  },
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const content = loadPrivacyContent()
  const jsonLd = content ? buildPrivacyJsonLd(content.frontmatter) : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  )
}
