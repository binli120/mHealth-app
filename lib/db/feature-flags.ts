/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"
import { getDbPool } from "@/lib/db/server"

export interface FeatureFlag {
  id: string
  key: string
  label: string
  description: string | null
  enabled: boolean
  category: "benefit_program" | "integration" | "ui" | "general"
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  env_overrides: FeatureFlagEnvOverride[]
}

export interface FeatureFlagEnvOverride {
  id: string
  flag_id: string
  environment: string
  enabled: boolean
  updated_at: string
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const pool = getDbPool()
  const { rows } = await pool.query<FeatureFlag & { overrides_json: string }>(`
    SELECT
      f.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', e.id,
            'flag_id', e.flag_id,
            'environment', e.environment,
            'enabled', e.enabled,
            'updated_at', e.updated_at
          ) ORDER BY e.environment
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'
      ) AS env_overrides
    FROM feature_flags f
    LEFT JOIN feature_flag_env_overrides e ON e.flag_id = f.id
    GROUP BY f.id
    ORDER BY f.category, f.label
  `)
  return rows
}

export async function setFlagEnabled(flagId: string, enabled: boolean): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `UPDATE feature_flags SET enabled = $1 WHERE id = $2`,
    [enabled, flagId]
  )
}

export async function setFlagEnvOverride(
  flagId: string,
  environment: string,
  enabled: boolean
): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `INSERT INTO feature_flag_env_overrides (flag_id, environment, enabled)
     VALUES ($1, $2, $3)
     ON CONFLICT (flag_id, environment)
     DO UPDATE SET enabled = $3`,
    [flagId, environment, enabled]
  )
}

export async function removeFlagEnvOverride(flagId: string, environment: string): Promise<void> {
  const pool = getDbPool()
  await pool.query(
    `DELETE FROM feature_flag_env_overrides WHERE flag_id = $1 AND environment = $2`,
    [flagId, environment]
  )
}

/**
 * Runtime resolver — used by app code to check if a flag is enabled.
 * Respects env overrides; falls back to global enabled.
 */
export async function isFlagEnabled(key: string, environment?: string): Promise<boolean> {
  const pool = getDbPool()
  const env = environment ?? process.env.NODE_ENV ?? "development"

  const { rows } = await pool.query(
    `SELECT f.enabled, e.enabled AS env_enabled
     FROM feature_flags f
     LEFT JOIN feature_flag_env_overrides e
       ON e.flag_id = f.id AND e.environment = $2
     WHERE f.key = $1
     LIMIT 1`,
    [key, env]
  )

  if (rows.length === 0) return true // unknown flag defaults to enabled
  const row = rows[0]
  return row.env_enabled !== null ? row.env_enabled : row.enabled
}
