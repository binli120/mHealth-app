/**
 * Route-level loading state for the /masshealth-appeals page.
 */

export default function MassHealthAppealsLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm">Loading appeals…</p>
    </div>
  )
}
