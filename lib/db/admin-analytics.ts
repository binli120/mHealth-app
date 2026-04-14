/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"
import { getDbPool } from "@/lib/db/server"
import type { Pool } from "pg"

// ── Shared chart types ────────────────────────────────────────────────────────

export interface MonthlyCount  { month: string; count: number }
export interface StatusCount   { status: string; count: number }
export interface ProgramCount  { program: string; count: number }
export interface BucketCount   { bucket: string; count: number }
export interface HouseholdCount { size: number; count: number }
export interface ModuleCount   { module: string; count: number }

export interface ActivityEntry {
  action: string
  user_email: string | null
  application_id: string | null
  created_at: string
}

// ── Drill-down types ──────────────────────────────────────────────────────────

export interface DrillDownColumn {
  key: string
  label: string
  format?: "date" | "badge" | "money" | "percent"
}

export interface DrillDownResult {
  rows: Record<string, unknown>[]
  total: number
  columns: DrillDownColumn[]
}

// ── Master analytics snapshot ─────────────────────────────────────────────────

export interface AnalyticsData {
  // Applications
  applicationsByMonth: MonthlyCount[]
  applicationsByStatus: StatusCount[]
  applicationsByProgram: ProgramCount[]
  fplDistribution: BucketCount[]
  householdSizeDistribution: HouseholdCount[]
  totalApplications: number
  totalApplicants: number
  avgHouseholdSize: number
  submittedThisMonth: number
  // Users
  userRegistrationsByMonth: MonthlyCount[]
  totalUsers: number
  newUsersThisMonth: number
  // Feature / module usage
  moduleUsage: ModuleCount[]
  // AI / Ollama
  aiChatByMonth: MonthlyCount[]
  totalAiRequests: number
  aiRequestsThisMonth: number
  // Recent audit activity
  recentActivity: ActivityEntry[]
}

// ── Export types ──────────────────────────────────────────────────────────────

export interface ApplicationExportRow {
  id: string
  status: string
  household_size: number | null
  total_monthly_income: number | null
  confidence_score: number | null
  created_at: string
  submitted_at: string | null
  decided_at: string | null
  first_name: string | null
  last_name: string | null
  email: string
  estimated_program: string | null
  fpl_percentage: number | null
}

