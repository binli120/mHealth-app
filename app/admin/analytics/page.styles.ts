/**
 * Style constants for the Admin Analytics page.
 * @author Bin Lee
 */

export const ANALYTICS_CHART_STYLES = {
  gridStroke: "#f1f5f9",
  legend: { fontSize: 11, paddingTop: 12 },
  tooltip: { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" },
  xAxisTick: { fontSize: 11, fill: "#64748b" },
  yAxisTick: { fontSize: 11, fill: "#94a3b8" },
} as const

export const ANALYTICS_SERIES_COLORS = {
  applications: {
    bar: "#93c5fd",
    line: "#2563eb",
  },
  users: {
    bar: "#c4b5fd",
    line: "#7c3aed",
  },
  aiRequests: {
    bar: "#a5f3fc",
    line: "#0891b2",
  },
  fpl: "#3b82f6",
  household: "#8b5cf6",
  recentActivity: "#60a5fa",
} as const

export const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  submitted: "#3b82f6",
  ai_extracted: "#8b5cf6",
  needs_review: "#f59e0b",
  rfi_requested: "#f97316",
  approved: "#22c55e",
  denied: "#ef4444",
}

export const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  ai_extracted: "bg-purple-100 text-purple-700",
  needs_review: "bg-amber-100 text-amber-700",
  rfi_requested: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
}

export const PROGRAM_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
]

export const MODULE_COLORS: Record<string, string> = {
  Applications: "#3b82f6",
  "Benefit Stack": "#8b5cf6",
  "Pre-Screener": "#22c55e",
  "AI Chat": "#06b6d4",
  "SW Messaging": "#f59e0b",
  "Collab Sessions": "#f97316",
  "Identity Verify": "#ec4899",
  Documents: "#14b8a6",
}
