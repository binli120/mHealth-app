/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import type { Root, Element } from "hast"
import { visit } from "unist-util-visit"

const HEADING_ID_MAP: Record<string, string> = {
  "Overview": "overview",
  "Who Uses the Platform": "who-uses-the-platform",
  "Data We Collect": "data-we-collect",
  "How We Use Data": "how-we-use-data",
  "AI Use, Boundaries, and Limitations": "ai-use",
  "HIPAA Compliance": "hipaa",
  "Eligibility and Plan Recommendation Boundaries": "eligibility-boundaries",
  "HIX/IES System Interaction Boundaries": "hix-ies-boundaries",
  "Conflict of Interest": "conflict-of-interest",
  "Language Access": "language-access",
  "Data Retention": "data-retention",
  "Security": "security",
  "Massachusetts Law": "massachusetts",
  "Sharing & Disclosure": "sharing-and-disclosure",
  "Sharing &amp; Disclosure": "sharing-and-disclosure",
  "Changes to This Statement": "changes",
  "Your Rights": "your-rights",
  "Service Region": "service-region",
  "Contact": "contact",
}

function getTextContent(node: Element): string {
  let text = ""
  visit(node, "text", (textNode: { value: string }) => {
    text += textNode.value
  })
  return text.trim()
}

export const rehypePrivacyHeadings: () => (tree: Root) => void = () => {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "h2") {
        const text = getTextContent(node)
        const id = HEADING_ID_MAP[text]
        if (id) {
          node.properties = node.properties || {}
          node.properties.id = id
        }
      }
    })
  }
}