export interface UserExportRow {
  id: string
  email: string
  is_active: boolean
  roles: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  created_at: string
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function queryModuleUsage(pool: Pool, since: Date): Promise<ModuleCount[]> {
  const sinceStr = since.toISOString()

  const modules: Array<{ module: string; sql: string }> = [
    { module: "Applications",      sql: `SELECT COUNT(*) AS c FROM public.applications                     WHERE created_at  >= $1` },
    { module: "Benefit Stack",     sql: `SELECT COUNT(*) AS c FROM public.benefit_stack_results            WHERE generated_at >= $1` },
    { module: "Pre-Screener",      sql: `SELECT COUNT(*) AS c FROM public.eligibility_screenings           WHERE created_at  >= $1` },
    { module: "AI Chat",           sql: `SELECT COUNT(*) AS c FROM public.chat_logs                        WHERE created_at  >= $1` },
    { module: "SW Messaging",      sql: `SELECT COUNT(*) AS c FROM public.sw_direct_messages               WHERE created_at  >= $1` },
    { module: "Collab Sessions",   sql: `SELECT COUNT(*) AS c FROM public.collaborative_sessions           WHERE created_at  >= $1` },
    { module: "Identity Verify",   sql: `SELECT COUNT(*) AS c FROM public.identity_verification_attempts  WHERE attempted_at >= $1` },
    { module: "Documents",         sql: `SELECT COUNT(*) AS c FROM public.documents                        WHERE uploaded_at  >= $1` },
  ]

  const settled = await Promise.allSettled(
    modules.map(async ({ module, sql }) => {
      const r = await pool.query<{ c: string }>(sql, [sinceStr])
      return { module, count: parseInt(r.rows[0]?.c ?? "0", 10) }
    }),
  )

  return settled
    .filter((r): r is PromiseFulfilledResult<ModuleCount> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
}

async function queryRecentActivity(pool: Pool, limit = 20): Promise<ActivityEntry[]> {
  try {
    const r = await pool.query<ActivityEntry>(`
      SELECT
        al.action,
        u.email  AS user_email,
        al.application_id,
        al.created_at
      FROM public.audit_logs al
      LEFT JOIN public.users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [limit])
    return r.rows
  } catch {
    return []
  }
}

// ── Main analytics query ──────────────────────────────────────────────────────

export async function getAnalyticsData(months = 12): Promise<AnalyticsData> {
  const pool = getDbPool()
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const sinceStr = since.toISOString()

  const [
    byMonth, byStatus, byProgram, fpl, hhSize, totals,
    userRegs, aiChat, aiTotals,
    moduleUsage, recentActivity,
  ] = await Promise.all([

    // Applications filed per month
    pool.query<{ month: string; count: string }>(`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::text AS count
      FROM public.applications
      WHERE created_at >= $1
      GROUP BY month ORDER BY month ASC
    `, [sinceStr]),

    // Status breakdown (all time)
    pool.query<{ status: string; count: string }>(`
      SELECT status, COUNT(*)::text AS count
      FROM public.applications
      GROUP BY status ORDER BY count DESC
    `),

    // Program distribution
    pool.query<{ program: string; count: string }>(`
      SELECT COALESCE(estimated_program, 'Unknown') AS program,
             COUNT(*)::text AS count
      FROM public.eligibility_screenings
      GROUP BY program ORDER BY count DESC LIMIT 10
    `),

    // FPL income buckets
    pool.query<{ bucket: string; count: string }>(`
      SELECT
        CASE
          WHEN fpl_percentage <= 100 THEN '<=100%'
          WHEN fpl_percentage <= 138 THEN '101-138%'
          WHEN fpl_percentage <= 200 THEN '139-200%'
          WHEN fpl_percentage <= 250 THEN '201-250%'
          WHEN fpl_percentage <= 300 THEN '251-300%'
          ELSE '300%+'
        END AS bucket,
        COUNT(*)::text AS count
      FROM public.eligibility_screenings
      WHERE fpl_percentage IS NOT NULL
      GROUP BY bucket ORDER BY MIN(fpl_percentage) ASC
    `),

    // Household size distribution
    pool.query<{ size: string; count: string }>(`
      SELECT LEAST(household_size, 8)::int AS size,
             COUNT(*)::text AS count
      FROM public.applications
      WHERE household_size IS NOT NULL
      GROUP BY size ORDER BY size ASC
    `),

    // Core totals
    pool.query<{
      total_apps: string; total_applicants: string; avg_hh: string
      this_month: string; total_users: string; new_users: string
    }>(`
      SELECT
        (SELECT COUNT(*) FROM public.applications)::text AS total_apps,
        (SELECT COUNT(*) FROM public.applicants)::text AS total_applicants,
        COALESCE(
          (SELECT ROUND(AVG(household_size),1)
           FROM public.applications WHERE household_size IS NOT NULL)::text, '0'
        ) AS avg_hh,
        (SELECT COUNT(*) FROM public.applications
         WHERE created_at >= DATE_TRUNC('month', NOW()))::text AS this_month,
        (SELECT COUNT(*) FROM public.users)::text AS total_users,
        (SELECT COUNT(*) FROM public.users
         WHERE created_at >= DATE_TRUNC('month', NOW()))::text AS new_users
    `),

    // User registrations per month
    pool.query<{ month: string; count: string }>(`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::text AS count
      FROM public.users
      WHERE created_at >= $1
      GROUP BY month ORDER BY month ASC
    `, [sinceStr]),

    // AI chat requests per month (table may not exist yet → default to empty)
    pool.query<{ month: string; count: string }>(`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
             COUNT(*)::text AS count
      FROM public.chat_logs
      WHERE created_at >= $1
      GROUP BY month ORDER BY month ASC
    `, [sinceStr]).catch(() => ({ rows: [] as Array<{ month: string; count: string }> })),

    // AI totals (table may not exist yet)
    pool.query<{ total: string; this_month: string }>(`
      SELECT COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()))::text AS this_month
      FROM public.chat_logs
    `).catch(() => ({ rows: [{ total: "0", this_month: "0" }] })),

    // Module usage (per-table counts, each wrapped in allSettled)
    queryModuleUsage(pool, since),

    // Recent audit activity
    queryRecentActivity(pool),
  ])

  const t = totals.rows[0]
  const ai = aiTotals.rows[0]

  return {
    applicationsByMonth:       byMonth.rows.map((r) => ({ month: r.month, count: parseInt(r.count, 10) })),
    applicationsByStatus:      byStatus.rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
    applicationsByProgram:     byProgram.rows.map((r) => ({ program: r.program, count: parseInt(r.count, 10) })),
    fplDistribution:           fpl.rows.map((r) => ({ bucket: r.bucket, count: parseInt(r.count, 10) })),
    householdSizeDistribution: hhSize.rows.map((r) => ({ size: parseInt(r.size, 10), count: parseInt(r.count, 10) })),
    totalApplications:  parseInt(t?.total_apps ?? "0", 10),
    totalApplicants:    parseInt(t?.total_applicants ?? "0", 10),
    avgHouseholdSize:   parseFloat(t?.avg_hh ?? "0"),
    submittedThisMonth: parseInt(t?.this_month ?? "0", 10),
    userRegistrationsByMonth: userRegs.rows.map((r) => ({ month: r.month, count: parseInt(r.count, 10) })),
    totalUsers:       parseInt(t?.total_users ?? "0", 10),
    newUsersThisMonth: parseInt(t?.new_users ?? "0", 10),
    moduleUsage,
    aiChatByMonth:        aiChat.rows.map((r) => ({ month: r.month, count: parseInt(r.count, 10) })),
    totalAiRequests:      parseInt(ai?.total ?? "0", 10),
    aiRequestsThisMonth:  parseInt(ai?.this_month ?? "0", 10),
    recentActivity,
  }
}

// ── Chat request logger ───────────────────────────────────────────────────────

export async function logChatRequest(
  userId: string | null,
  mode: string | undefined,
  model: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO public.chat_logs (user_id, mode, model) VALUES ($1, $2, $3)`,
    [userId ?? null, mode ?? null, model],
  )
}

// ── Drill-down queries ────────────────────────────────────────────────────────

const APP_COLS: DrillDownColumn[] = [
  { key: "name",              label: "Applicant" },
  { key: "email",             label: "Email" },
  { key: "status",            label: "Status",   format: "badge" },
  { key: "household_size",    label: "HH Size" },
  { key: "fpl_percentage",    label: "FPL%",     format: "percent" },
  { key: "estimated_program", label: "Program" },
  { key: "created_at",        label: "Filed",    format: "date" },
]

const APP_SELECT = `
  SELECT
    CONCAT(ap.first_name, ' ', ap.last_name) AS name,
    u.email,
    a.status,
    a.household_size,
    es.fpl_percentage,
    es.estimated_program,
    a.created_at,
    a.submitted_at
  FROM public.applications a
  JOIN public.applicants ap ON ap.id = a.applicant_id
  JOIN public.users u       ON u.id  = ap.user_id
  LEFT JOIN LATERAL (
    SELECT fpl_percentage, estimated_program
    FROM public.eligibility_screenings
    WHERE application_id = a.id
    ORDER BY created_at DESC LIMIT 1
  ) es ON true
`

async function drillAppsMonth(pool: Pool, value: string, limit: number, offset: number): Promise<DrillDownResult> {
  const [yr, mo] = value.split("-").map(Number)
  const from = new Date(yr, mo - 1, 1).toISOString()
  const to   = new Date(yr, mo,     1).toISOString()

  const [cnt, rows] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM public.applications a WHERE a.created_at >= $1 AND a.created_at < $2`,
      [from, to],
    ),
    pool.query<Record<string, unknown>>(
      `${APP_SELECT} WHERE a.created_at >= $1 AND a.created_at < $2 ORDER BY a.created_at DESC LIMIT $3 OFFSET $4`,
      [from, to, limit, offset],
    ),
  ])
  return { total: parseInt(cnt.rows[0]?.count ?? "0", 10), rows: rows.rows, columns: APP_COLS }
}

async function drillAppsStatus(pool: Pool, value: string, limit: number, offset: number): Promise<DrillDownResult> {
  const [cnt, rows] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM public.applications a WHERE a.status = $1`,
      [value],
    ),
    pool.query<Record<string, unknown>>(
      `${APP_SELECT} WHERE a.status = $1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
      [value, limit, offset],
    ),
  ])
  return { total: parseInt(cnt.rows[0]?.count ?? "0", 10), rows: rows.rows, columns: APP_COLS }
}

async function drillUsersMonth(pool: Pool, value: string, limit: number, offset: number): Promise<DrillDownResult> {
  const [yr, mo] = value.split("-").map(Number)
  const from = new Date(yr, mo - 1, 1).toISOString()
  const to   = new Date(yr, mo,     1).toISOString()

  const COLS: DrillDownColumn[] = [
    { key: "name",         label: "Name" },
    { key: "email",        label: "Email" },
    { key: "roles",        label: "Roles" },
    { key: "company_name", label: "Company" },
    { key: "is_active",    label: "Active" },
    { key: "created_at",   label: "Joined", format: "date" },
  ]

  const BASE = `
    FROM public.users u
    LEFT JOIN public.applicants ap ON ap.user_id = u.id
    LEFT JOIN public.companies c   ON c.id = u.company_id
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    LEFT JOIN public.roles r       ON r.id = ur.role_id
    WHERE u.created_at >= $1 AND u.created_at < $2
    GROUP BY u.id, u.email, u.is_active, u.created_at, ap.first_name, ap.last_name, c.name
  `

  const [cnt, rows] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT u.id) AS count FROM public.users u WHERE u.created_at >= $1 AND u.created_at < $2`,
      [from, to],
    ),
    pool.query<Record<string, unknown>>(`
      SELECT
        CONCAT(ap.first_name, ' ', ap.last_name) AS name,
        u.email,
        u.is_active,
        u.created_at,
        c.name AS company_name,
        COALESCE(string_agg(DISTINCT r.name, ', ' ORDER BY r.name), '') AS roles
      ${BASE}
      ORDER BY u.created_at DESC LIMIT $3 OFFSET $4
    `, [from, to, limit, offset]),
  ])
  return { total: parseInt(cnt.rows[0]?.count ?? "0", 10), rows: rows.rows, columns: COLS }
}

