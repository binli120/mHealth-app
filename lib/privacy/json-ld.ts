import type { PrivacyFrontmatter } from "./types"

export function buildPrivacyJsonLd(frontmatter: PrivacyFrontmatter) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy & Compliance Statement",
    description:
      "How HealthCompass handles your health data in compliance with HIPAA and Massachusetts law.",
    url: "https://healthcompass.cloud/privacy",
    inLanguage: "en",
    dateModified: frontmatter.effectiveDate,
    datePublished: frontmatter.effectiveDate,
    isPartOf: {
      "@type": "WebSite",
      name: "HealthCompass MA",
      url: "https://healthcompass.cloud",
    },
    publisher: {
      "@type": "Organization",
      name: "HealthCompass",
      url: "https://healthcompass.cloud",
      contactPoint: {
        "@type": "ContactPoint",
        email: frontmatter.contact.email,
        contactType: "Privacy Office",
      },
    },
    mainEntity: {
      "@type": "PrivacyPolicy",
      name: "HealthCompass Privacy & Compliance Statement",
      version: frontmatter.version,
      dateModified: frontmatter.effectiveDate,
    },
  }
}
