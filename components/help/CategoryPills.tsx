'use client'

import { HELP_CATEGORIES, HELP_CATEGORY_LABELS, type HelpCategory } from '@/lib/help/constants'
import { cn } from '@/lib/utils'

interface CategoryPillsProps {
  selected: HelpCategory | 'all'
  onChange: (cat: HelpCategory | 'all') => void
}

export function CategoryPills({ selected, onChange }: CategoryPillsProps) {
  const all = [{ value: 'all' as const, label: 'All' }, ...HELP_CATEGORIES.map(c => ({ value: c, label: HELP_CATEGORY_LABELS[c] }))]
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      {all.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          aria-pressed={selected === value}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            selected === value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