async function drillAiMonth(pool: Pool, value: string, limit: number, offset: number): Promise<DrillDownResult> {
  const [yr, mo] = value.split("-").map(Number)
  const from = new Date(yr, mo - 1, 1).toISOString()
  const to   = new Date(yr, mo,     1).toISOString()

  const COLS: DrillDownColumn[] = [
    { key: "email",      label: "User" },
    { key: "mode",       label: "Mode" },
    { key: "model",      label: "Model" },
    { key: "created_at", label: "When", format: "date" },
  ]

  const [cnt, rows] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM public.chat_logs cl WHERE cl.created_at >= $1 AND cl.created_at < $2`,
      [from, to],
    ),
    pool.query<Record<string, unknown>>(`
      SELECT u.email, cl.mode, cl.model, cl.created_at
      FROM public.chat_logs cl
      LEFT JOIN public.users u ON u.id = cl.user_id
      WHERE cl.created_at >= $1 AND cl.created_at < $2
      ORDER BY cl.created_at DESC LIMIT $3 OFFSET $4
    `, [from, to, limit, offset]),
  ])
  return { total: parseInt(cnt.rows[0]?.count ?? "0", 10), rows: rows.rows, columns: COLS }
}

export async function getDrillDownRows(opts: {
  type: string
  value: string
  page: number
  limit: number
}): Promise<DrillDownResult> {
  const pool = getDbPool()
  const { type, value, page, limit } = opts
  const offset = (page - 1) * limit

  try {
    switch (type) {
      case "apps-month":  return await drillAppsMonth(pool, value, limit, offset)
      case "apps-status": return await drillAppsStatus(pool, value, limit, offset)
      case "users-month": return await drillUsersMonth(pool, value, limit, offset)
      case "ai-month":    return await drillAiMonth(pool, value, limit, offset)
      default:            return { rows: [], total: 0, columns: [] }
    }
  } catch (err) {
    console.error("[getDrillDownRows] query failed", { type, value }, err)
    return { rows: [], total: 0, columns: [] }
  }
}

// ── CSV export helpers (unchanged) ───────────────────────────────────────────

export async function getApplicationsForExport(opts: {
  status?: string
  from?: string
  to?: string
}): Promise<ApplicationExportRow[]> {
  const pool = getDbPool()
  const conditions: string[] = ["1=1"]
  const params: unknown[] = []
  let p = 1

  if (opts.status) { conditions.push(`a.status = $${p++}`);           params.push(opts.status) }
  if (opts.from)   { conditions.push(`a.created_at >= $${p++}`);      params.push(opts.from) }
  if (opts.to)     { conditions.push(`a.created_at <= $${p++}`);      params.push(opts.to) }

  const result = await pool.query<ApplicationExportRow>(
    `
    SELECT a.id, a.status, a.household_size, a.total_monthly_income, a.confidence_score,
           a.created_at, a.submitted_at, a.decided_at,
           ap.first_name, ap.last_name, u.email,
           es.estimated_program, es.fpl_percentage
    FROM public.applications a
    JOIN public.applicants ap ON ap.id = a.applicant_id
    JOIN public.users u       ON u.id  = ap.user_id
    LEFT JOIN LATERAL (
      SELECT estimated_program, fpl_percentage
      FROM public.eligibility_screenings
      WHERE application_id = a.id
      ORDER BY created_at DESC LIMIT 1
    ) es ON true
    WHERE ${conditions.join(" AND ")}
    ORDER BY a.created_at DESC LIMIT 10000
    `,
    params,
  )
  return result.rows
}

export async function getUsersForExport(): Promise<UserExportRow[]> {
  const pool = getDbPool()
  const result = await pool.query<UserExportRow>(`
    SELECT u.id, u.email, u.is_active, u.created_at,
           ap.first_name, ap.last_name, c.name AS company_name,
           COALESCE(string_agg(DISTINCT r.name, ', ' ORDER BY r.name), '') AS roles
    FROM public.users u
    LEFT JOIN public.applicants ap ON ap.user_id = u.id
    LEFT JOIN public.companies c   ON c.id = u.company_id
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    LEFT JOIN public.roles r       ON r.id = ur.role_id
    GROUP BY u.id, u.email, u.is_active, u.created_at, ap.first_name, ap.last_name, c.name
    ORDER BY u.created_at DESC LIMIT 10000
  `)
  return result.rows
}
