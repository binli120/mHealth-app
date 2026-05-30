/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { PrivacyFrontmatter } from "@/lib/privacy/types"

export function PrintHeader({ frontmatter }: { frontmatter: PrivacyFrontmatter }) {
  return (
    <div className="hidden print:block print:mb-8 print:border-b print:border-black print:pb-4">
      <h1 className="text-2xl font-bold">HealthCompass MA — Privacy & Compliance Statement</h1>
      <div className="mt-2 text-sm">
        <p>Version {frontmatter.version} — Effective {frontmatter.effectiveDate}</p>
        <p>Reviewed by: {frontmatter.lastReviewedBy}</p>
        <p>healthcompass.cloud/privacy</p>
      </div>
    </div>
  )
}
