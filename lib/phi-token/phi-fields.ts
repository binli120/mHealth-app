/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * PHI fields within WizardState.data that must never be persisted on the server.
 *
 * ACA-3:
 *   contact  — applicant name, address, SSN, DOB, phone, citizenship, language prefs
 *   preApp   — pre-application personal questions
 *   persons  — household member identities, SSNs, DOBs, incomes, coverage details
 * SACA-2 (see SACA2_PHI_KEYS in lib/masshealth/saca2/types.ts):
 *   screening, persons, aian, previousMedicalBills, assets, transfers, health, pca,
 *   supplements — everything except the `intake` and `signature` keys.
 *   signing — a responsible party's identity (SACA-2 Step 10).
 *   attachments — ARD-1122 representative and IRS 4506 data (SACA-2).
 *
 * These keys are stripped from wizard state before any server PUT and before
 * any DB write. PHI travels only in the encrypted client-side resume blob.
 * This module is pure (no browser crypto), so server code may import it.
 */
export const PHI_DATA_KEYS = [
  "contact",
  "preApp",
  "persons",
  "screening",
  "aian",
  "previousMedicalBills",
  "assets",
  "transfers",
  "health",
  "pca",
  "supplements",
  "signing",
  "attachments",
] as const

export type PhiDataKey = (typeof PHI_DATA_KEYS)[number]

export const PHI_DATA_KEY_SET: ReadonlySet<string> = new Set(PHI_DATA_KEYS)
