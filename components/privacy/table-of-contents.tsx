"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { PrivacySectionMeta } from "@/lib/privacy/types"

export function TableOfContents({ sections }: { sections: PrivacySectionMeta[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "")

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[]

    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    )

    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav
      aria-label="Table of contents"
      className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ol className="space-y-1 border-l border-border">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={cn(
                "block border-l-2 py-1 pl-4 text-sm transition-colors",
                activeId === s.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
