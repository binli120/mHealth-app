// components/insurance-history/coverage-chart.tsx
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { CoverageRecordWithExplanation } from "@/lib/insurance-history/types"
import {
  type GroupKey,
  CODE_TO_GROUP,
  GROUP_ORDER,
  GROUP_COLORS,
} from "@/lib/insurance-history/constants"

function resolveGroup(programCode: string | null): GroupKey {
  return (programCode ? CODE_TO_GROUP[programCode] : undefined) ?? "Employer"
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ChartRow = { year: string } & Partial<Record<GroupKey, number>>

// ── Component ─────────────────────────────────────────────────────────────────

interface CoverageChartProps {
  items: CoverageRecordWithExplanation[]
}

/**
 * Line chart showing monthly premium per program group over coverage years.
 * Visible when the data spans 2 or more distinct years.
 *
 * - One line per group (MassHealth / ConnectorCare / Medicare / Employer)
 * - Y-axis: monthly premium in dollars
 * - Multiple plans in the same group + year are summed
 * - Years with no premium data for a group produce a gap (null), not a zero
 */
export function CoverageChart({ items }: CoverageChartProps) {
  // Aggregate premiums: year → group → total monthly premium
  const yearGroupMap = new Map<number, Map<GroupKey, number>>()

  for (const { record } of items) {
    const year = record.coverageYear
    if (!yearGroupMap.has(year)) yearGroupMap.set(year, new Map())
    const groupMap = yearGroupMap.get(year)!
    const group = resolveGroup(record.programCode)
    const existing = groupMap.get(group) ?? 0
    groupMap.set(group, existing + (record.premiumMonthly ?? 0))
  }

  const uniqueYears = yearGroupMap.size
  if (uniqueYears < 2) return null

  // Always pad at least one empty year on each side so data never sits
  // flush against the axis edge. With 2 data years this gives 4 ticks total.
  const dataYears = Array.from(yearGroupMap.keys())
  const minYear = Math.min(...dataYears) - 1
  const maxYear = Math.max(...dataYears) + 1

  // Build chart rows for the full padded range; padding years have no group values
  const chartData: ChartRow[] = []
  for (let y = minYear; y <= maxYear; y++) {
    const row: ChartRow = { year: String(y) }
    const groupMap = yearGroupMap.get(y)
    if (groupMap) {
      for (const [group, total] of groupMap.entries()) {
        row[group] = total
      }
    }
    chartData.push(row)
  }

  // Only render lines for groups that appear at least once
  const activeGroups = GROUP_ORDER.filter((g) =>
    chartData.some((row) => row[g] != null),
  )

  return (
    <div className="rounded-xl border bg-card p-4 mb-6 shadow-sm">
      <h3 className="text-sm font-semibold mb-0.5">Monthly Premium Trend</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Monthly premium by program group · gaps mean no coverage that year
      </p>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        >
          {/* Gray fill applies only to the inner plot area; axes sit outside it */}
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="hsl(var(--border))"
            strokeOpacity={0.7}
            fill="hsl(var(--muted))"
            fillOpacity={0.15}
          />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v}`}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.2) / 50) * 50]}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`$${value.toFixed(0)}/mo`, name]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          {activeGroups.map((group) => (
            <Line
              key={group}
              type="monotone"
              dataKey={group}
              stroke={GROUP_COLORS[group]}
              strokeWidth={2.5}
              dot={{ r: 4, strokeWidth: 0, fill: GROUP_COLORS[group] }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend separated below the plot area */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 px-2">
        {activeGroups.map((group) => (
          <span key={group} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ background: GROUP_COLORS[group] }}
            />
            {group}
          </span>
        ))}
      </div>
    </div>
  )
}
