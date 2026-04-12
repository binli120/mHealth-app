/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"

let ensureUserLifecycleSchemaPromise: Promise<void> | null = null

export interface AdminUser {
  id: string
  email: string
  is_active: boolean
  lifecycle_status: UserLifecycleStatus
  created_at: string
  roles: string[]
  first_name: string | null
  last_name: string | null
  company_id: string | null
  company_name: string | null
  is_patient: boolean
}

export type UserLifecycleStatus = "active" | "inactive" | "deleted"

const STAFF_ROLE_NAMES = new Set(["admin", "social_worker", "reviewer"])

async function ensureUserLifecycleSchema(): Promise<void> {
  if (!ensureUserLifecycleSchemaPromise) {
    ensureUserLifecycleSchemaPromise = (async () => {
      const pool = getDbPool()
      await pool.query(`
        ALTER TABLE public.users
          ADD COLUMN IF NOT EXISTS lifecycle_status TEXT
      `)

      await pool.query(`
        UPDATE public.users
        SET lifecycle_status = CASE
          WHEN is_active THEN 'active'
          ELSE 'inactive'
        END
        WHERE lifecycle_status IS NULL
      `)

      await pool.query(`
        ALTER TABLE public.users
          ALTER COLUMN lifecycle_status SET DEFAULT 'active'
      `)

      await pool.query(`
        ALTER TABLE public.users
          ALTER COLUMN lifecycle_status SET NOT NULL
      `)

      await pool.query(`
        ALTER TABLE public.users
          DROP CONSTRAINT IF EXISTS users_lifecycle_status_check
      `)

      await pool.query(`
        ALTER TABLE public.users
          ADD CONSTRAINT users_lifecycle_status_check
          CHECK (lifecycle_status IN ('active', 'inactive', 'deleted'))
      `)

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_lifecycle_status
          ON public.users(lifecycle_status)
      `)
    })().catch((error) => {
      ensureUserLifecycleSchemaPromise = null
      throw error
    })
  }

  await ensureUserLifecycleSchemaPromise
}

export interface CompanySelectOption {
  id: string
  name: string
  email_domain: string | null
  status: string
}

export interface AdminCompany {
  id: string
  name: string
  npi: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email_domain: string | null
  status: "pending" | "approved" | "rejected"
  created_at: string
  approved_at: string | null
  sw_count: number
}

export interface AdminSocialWorker {
  id: string
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company_id: string
  company_name: string
  license_number: string | null
  job_title: string | null
  status: "pending" | "approved" | "rejected"
  rejection_note: string | null
  created_at: string
}

export async function listUsers(opts: {
  search?: string
  role?: string
  companyId?: string
  limit?: number
  offset?: number
}): Promise<{ users: AdminUser[]; total: number }> {
  await ensureUserLifecycleSchema()

  const pool = getDbPool()
  const { search, role, companyId, limit = 50, offset = 0 } = opts

  const conditions: string[] = ["1=1"]
  const params: unknown[] = []
  let paramIdx = 1

  if (search) {
    conditions.push(`(u.email ILIKE $${paramIdx} OR ap.first_name ILIKE $${paramIdx} OR ap.last_name ILIKE $${paramIdx})`)
    params.push(`%${search}%`)
    paramIdx++
  }

  if (role) {
    conditions.push(`EXISTS (
      SELECT 1 FROM public.user_roles ur2
      JOIN public.roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.name = $${paramIdx}
    )`)
    params.push(role)
    paramIdx++
  }

  if (companyId) {
    conditions.push(`u.company_id = $${paramIdx}::uuid`)
    params.push(companyId)
    paramIdx++
  }

  const whereClause = conditions.join(" AND ")

  const countResult = await pool.query<{ count: string }>(
    `
      SELECT COUNT(DISTINCT u.id) AS count
      FROM public.users u
      LEFT JOIN public.applicants ap ON ap.user_id = u.id
      WHERE ${whereClause}
    `,
    params,
  )

  const usersResult = await pool.query<{
    id: string
    email: string
    is_active: boolean
    lifecycle_status: UserLifecycleStatus
    created_at: string
    roles: string
    first_name: string | null
    last_name: string | null
    company_id: string | null
    company_name: string | null
    has_applicant_profile: boolean
  }>(
    `
      SELECT
        u.id,
        u.email,
        u.is_active,
        u.lifecycle_status,
        u.created_at,
        ap.first_name,
        ap.last_name,
        u.company_id,
        c.name AS company_name,
        (ap.user_id IS NOT NULL) AS has_applicant_profile,
        COALESCE(
          string_agg(DISTINCT r.name, ',' ORDER BY r.name),
          ''
        ) AS roles
      FROM public.users u
      LEFT JOIN public.applicants ap ON ap.user_id = u.id
      LEFT JOIN public.companies c ON c.id = u.company_id
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
      LEFT JOIN public.roles r ON r.id = ur.role_id
      WHERE ${whereClause}
      GROUP BY
        u.id,
        u.email,
        u.is_active,
        u.lifecycle_status,
        u.created_at,
        ap.user_id,
        ap.first_name,
        ap.last_name,
        u.company_id,
        c.name
      ORDER BY u.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    [...params, limit, offset],
  )

  return {
    users: usersResult.rows.map((row) => {
      const roles = row.roles ? row.roles.split(",") : []
      const hasStaffRole = roles.some((roleName) => STAFF_ROLE_NAMES.has(roleName))

      return {
        ...row,
        roles,
        is_patient: row.has_applicant_profile && !hasStaffRole,
      }
    }),
    total: parseInt(countResult.rows[0]?.count ?? "0", 10),
  }
}

/** Lightweight list of all approved companies for select dropdowns. */
export async function listCompaniesForSelect(): Promise<CompanySelectOption[]> {
  const pool = getDbPool()
  const result = await pool.query<CompanySelectOption>(
    `SELECT id, name, email_domain, status
     FROM public.companies
     ORDER BY name ASC`,
  )
  return result.rows
}

export async function setUserLifecycleStatus(
  userId: string,
  lifecycleStatus: UserLifecycleStatus,
): Promise<void> {
  await ensureUserLifecycleSchema()

  const pool = getDbPool()
  await pool.query(
    `
      UPDATE public.users
      SET
        is_active = CASE WHEN $1 = 'active' THEN true ELSE false END,
        lifecycle_status = $1
      WHERE id = $2::uuid
    `,
    [lifecycleStatus, userId],
  )
}

export async function setUserRole(userId: string, roleName: string, add: boolean): Promise<void> {
  const pool = getDbPool()
  if (add) {
    await pool.query(
      `
        INSERT INTO public.user_roles (user_id, role_id)
        SELECT $1::uuid, r.id FROM public.roles r WHERE r.name = $2
        ON CONFLICT DO NOTHING
      `,
      [userId, roleName],
    )
  } else {
    await pool.query(
      `
        DELETE FROM public.user_roles
        WHERE user_id = $1::uuid
          AND role_id = (SELECT id FROM public.roles WHERE name = $2)
      `,
      [userId, roleName],
    )
  }
}

export async function softDeletePatientUser(userId: string): Promise<void> {
  await ensureUserLifecycleSchema()

  const pool = getDbPool()
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const userResult = await client.query<{
      has_applicant_profile: boolean
      roles: string[]
    }>(
      `
        SELECT
          EXISTS (
            SELECT 1
            FROM public.applicants ap
            WHERE ap.user_id = $1::uuid
          ) AS has_applicant_profile,
          COALESCE(
            array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL),
            ARRAY[]::text[]
          ) AS roles
        FROM public.users u
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        LEFT JOIN public.roles r ON r.id = ur.role_id
        WHERE u.id = $1::uuid
        GROUP BY u.id
      `,
      [userId],
    )

    if (userResult.rowCount === 0) {
      throw new Error("User not found.")
    }

    const user = userResult.rows[0]
    const hasStaffRole = user.roles.some((roleName) => STAFF_ROLE_NAMES.has(roleName))
    if (!user.has_applicant_profile || hasStaffRole) {
      throw new Error("Only patient/applicant users can be deleted.")
    }

    await client.query(
      `
        UPDATE public.users
        SET
          is_active = false,
          lifecycle_status = 'deleted'
        WHERE id = $1::uuid
      `,
      [userId],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function listCompanies(opts: {
  search?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ companies: AdminCompany[]; total: number }> {
  const pool = getDbPool()
  const { search, status, limit = 50, offset = 0 } = opts

  const conditions: string[] = ["1=1"]
  const params: unknown[] = []
  let paramIdx = 1

  if (search) {
    conditions.push(`c.name ILIKE $${paramIdx}`)
    params.push(`%${search}%`)
    paramIdx++
  }

  if (status) {
    conditions.push(`c.status = $${paramIdx}`)
    params.push(status)
    paramIdx++
  }

  const whereClause = conditions.join(" AND ")

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM public.companies c WHERE ${whereClause}`,
    params,
  )

  const result = await pool.query<AdminCompany>(
    `
      SELECT
        c.id, c.name, c.npi, c.address, c.city, c.state, c.zip,
        c.phone, c.email_domain, c.status,
        c.created_at, c.approved_at,
        COUNT(swp.id)::int AS sw_count
      FROM public.companies c
      LEFT JOIN public.social_worker_profiles swp ON swp.company_id = c.id
      WHERE ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    [...params, limit, offset],
  )

  return {
    companies: result.rows,
    total: parseInt(countResult.rows[0]?.count ?? "0", 10),
  }
}

export async function createCompany(data: {
  name: string
  npi?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  email_domain?: string
}): Promise<AdminCompany> {
  const pool = getDbPool()
  const result = await pool.query<AdminCompany>(
    `
      INSERT INTO public.companies (name, npi, address, city, state, zip, phone, email_domain, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *, 0 AS sw_count
    `,
    [
      data.name,
      data.npi ?? null,
      data.address ?? null,
      data.city ?? null,
      data.state ?? null,
      data.zip ?? null,
      data.phone ?? null,
      data.email_domain ?? null,
    ],
  )
  return result.rows[0]
}

export async function updateCompanyStatus(
  companyId: string,
  status: "approved" | "rejected",
  adminUserId: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `
      UPDATE public.companies
      SET status = $1,
          approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE NULL END,
          approved_by = $2::uuid
      WHERE id = $3::uuid
    `,
    [status, adminUserId, companyId],
  )
}

export async function updateCompanyEmailDomain(companyId: string, emailDomain: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE public.companies SET email_domain = $1 WHERE id = $2::uuid`,
    [emailDomain, companyId],
  )
}

export async function listSocialWorkers(opts: {
  search?: string
  status?: string
  companyId?: string
  limit?: number
  offset?: number
}): Promise<{ socialWorkers: AdminSocialWorker[]; total: number }> {
  const pool = getDbPool()
  const { search, status, companyId, limit = 50, offset = 0 } = opts

  const conditions: string[] = ["1=1"]
  const params: unknown[] = []
  let paramIdx = 1

  if (search) {
    conditions.push(`(u.email ILIKE $${paramIdx} OR ap.first_name ILIKE $${paramIdx} OR ap.last_name ILIKE $${paramIdx})`)
    params.push(`%${search}%`)
    paramIdx++
  }

  if (status) {
    conditions.push(`swp.status = $${paramIdx}`)
    params.push(status)
    paramIdx++
  }

  if (companyId) {
    conditions.push(`swp.company_id = $${paramIdx}::uuid`)
    params.push(companyId)
    paramIdx++
  }

  const whereClause = conditions.join(" AND ")

  const countResult = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM public.social_worker_profiles swp
      JOIN public.users u ON u.id = swp.user_id
      LEFT JOIN public.applicants ap ON ap.user_id = u.id
      JOIN public.companies c ON c.id = swp.company_id
      WHERE ${whereClause}
    `,
    params,
  )

  const result = await pool.query<AdminSocialWorker>(
    `
      SELECT
        swp.id, swp.user_id, u.email,
        ap.first_name, ap.last_name,
        swp.company_id, c.name AS company_name,
        swp.license_number, swp.job_title,
        swp.status, swp.rejection_note, swp.created_at
      FROM public.social_worker_profiles swp
      JOIN public.users u ON u.id = swp.user_id
      LEFT JOIN public.applicants ap ON ap.user_id = u.id
      JOIN public.companies c ON c.id = swp.company_id
      WHERE ${whereClause}
      ORDER BY swp.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    [...params, limit, offset],
  )

  return {
    socialWorkers: result.rows,
    total: parseInt(countResult.rows[0]?.count ?? "0", 10),
  }
}

export async function updateSocialWorkerStatus(
  profileId: string,
  status: "approved" | "rejected",
  adminUserId: string,
  rejectionNote?: string,
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `
      UPDATE public.social_worker_profiles
      SET status = $1,
          rejection_note = $2,
          approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE NULL END,
          approved_by = $3::uuid
      WHERE id = $4::uuid
    `,
    [status, rejectionNote ?? null, adminUserId, profileId],
  )
}

export async function getAdminStats(): Promise<{
  totalUsers: number
  pendingSwApprovals: number
  totalCompanies: number
  pendingCompanies: number
}> {
  const pool = getDbPool()
  const result = await pool.query<{
    total_users: string
    pending_sw: string
    total_companies: string
    pending_companies: string
  }>(`
    SELECT
      (SELECT COUNT(*) FROM public.users)::text AS total_users,
      (SELECT COUNT(*) FROM public.social_worker_profiles WHERE status = 'pending')::text AS pending_sw,
      (SELECT COUNT(*) FROM public.companies)::text AS total_companies,
      (SELECT COUNT(*) FROM public.companies WHERE status = 'pending')::text AS pending_companies
  `)

  const row = result.rows[0]
  return {
    totalUsers: parseInt(row.total_users, 10),
    pendingSwApprovals: parseInt(row.pending_sw, 10),
    totalCompanies: parseInt(row.total_companies, 10),
    pendingCompanies: parseInt(row.pending_companies, 10),
  }
}
