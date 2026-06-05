/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import "server-only"

import { spawn } from "node:child_process"
import * as path from "node:path"

export type BenefitPolicyUpdatesRequest = {
  benefitNames: string[]
  includeUnchanged?: boolean
}

export type BenefitPolicyFinding = {
  source_url: string
  source_title: string
  disease_profile: string
  profile_name: string
  profile_type: string
  change_signal: string
  benefits: string[]
  programs: string[]
  diseases: string[]
  treatments: string[]
  conditions: string[]
  effective_dates: string[]
  evidence: string[]
  snapshot_status: string
  content_hash: string
}

export type BenefitPolicyUpdatesResponse = {
  ok: true
  findings: BenefitPolicyFinding[]
  fetch_failures: Array<{ url: string; error: string }>
  source: "analysis-service" | "local-python"
  degraded?: boolean
  warning?: string
}

export type AnalysisServiceConfig = {
  baseUrl?: string
  apiToken?: string
  userId?: string
}

const DEFAULT_ANALYSIS_BASE = "http://localhost:8000"
const DEFAULT_MONITOR_ROOT = "/Users/blee/dev/tinyfish"

export async function fetchBenefitPolicyUpdatesFromAnalysisService(
  request: BenefitPolicyUpdatesRequest,
  config: AnalysisServiceConfig = {},
): Promise<BenefitPolicyUpdatesResponse> {
  const baseUrl = config.baseUrl?.trim() || DEFAULT_ANALYSIS_BASE
  const upstream = await fetch(`${baseUrl}/masshealth/benefit-policy-updates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.userId ? { "user-id": config.userId } : {}),
      ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
    },
    body: JSON.stringify(request),
  })

  if (!upstream.ok) {
    throw new Error(`Analysis service returned ${upstream.status}`)
  }

  const payload = (await upstream.json()) as Omit<BenefitPolicyUpdatesResponse, "source">
  return { ...payload, source: "analysis-service" }
}

export async function fetchBenefitPolicyUpdatesFromLocalPython(
  request: BenefitPolicyUpdatesRequest,
): Promise<BenefitPolicyUpdatesResponse> {
  const monitorRoot = process.env.MASSHEALTH_MONITOR_ROOT?.trim() || DEFAULT_MONITOR_ROOT
  const pythonBin =
    process.env.MASSHEALTH_MONITOR_PYTHON?.trim() || path.join(monitorRoot, ".venv", "bin", "python")
  const configPath = process.env.MASSHEALTH_MONITOR_CONFIG?.trim() || path.join(monitorRoot, "masshealth_sources.json")
  const snapshotPath =
    process.env.MASSHEALTH_MONITOR_SNAPSHOT?.trim() ||
    path.join(monitorRoot, ".tinyfish", "mhealth-app-policy-snapshots.json")

  const raw = await runPythonJson(pythonBin, ["-m", "masshealth_monitor.integration_cli"], {
    benefitNames: request.benefitNames,
    includeUnchanged: request.includeUnchanged ?? false,
    configPath,
    snapshotPath,
  })

  const payload = JSON.parse(raw) as Omit<BenefitPolicyUpdatesResponse, "source" | "degraded" | "warning">
  return {
    ...payload,
    ok: true,
    source: "local-python",
    degraded: true,
    warning: "Using local MassHealth monitor fallback while the analysis service is unavailable.",
  }
}

function runPythonJson(pythonBin: string, args: string[], payload: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, args, {
      env: {
        ...process.env,
        PYTHONPATH: [process.env.PYTHONPATH, process.env.MASSHEALTH_MONITOR_ROOT || DEFAULT_MONITOR_ROOT]
          .filter(Boolean)
          .join(":"),
      },
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `Local MassHealth monitor exited with status ${code}`))
      }
    })

    child.stdin.end(JSON.stringify(payload))
  })
}
