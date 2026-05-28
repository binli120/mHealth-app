/**
 * Route-level loading state for all /admin/* pages.
 * The admin layout shows its own auth-gate loading screen once mounted;
 * this loader covers the brief period while the layout JS chunk is fetched.
 */

export default function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      <div className="size-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  )
}
