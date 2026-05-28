/**
 * Route-level loading state for all /customer/* pages.
 *
 * This Suspense boundary fires while the route's JS bundle is fetching and
 * during any server-side data work. It does NOT replace the useEffect-based
 * loading spinners inside each page — those handle client-side data fetching.
 * Converting pages to async Server Components would unlock full data streaming
 * and let this skeleton replace the per-page spinners.
 */

export default function CustomerLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="text-sm">Loading…</p>
    </div>
  )
}
