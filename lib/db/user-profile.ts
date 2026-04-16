/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import "server-only"

import { getDbPool } from "./server"
import { encryptField, decryptField } from "@/lib/user-profile/encrypt"
import { DEFAULT_PROFILE_DATA } from "@/lib/user-profile/types"
import type {
  UserProfile,
  UserProfileData,
  BankAccountInput,
  StoredBankData,
} from "@/lib/user-profile/types"
import type { CitizenshipStatus } from "@/lib/benefit-orchestration/types"
import { getSignedDocumentUrl } from "@/lib/supabase/storage"

// ---------------------------------------------------------------------------
// Internal helper: resolve an avatar_url DB value into a displayable URL.
//
// Historical rows may contain a full public URL (http://...) from the old
// profile-avatars bucket.  New rows store a bare storage path such as
// "{userId}/avatar/avatar.jpg".  We detect which case we have and either
// return the legacy URL as-is or generate a fresh signed URL from the path.
// ---------------------------------------------------------------------------
async function resolveAvatarUrl(raw: string | null): Promise<string | null> {
  if (!raw) return null
  // Legacy public URL — return unchanged
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
  // Storage path — generate a signed URL (1-hour TTL; no access token needed
  // because the server client uses the service-role key)
  try {
    return await getSignedDocumentUrl({ storagePath: raw })
  } catch {
    return null
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function getApplicantIdByUserId(userId: string): Promise<string | null> {
  const pool = getDbPool()
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM applicants WHERE user_id = $1 LIMIT 1",
    [userId],
  )
  return result.rows[0]?.id ?? null
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const pool = getDbPool()

  // Fetch applicant core fields + user_profiles row (if exists) in one query
  const result = await pool.query<{
    first_name: string
    last_name: string
    dob: string | null
    phone: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    state: string | null
    zip: string | null
    citizenship_status: CitizenshipStatus | null
    profile_data: UserProfileData | null
    bank_data: StoredBankData | null
    avatar_url: string | null
  }>(
    `SELECT
       a.first_name,
       a.last_name,
       a.dob,
       a.phone,
       a.address_line1,
       a.address_line2,
       a.city,
       a.state,
       a.zip,
       a.citizenship_status,
       up.profile_data,
       up.bank_data,
       up.avatar_url
     FROM applicants a
     LEFT JOIN user_profiles up ON up.applicant_id = a.id
     WHERE a.user_id = $1
     LIMIT 1`,
    [userId],
  )

  const row = result.rows[0]
  if (!row) return null

  // Family profile summary (household size + last update)
  const familyResult = await pool.query<{ household_size: number; updated_at: string }>(
    `SELECT
       (fp.profile_data->>'householdSize')::int AS household_size,
       fp.updated_at
     FROM family_profiles fp
     JOIN applicants a ON a.id = fp.applicant_id
     WHERE a.user_id = $1
     LIMIT 1`,
    [userId],
  )
  const fpRow = familyResult.rows[0] ?? null

  const bank = row.bank_data
  const profileData: UserProfileData = {
    ...DEFAULT_PROFILE_DATA,
    ...(row.profile_data ?? {}),
  }

  // Resolve the raw DB value (storage path or legacy public URL) into a
  // usable URL the browser can load directly.
  const avatarUrl = await resolveAvatarUrl(row.avatar_url)

  return {
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.dob,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    citizenshipStatus: row.citizenship_status,
    profileData,
    avatarUrl,
    hasBankAccount: !!bank?.routingNumberEncrypted,
    bankLastFour: bank?.lastFourDigits ?? null,
    bankName: bank?.bankName ?? null,
    bankAccountType: bank?.accountType ?? null,
    familyProfileSummary: fpRow
      ? { householdSize: fpRow.household_size ?? 1, updatedAt: fpRow.updated_at }
      : null,
  }
}

// ── Write: profile_data ────────────────────────────────────────────────────────

export async function upsertUserProfile(
  userId: string,
  data: UserProfileData,
): Promise<{ id: string }> {
  const pool = getDbPool()

  const applicantId = await getApplicantIdByUserId(userId)
  if (!applicantId) {
    throw new Error("Applicant profile not found. Please complete registration first.")
  }

  const result = await pool.query<{ id: string }>(
    `INSERT INTO user_profiles (applicant_id, profile_data)
     VALUES ($1, $2)
     ON CONFLICT (applicant_id)
     DO UPDATE SET profile_data = EXCLUDED.profile_data, updated_at = now()
     RETURNING id`,
    [applicantId, JSON.stringify(data)],
  )

  const row = result.rows[0]
  if (!row) throw new Error("Failed to save user profile.")
  return { id: row.id }
}

// ── Write: bank_data (encrypted) ──────────────────────────────────────────────

export async function upsertBankAccount(
  userId: string,
  input: BankAccountInput,
): Promise<void> {
  const pool = getDbPool()

  const applicantId = await getApplicantIdByUserId(userId)
  if (!applicantId) {
    throw new Error("Applicant profile not found. Please complete registration first.")
  }

  const lastFourDigits = input.accountNumber.slice(-4)
  const bankData: StoredBankData = {
    bankName: input.bankName,
    accountType: input.accountType,
    routingNumberEncrypted: encryptField(input.routingNumber),
    accountNumberEncrypted: encryptField(input.accountNumber),
    lastFourDigits,
  }

  await pool.query(
    `INSERT INTO user_profiles (applicant_id, bank_data)
     VALUES ($1, $2)
     ON CONFLICT (applicant_id)
     DO UPDATE SET bank_data = EXCLUDED.bank_data, updated_at = now()`,
    [applicantId, JSON.stringify(bankData)],
  )
}

// ── Write: core applicant fields ──────────────────────────────────────────────

export interface ApplicantInfoInput {
  firstName?: string
  lastName?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
}

export async function updateApplicantInfo(
  userId: string,
  fields: ApplicantInfoInput,
): Promise<void> {
  const pool = getDbPool()

  // Build dynamic SET clause for only the provided fields
  const setClauses: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  const fieldMap: Record<keyof ApplicantInfoInput, string> = {
    firstName: "first_name",
    lastName: "last_name",
    phone: "phone",
    addressLine1: "address_line1",
    addressLine2: "address_line2",
    city: "city",
    state: "state",
    zip: "zip",
  }

  for (const [key, col] of Object.entries(fieldMap) as [keyof ApplicantInfoInput, string][]) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = $${paramIndex}`)
      values.push(fields[key])
      paramIndex++
    }
  }

  if (setClauses.length === 0) return

  values.push(userId)
  await pool.query(
    `UPDATE applicants SET ${setClauses.join(", ")} WHERE user_id = $${paramIndex}`,
    values,
  )
}

// ── Write: avatar_url ──────────────────────────────────────────────────────────

export async function updateAvatarUrl(
  userId: string,
  avatarUrl: string | null,
): Promise<void> {
  const pool = getDbPool()

  const applicantId = await getApplicantIdByUserId(userId)
  if (!applicantId) {
    throw new Error("Applicant profile not found. Please complete registration first.")
  }

  await pool.query(
    `INSERT INTO user_profiles (applicant_id, avatar_url)
     VALUES ($1, $2)
     ON CONFLICT (applicant_id)
     DO UPDATE SET avatar_url = EXCLUDED.avatar_url, updated_at = now()`,
    [applicantId, avatarUrl],
  )
}

// ── Read for internal use (decrypt bank data) ──────────────────────────────────

export async function getDecryptedBankAccount(
  userId: string,
): Promise<{ routingNumber: string; accountNumber: string } | null> {
  const pool = getDbPool()
  const result = await pool.query<{ bank_data: StoredBankData | null }>(
    `SELECT up.bank_data
     FROM user_profiles up
     JOIN applicants a ON a.id = up.applicant_id
     WHERE a.user_id = $1
     LIMIT 1`,
    [userId],
  )
  const bank = result.rows[0]?.bank_data
  if (!bank?.routingNumberEncrypted) return null
  return {
    routingNumber: decryptField(bank.routingNumberEncrypted),
    accountNumber: decryptField(bank.accountNumberEncrypted),
  }
}
