/**
 * TypeScript types for the Admin Analytics page.
 * @author Bin Lee
 */

import type { ReactNode } from "react"
import type { AnalyticsData, DrillDownColumn } from "@/lib/db/admin-analytics"

export type AsyncState<T> =
  | { status: "loading"; data: T | null }
  | { status: "success"; data: T }
  | { status: "error"; data: null }

export type AsyncAction<T> =
  | { type: "fetch" }
  | { type: "success"; data: T }
  | { type: "error" }

export type DrillDownType = "apps-month" | "apps-status" | "users-month" | "ai-month"

export interface DrillDownSelection {
  type: DrillDownType
  value: string
  title: string
}

export type DrillDownSpec = DrillDownSelection | null

export interface MonthChartDatum {
  rawMonth: string
  month: string
}

export interface StatusChartDatum {
  status: string
  label: string
}

export interface DrillDownPanelProps {
  drill: DrillDownSpec
  onClose: () => void
}

export interface CellValueProps {
  value: unknown
  col: DrillDownColumn
}

export interface StatusBadgeProps {
  status: string
}

export interface TrendOverviewChartProps {
  data: AnalyticsData
  period: number
}

export interface SectionHeaderProps {
  title: string
}

export interface ChartCardProps {
  title: string
  subtitle: string
  children: ReactNode
  className?: string
}

export interface KpiCardProps {
  label: string
  value: number | undefined
  icon: ReactNode
  bg: string
  loading: boolean
  decimals?: number
}

export interface ChartSkeletonProps {
  rows?: number
}
