/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

export function MobileAccordionWrapper({ children }: { children: ReactNode }) {
  const articleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const article = articleRef.current
    if (!article) return

    const mql = window.matchMedia("(max-width: 1023px)")
    if (!mql.matches) return

    const headings = article.querySelectorAll<HTMLHeadingElement>("h2[id]")
    if (headings.length === 0) return

    headings.forEach((h2, index) => {
      if (h2.closest("details")) return

      const nodes: Node[] = []
      let sibling = h2.nextSibling
      while (sibling && !(sibling instanceof HTMLHeadingElement && sibling.tagName === "H2")) {
        nodes.push(sibling)
        sibling = sibling.nextSibling
      }

      const details = document.createElement("details")
      details.className = "border-b border-border"
      if (index === 0) details.open = true

      const summary = document.createElement("summary")
      summary.className = "flex cursor-pointer items-center justify-between py-4 text-lg font-semibold list-none [&::-webkit-details-marker]:hidden"
      summary.innerHTML = `<span>${h2.textContent}</span><span class="ml-2 text-muted-foreground transition-transform" aria-hidden="true">▾</span>`

      const content = document.createElement("div")
      content.className = "pb-6"
      nodes.forEach((n) => content.appendChild(n))

      details.appendChild(summary)
      details.appendChild(content)

      h2.replaceWith(details)
    })
  }, [])

  return (
    <div ref={articleRef} className="prose prose-neutral dark:prose-invert max-w-none">
      {children}
    </div>
  )
}
