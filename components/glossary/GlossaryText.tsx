"use client"

import { useMemo } from "react"
import { findTermsInText } from "@/lib/glossary/scanner"
import { useGlossaryIndex } from "@/lib/glossary/GlossaryContext"
import { GlossaryTerm } from "./GlossaryTerm"

interface GlossaryTextProps {
  text: string
  className?: string
}

export function GlossaryText({ text, className }: GlossaryTextProps) {
  const { index, loading } = useGlossaryIndex()

  const segments = useMemo(
    () => (loading ? null : findTermsInText(text, index)),
    [text, index, loading]
  )

  if (!segments) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.content}</span>
        ) : (
          <GlossaryTerm key={i} slug={seg.slug} term_en={seg.term_en} content={seg.content} />
        )
      )}
    </span>
  )
}
