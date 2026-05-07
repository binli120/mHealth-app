"use client"

import type { ReactNode } from "react"

interface SectionAccordionProps {
  id: string
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function SectionAccordion({
  id,
  title,
  defaultOpen = false,
  children,
}: SectionAccordionProps) {
  return (
    <details open={defaultOpen || undefined} className="group lg:hidden border-b border-border">
      <summary className="flex cursor-pointer items-center justify-between py-4 text-lg font-semibold">
        <a href={`#${id}`} id={`mobile-${id}`} className="hover:text-primary">
          {title}
        </a>
        <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="pb-6">{children}</div>
    </details>
  )
}
