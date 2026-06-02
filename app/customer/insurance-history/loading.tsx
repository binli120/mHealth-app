// app/customer/insurance-history/loading.tsx

export default function InsuranceHistoryLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" />
      </div>
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 border rounded-lg p-4 space-y-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              <div className="h-3 w-64 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
