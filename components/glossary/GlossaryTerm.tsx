"use client"

import { HelpCircle } from "lucide-react"
import { GlossaryPopover } from "./GlossaryPopover"

interface GlossaryTermProps {
  slug: string
  term_en: string
  content: string
}

export function GlossaryTerm({ slug, term_en, content }: GlossaryTermProps) {
  return (
    <GlossaryPopover slug={slug} term_en={term_en}>
      <span className="inline-flex items-baseline gap-0.5 cursor-pointer group">
        <strong className="font-semibold underline decoration-dotted underline-offset-2 group-hover:decoration-solid">
          {content}
        </strong>
        <button
          type="button"
          aria-label={`Learn more about ${term_en}`}
          className="relative -top-px text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={0}
        >
          <HelpCircle className="h-3 w-3" />
        </button>
      </span>
    </GlossaryPopover>
  )
}
