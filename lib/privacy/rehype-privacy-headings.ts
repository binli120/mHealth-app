import type { Root, Element } from "hast"
import { visit } from "unist-util-visit"

const HEADING_ID_MAP: Record<string, string> = {
  "Overview": "overview",
  "Data We Collect": "data-we-collect",
  "How We Use Data": "how-we-use-data",
  "Sharing & Disclosure": "sharing-and-disclosure",
  "Sharing &amp; Disclosure": "sharing-and-disclosure",
  "HIPAA Compliance": "hipaa",
  "Massachusetts Law": "massachusetts",
  "Your Rights": "your-rights",
  "Security": "security",
  "Age Eligibility": "age-eligibility",
  "Changes to This Policy": "changes",
  "Contact": "contact",
  "Service Region": "service-region",
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
