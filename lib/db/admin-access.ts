/**
 * DB helpers for Role & Permission Manager, Session Management, and Bulk Actions.
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { getDbPool } from "@/lib/db/server"
import type { Permission } from "@/lib/constants/permissions"

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoleRow = {
  name: string
  description: string | null
  color: string
  is_system: boolean
  user_count: number
  permissions: Permission[]
}

export type SessionRow = {
  id: string
  user_id: string | null
  email: string | null
  full_name: string | null
  event_type: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type AdminSetting = {
  key: string
  value: string
}

export type BulkResult = {
  updated: number
  errors: string[]
}

export type CsvImportRow = {
  email: string
  first_name: string
  last_name: string
  role: string
  company_id?: string
}

// ── Role helpers ──────────────────────────────────────────────────────────────

export async function listRoles(): Promise<RoleRow[]> {
  const pool = getDbPool()

  const [rolesRes, permRes, countsRes] = await Promise.all([
    pool.query<{ name: string; description: string | null; color: string; is_system: boolean }>(
      `SELECT name, description, color, is_system FROM public.roles ORDER BY
        CASE name WHEN 'admin' THEN 0 WHEN 'social_worker' THEN 1 WHEN 'reviewer' THEN 2
          WHEN 'supervisor' THEN 3 WHEN 'case_reviewer' THEN 4 WHEN 'read_only_staff' THEN 5
          WHEN 'applicant' THEN 6 ELSE 7 END`,
    ),
    pool.query<{ role_name: string; permission: string }>(
      `SELECT role_name, permission FROM public.role_permissions ORDER BY role_name`,
    ),
    pool.query<{ role_name: string; cnt: string }>(
      `SELECT r.name AS role_name, COUNT(ur.user_id)::text AS cnt
         FROM public.roles r
         LEFT JOIN public.user_roles ur ON ur.role_name = r.name
         GROUP BY r.name`,
    ).catch(() =>
      pool.query<{ role_name: string; cnt: string }>(
        `SELECT r.name AS role_name, COUNT(ur.user_id)::text AS cnt
           FROM public.roles r
           LEFT JOIN public.users u ON u.role = r.name
           GROUP BY r.name`,
      ),
    ),
  ])

  const permMap = new Map<string, Permission[]>()
  for (const row of permRes.rows) {
    if (!permMap.has(row.role_name)) permMap.set(row.role_name, [])
    permMap.get(row.role_name)!.push(row.permission as Permission)
  }

  const countMap = new Map<string, number>()
  for (const row of countsRes.rows) {
    countMap.set(row.role_name, parseInt(row.cnt, 10))
  }

  return rolesRes.rows.map((r) => ({
    ...r,
    user_count: countMap.get(r.name) ?? 0,
    permissions: permMap.get(r.name) ?? [],
  }))
}

export async function updateRolePermissions(roleName: string, permissions: Permission[]): Promise<void> {
  const pool = getDbPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(`DELETE FROM public.role_permissions WHERE role_name = $1`, [roleName])
    if (permissions.length > 0) {
      const values = permissions
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ")
      await client.query(
        `INSERT INTO public.role_permissions (role_name, permission) VALUES ${values} ON CONFLICT DO NOTHING`,
        [roleName, ...permissions],
      )
    }
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

export async function createRole(
  name: string,
  description: string,
  color: string,
  permissions: Permission[],
): Promise<void> {
  const pool = getDbPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `INSERT INTO public.roles (name, description, color, is_system) VALUES ($1, $2, $3, false)`,
      [name, description, color],
    )
    if (permissions.length > 0) {
      const values = permissions.map((_, i) => `($1, $${i + 2})`).join(", ")
      await client.query(
        `INSERT INTO public.role_permissions (role_name, permission) VALUES ${values}`,
        [name, ...permissions],
      )
    }
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

export async function deleteRole(name: string): Promise<{ deleted: boolean; reason?: string }> {
  const pool = getDbPool()
  // Guard: refuse to delete system roles
  const check = await pool.query<{ is_system: boolean }>(
    `SELECT is_system FROM public.roles WHERE name = $1`,
    [name],
  )
  if (!check.rows[0]) return { deleted: false, reason: "Role not found" }
  if (check.rows[0].is_system) return { deleted: false, reason: "Cannot delete a system role" }

  await pool.query(`DELETE FROM public.roles WHERE name = $1`, [name])
  return { deleted: true }
}

// ── Admin settings ────────────────────────────────────────────────────────────

export async function getAdminSettings(): Promise<Record<string, string>> {
  const pool = getDbPool()
  const res = await pool.query<AdminSetting>(`SELECT key, value FROM public.admin_settings`)
  return Object.fromEntries(res.rows.map((r) => [r.key, r.value]))
}

export async function upsertAdminSetting(key: string, value: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO public.admin_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [key, value],
  )
}

// ── Session helpers ───────────────────────────────────────────────────────────

export async function logLoginEvent(
  userId: string | null,
  eventType: "login" | "logout" | "force_logout",
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO public.login_events (user_id, event_type, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
    [userId, eventType, ipAddress ?? null, userAgent ?? null],
  ).catch(() => {/* never fail the caller */})
}

