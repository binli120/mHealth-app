"use client"

import { useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useHydratedLanguage } from "@/lib/i18n/useHydratedLanguage"
import type { SupportedGlossaryLang } from "@/lib/glossary/types"

interface TermDetail {
  slug: string
  term_en: string
  definition: string
  category: string
  related_slugs: string[]
}

interface GlossaryPopoverProps {
  slug: string
  term_en: string
  children: React.ReactNode
}

const cache = new Map<string, TermDetail>()

export function GlossaryPopover({ slug, term_en, children }: GlossaryPopoverProps) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<TermDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const lang = useHydratedLanguage() as SupportedGlossaryLang

  useEffect(() => {
    if (!open) return
    const key = `${slug}:${lang}`
    if (cache.has(key)) {
      setDetail(cache.get(key)!)
      return
    }
    setLoading(true)
    fetch(`/api/glossary/${slug}?lang=${encodeURIComponent(lang)}`)
      .then((r) => r.json())
      .then((data: TermDetail) => {
        cache.set(key, data)
        setDetail(data)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [open, slug, lang])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 text-sm" align="start">
        <p className="font-semibold mb-1">{term_en}</p>
        {loading && (
          <p className="text-muted-foreground text-xs animate-pulse">Loading definition…</p>
        )}
        {!loading && detail && (
          <>
            <p className="leading-relaxed text-foreground">{detail.definition}</p>
            {detail.related_slugs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {detail.related_slugs.slice(0, 3).map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs cursor-default capitalize">
                    {s.replace(/-/g, " ")}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
        {!loading && !detail && (
          <p className="text-muted-foreground text-xs">Definition unavailable.</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
