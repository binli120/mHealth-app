// lib/db/insurance-history.ts
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "@/lib/db/server"
import type {
  CoverageRecord,
  InsuranceExplanation,
  CoverageSource,
  ExplanationGeneratedBy,
  ChangeFactor,
} from "@/lib/insurance-history/types"

function rowToCoverageRecord(row: Record<string, unknown>): CoverageRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    coverageYear: row.coverage_year as number,
    planName: row.plan_name as string,
    programCode: row.program_code as string | null,
    premiumMonthly: row.premium_monthly != null ? Number(row.premium_monthly) : null,
    householdSize: row.household_size as number | null,
    annualIncome: row.annual_income != null ? Number(row.annual_income) : null,
    fplPercent: row.fpl_percent != null ? Number(row.fpl_percent) : null,
    source: row.source as CoverageSource,
    applicationId: row.application_id as string | null,
    documentId: row.document_id as string | null,
    notes: row.notes as string | null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  }
}

function rowToExplanation(row: Record<string, unknown>): InsuranceExplanation {
  return {
    id: row.id as string,
    coverageRecordId: row.coverage_record_id as string,
    priorRecordId: row.prior_record_id as string | null,
    changeFactors: row.change_factors as ChangeFactor,
    explanationText: row.explanation_text as string,
    generatedBy: row.generated_by as ExplanationGeneratedBy,
    generatedAt: (row.generated_at as Date).toISOString(),
  }
}

export async function listCoverageRecords(userId: string): Promise<CoverageRecord[]> {
  const pool = getDbPool()
  const result = await pool.query(
    `SELECT * FROM public.insurance_coverage_records
     WHERE user_id = $1
     ORDER BY coverage_year DESC`,
    [userId],
  )
  return result.rows.map(rowToCoverageRecord)
}

export async function getCoverageRecord(id: string, userId: string): Promise<CoverageRecord | null> {
  const pool = getDbPool()
  const result = await pool.query(
    `SELECT * FROM public.insurance_coverage_records WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  return result.rows[0] ? rowToCoverageRecord(result.rows[0]) : null
}

export interface CreateCoverageRecordInput {
  userId: string
  coverageYear: number
  planName: string
  programCode?: string | null
  premiumMonthly?: number | null
  householdSize?: number | null
  annualIncome?: number | null
  fplPercent?: number | null
  source: CoverageSource
  applicationId?: string | null
  documentId?: string | null
  notes?: string | null
}

export async function createCoverageRecord(input: CreateCoverageRecordInput): Promise<CoverageRecord> {
  const pool = getDbPool()
  const result = await pool.query(
    `INSERT INTO public.insurance_coverage_records
       (user_id, coverage_year, plan_name, program_code, premium_monthly,
        household_size, annual_income, fpl_percent, source, application_id, document_id, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      input.userId,
      input.coverageYear,
      input.planName,
      input.programCode ?? null,
      input.premiumMonthly ?? null,
      input.householdSize ?? null,
      input.annualIncome ?? null,
      input.fplPercent ?? null,
      input.source,
      input.applicationId ?? null,
      input.documentId ?? null,
      input.notes ?? null,
    ],
  )
  if (!result.rows[0]) throw new Error("Failed to create coverage record")
  return rowToCoverageRecord(result.rows[0])
}

export interface UpdateCoverageRecordInput {
  planName?: string
  programCode?: string | null
  premiumMonthly?: number | null
  householdSize?: number | null
  annualIncome?: number | null
  fplPercent?: number | null
  notes?: string | null
}

export async function updateCoverageRecord(
  id: string,
  userId: string,
  input: UpdateCoverageRecordInput,
): Promise<CoverageRecord | null> {
  const pool = getDbPool()
  const result = await pool.query(
    `UPDATE public.insurance_coverage_records
     SET plan_name = COALESCE($3, plan_name),
         program_code = COALESCE($4, program_code),
         premium_monthly = COALESCE($5, premium_monthly),
         household_size = COALESCE($6, household_size),
         annual_income = COALESCE($7, annual_income),
         fpl_percent = COALESCE($8, fpl_percent),
         notes = COALESCE($9, notes),
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, input.planName, input.programCode, input.premiumMonthly,
     input.householdSize, input.annualIncome, input.fplPercent, input.notes],
  )
  return result.rows[0] ? rowToCoverageRecord(result.rows[0]) : null
}

export async function deleteCoverageRecord(id: string, userId: string): Promise<boolean> {
  const pool = getDbPool()
  const result = await pool.query(
    `DELETE FROM public.insurance_coverage_records WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  return (result.rowCount ?? 0) > 0
}

export async function getExplanation(coverageRecordId: string): Promise<InsuranceExplanation | null> {
  const pool = getDbPool()
  const result = await pool.query(
    `SELECT * FROM public.insurance_explanations WHERE coverage_record_id = $1`,
    [coverageRecordId],
  )
  return result.rows[0] ? rowToExplanation(result.rows[0]) : null
}

export interface SaveExplanationInput {
  coverageRecordId: string
  priorRecordId: string | null
  changeFactors: ChangeFactor
  explanationText: string
  generatedBy: ExplanationGeneratedBy
}

export async function saveExplanation(input: SaveExplanationInput): Promise<InsuranceExplanation> {
  const pool = getDbPool()
  const result = await pool.query(
    `INSERT INTO public.insurance_explanations
       (coverage_record_id, prior_record_id, change_factors, explanation_text, generated_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (coverage_record_id) DO UPDATE
       SET change_factors = EXCLUDED.change_factors,
           explanation_text = EXCLUDED.explanation_text,
           generated_by = EXCLUDED.generated_by,
           generated_at = now()
     RETURNING *`,
    [
      input.coverageRecordId,
      input.priorRecordId,
      JSON.stringify(input.changeFactors),
      input.explanationText,
      input.generatedBy,
    ],
  )
  if (!result.rows[0]) throw new Error("Failed to save explanation")
  return rowToExplanation(result.rows[0])
}

/** Called automatically when an application is approved. Upserts a platform-derived record. */
export async function autoPopulateCoverageRecord(params: {
  userId: string
  coverageYear: number
  planName: string
  programCode: string
  householdSize: number | null
  annualIncome: number | null
  fplPercent: number | null
  applicationId: string
}): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO public.insurance_coverage_records
       (user_id, coverage_year, plan_name, program_code, household_size,
        annual_income, fpl_percent, source, application_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'platform',$8)
     ON CONFLICT (user_id, coverage_year) DO NOTHING`,
    [
      params.userId,
      params.coverageYear,
      params.planName,
      params.programCode,
      params.householdSize,
      params.annualIncome,
      params.fplPercent,
      params.applicationId,
    ],
  )
}