export async function listActiveSessions(limit = 100): Promise<SessionRow[]> {
  const pool = getDbPool()
  // "Active" = most recent login_event per user is a 'login' (not logout/force_logout)
  // We show recent logins with user info for the table
  const res = await pool.query<SessionRow>(
    `SELECT
       le.id,
       le.user_id,
       u.email,
       TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS full_name,
       le.event_type,
       le.ip_address::text,
       le.user_agent,
       le.created_at::text
     FROM public.login_events le
     LEFT JOIN public.users u ON u.id = le.user_id
     ORDER BY le.created_at DESC
     LIMIT $1`,
    [limit],
  )
  return res.rows
}

// ── Bulk actions ──────────────────────────────────────────────────────────────

export async function bulkSetActive(userIds: string[], isActive: boolean): Promise<BulkResult> {
  if (userIds.length === 0) return { updated: 0, errors: [] }
  const pool = getDbPool()
  const placeholders = userIds.map((_, i) => `$${i + 2}`).join(", ")
  const res = await pool.query(
    `UPDATE public.users SET is_active = $1, updated_at = now()
       WHERE id IN (${placeholders})`,
    [isActive, ...userIds],
  )
  return { updated: res.rowCount ?? 0, errors: [] }
}

export async function bulkSetRole(userIds: string[], role: string): Promise<BulkResult> {
  if (userIds.length === 0) return { updated: 0, errors: [] }
  const pool = getDbPool()

  // Try user_roles junction table first, fall back to users.role column
  try {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      for (const uid of userIds) {
        // Remove old non-system roles and add new one via junction table
        await client.query(
          `DELETE FROM public.user_roles WHERE user_id = $1`,
          [uid],
        )
        await client.query(
          `INSERT INTO public.user_roles (user_id, role_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [uid, role],
        )
      }
      await client.query("COMMIT")
      return { updated: userIds.length, errors: [] }
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    } finally {
      client.release()
    }
  } catch {
    // Fallback: single role column
    const placeholders = userIds.map((_, i) => `$${i + 2}`).join(", ")
    const res = await pool.query(
      `UPDATE public.users SET role = $1, updated_at = now() WHERE id IN (${placeholders})`,
      [role, ...userIds],
    )
    return { updated: res.rowCount ?? 0, errors: [] }
  }
}

export async function bulkImportUsers(rows: CsvImportRow[]): Promise<BulkResult> {
  if (rows.length === 0) return { updated: 0, errors: [] }
  const pool = getDbPool()
  let updated = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      await pool.query(
        `INSERT INTO public.users (email, first_name, last_name, role, company_id, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, now(), now())
           ON CONFLICT (email) DO UPDATE
             SET first_name  = EXCLUDED.first_name,
                 last_name   = EXCLUDED.last_name,
                 role        = EXCLUDED.role,
                 company_id  = COALESCE(EXCLUDED.company_id, public.users.company_id),
                 updated_at  = now()`,
        [
          row.email.toLowerCase().trim(),
          row.first_name.trim(),
          row.last_name.trim(),
          row.role || "applicant",
          row.company_id || null,
        ],
      )
      updated++
    } catch (err) {
      errors.push(`${row.email}: ${String(err)}`)
    }
  }

  return { updated, errors }
}
