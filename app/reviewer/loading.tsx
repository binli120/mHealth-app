/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Route-level loading state for all /reviewer/* pages.
 */

export default function ReviewerLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm">Loading…</p>
    </div>
  )
}
