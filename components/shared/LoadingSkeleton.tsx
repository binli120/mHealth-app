import { cn } from "@/lib/utils"

interface SkeletonBlockProps {
  className?: string
}

/**
 * Single animated skeleton block. Compose these to build loading states.
 */
export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-gray-200", className)} />
  )
}

interface LoadingSkeletonProps {
  /** Heights for each skeleton block, e.g. ["h-6 w-48", "h-28", "h-52"] */
  blocks?: string[]
  className?: string
}

/**
 * Stacked skeleton loading state. Defaults to a generic multi-block layout
 * similar to the loading state in appeal-assistant page.
 */
export function LoadingSkeleton({ blocks, className }: LoadingSkeletonProps) {
  const rows = blocks ?? ["h-6 w-48", "h-28", "h-52", "h-36"]
  return (
    <div className={cn("space-y-4", className)}>
      {rows.map((cls, i) => (
        <SkeletonBlock key={i} className={cls} />
      ))}
    </div>
  )
}
