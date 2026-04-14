/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "./server"
import type { FamilyProfile, BenefitStack } from "@/lib/benefit-orchestration/types"

// ── Family Profile ─────────────────────────────────────────────────────────

export async function getApplicantIdByUserId(userId: string): Promise<string | null> {
  const pool = getDbPool()
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM applicants WHERE user_id = $1 LIMIT 1",
    [userId]
  )
  return result.rows[0]?.id ?? null
}

export async function getFamilyProfile(userId: string): Promise<{
  id: string
  applicantId: string
  profileData: FamilyProfile
  updatedAt: string
} | null> {
  const pool = getDbPool()
  const result = await pool.query<{
    id: string
    applicant_id: string
    profile_data: FamilyProfile
    updated_at: string
  }>(
    `SELECT fp.id, fp.applicant_id, fp.profile_data, fp.updated_at
     FROM family_profiles fp
     JOIN applicants a ON a.id = fp.applicant_id
     WHERE a.user_id = $1
     LIMIT 1`,
    [userId]
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    applicantId: row.applicant_id,
    profileData: row.profile_data,
    updatedAt: row.updated_at,
  }
}

export async function upsertFamilyProfile(
  userId: string,
  profileData: FamilyProfile
): Promise<{ id: string; applicantId: string }> {
  const pool = getDbPool()

  // Get or verify applicant record
  const applicantResult = await pool.query<{ id: string }>(
    "SELECT id FROM applicants WHERE user_id = $1 LIMIT 1",
    [userId]
  )
  const applicantId = applicantResult.rows[0]?.id
  if (!applicantId) {
    throw new Error("Applicant profile not found. Please complete registration first.")
  }

  // Upsert the family profile (one per applicant)
  const upsertResult = await pool.query<{ id: string; applicant_id: string }>(
    `INSERT INTO family_profiles (applicant_id, profile_data)
     VALUES ($1, $2)
     ON CONFLICT (applicant_id)
     DO UPDATE SET profile_data = EXCLUDED.profile_data, updated_at = now()
     RETURNING id, applicant_id`,
    [applicantId, JSON.stringify({ ...profileData, applicantId })]
  )

  const row = upsertResult.rows[0]
  if (!row) throw new Error("Failed to save family profile.")

  return { id: row.id, applicantId: row.applicant_id }
}

// ── Benefit Stack Results ──────────────────────────────────────────────────

export async function saveStackResult(
  familyProfileId: string,
  stack: BenefitStack
): Promise<{ id: string }> {
  const pool = getDbPool()
  const result = await pool.query<{ id: string }>(
    `INSERT INTO benefit_stack_results (family_profile_id, stack_data, generated_at)
     VALUES ($1, $2, now())
     RETURNING id`,
    [familyProfileId, JSON.stringify(stack)]
  )
  const row = result.rows[0]
  if (!row) throw new Error("Failed to save benefit stack result.")
  return { id: row.id }
}

export async function getLatestStackResult(userId: string): Promise<{
  id: string
  stackData: BenefitStack
  generatedAt: string
} | null> {
  const pool = getDbPool()
  const result = await pool.query<{
    id: string
    stack_data: BenefitStack
    generated_at: string
  }>(
    `SELECT bsr.id, bsr.stack_data, bsr.generated_at
     FROM benefit_stack_results bsr
     JOIN family_profiles fp ON fp.id = bsr.family_profile_id
     JOIN applicants a ON a.id = fp.applicant_id
     WHERE a.user_id = $1
     ORDER BY bsr.generated_at DESC
     LIMIT 1`,
    [userId]
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    stackData: row.stack_data,
    generatedAt: row.generated_at,
  }
}
