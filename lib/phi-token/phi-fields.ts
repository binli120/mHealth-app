/**
 * PHI fields within WizardState.data that must never be persisted on the server.
 *
 * contact  — applicant name, address, SSN, DOB, phone, citizenship, language prefs
 * preApp   — pre-application personal questions
 * persons  — household member identities, SSNs, DOBs, incomes, coverage details
 *
 * These keys are stripped from wizard state before any server PUT and before
 * any DB write. PHI travels only in the encrypted client-side resume token.
 */
export const PHI_DATA_KEYS = ["contact", "preApp", "persons"] as const

export type PhiDataKey = (typeof PHI_DATA_KEYS)[number]

export const PHI_DATA_KEY_SET: ReadonlySet<string> = new Set(PHI_DATA_KEYS)
