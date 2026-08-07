import "server-only"

import { getDbPool } from "@/lib/db/server"
import type { PersonalDataResetContext } from "@/lib/account/personal-data-contract"
import type { Pool, PoolClient } from "pg"

type Queryable = Pick<Pool | PoolClient, "query">

interface ResetContextRow {
  application_ids: string[] | null
  storage_paths: string[] | null
}

export async function assertCustomerRole(userId: string): Promise<boolean> {
  const { rows } = await getDbPool().query<{ allowed: boolean }>(
    `SELECT
       EXISTS (SELECT 1 FROM public.users WHERE id = $1::uuid)
       AND NOT EXISTS (
         SELECT 1
         FROM public.user_roles ur
         JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1::uuid
           AND r.name IN ('admin', 'social_worker', 'reviewer', 'read_only_staff', 'case_reviewer', 'supervisor')
       ) AS allowed`,
    [userId],
  )
  return rows[0]?.allowed ?? false
}

export async function getPersonalDataResetContext(
  userId: string,
  database: Queryable = getDbPool(),
): Promise<PersonalDataResetContext> {
  const { rows } = await database.query<ResetContextRow>(
    `WITH target_apps AS (
       SELECT a.id
       FROM public.applications a
       JOIN public.applicants ap ON ap.id = a.applicant_id
       WHERE ap.user_id = $1::uuid
     ), paths AS (
       SELECT d.file_path AS path FROM public.documents d WHERE d.application_id IN (SELECT id FROM target_apps)
       UNION SELECT d.thumbnail_path FROM public.documents d WHERE d.application_id IN (SELECT id FROM target_apps)
       UNION SELECT d.pdf_path FROM public.documents d WHERE d.application_id IN (SELECT id FROM target_apps)
       UNION SELECT d.storage_key FROM public.income_documents d WHERE d.application_id IN (SELECT id FROM target_apps)
       UNION SELECT sm.storage_path FROM public.session_messages sm
         JOIN public.collaborative_sessions cs ON cs.id = sm.session_id
         WHERE cs.patient_user_id = $1::uuid
       UNION SELECT dm.storage_path FROM public.sw_direct_messages dm WHERE dm.patient_user_id = $1::uuid
       UNION SELECT hq.voice_url FROM public.help_questions hq WHERE hq.user_id = $1::uuid
       UNION SELECT hq.file_url FROM public.help_questions hq WHERE hq.user_id = $1::uuid
     )
     SELECT
       COALESCE((SELECT array_agg(id::text) FROM target_apps), '{}') AS application_ids,
       COALESCE((SELECT array_agg(DISTINCT path) FROM paths WHERE path IS NOT NULL AND path <> ''), '{}') AS storage_paths`,
    [userId],
  )

  return {
    applicationIds: rows[0]?.application_ids ?? [],
    storagePaths: rows[0]?.storage_paths ?? [],
  }
}

export async function deleteCustomerPersonalData(
  userId: string,
  database: Queryable = getDbPool(),
): Promise<void> {
  await database.query("SELECT public.reset_customer_personal_data($1::uuid)", [userId])
}

export async function verifyCustomerPersonalDataDeleted(
  userId: string,
  database: Queryable = getDbPool(),
): Promise<void> {
  const { rows } = await database.query<{ clean: boolean }>(
    `SELECT
       NOT EXISTS (SELECT 1 FROM public.applicants WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.insurance_coverage_records WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.user_agent_memory WHERE user_id = $1::text)
       AND NOT EXISTS (SELECT 1 FROM public.help_questions WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.help_answers WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.sw_direct_messages WHERE patient_user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.sw_engagement_requests WHERE patient_user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.patient_social_worker_access WHERE patient_user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.collaborative_sessions WHERE patient_user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.mobile_handoff_sessions WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.mobile_upload_sessions WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.appeal_analyses WHERE user_id = $1::uuid)
       AND NOT EXISTS (SELECT 1 FROM public.login_events WHERE user_id = $1::uuid)
       AS clean`,
    [userId],
  )
  if (!rows[0]?.clean) throw new Error("Personal data reset verification failed.")
}

export async function withPersonalDataResetLock<T>(
  userId: string,
  work: (database: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDbPool().connect()
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1::text, 0))", [userId])
    return await work(client)
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtextextended($1::text, 0))", [userId]).catch(() => undefined)
    client.release()
  }
}
