/**
 * @author: Antigravity
 * @email: blee@healthcompass.cloud
 *
 * POST /api/masshealth/eligibility/check
 * Stateless, anonymous MassHealth eligibility pre-screening endpoint.
 * Accepts applicant details, runs the deterministic eligibility rule engine,
 * and returns likely/possible/unlikely program options.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { runEligibilityCheck } from "@/lib/eligibility-engine"
import { logServerError, logServerInfo } from "@/lib/server/logger"

export const runtime = "nodejs"

// Input validation schema based on ScreenerData in lib/eligibility-engine.ts
const checkEligibilitySchema = z.object({
  livesInMA: z.boolean().default(true),
  age: z.number().int().min(0).max(130),
  isPregnant: z.boolean().default(false),
  hasDisability: z.boolean().default(false),
  hasMedicare: z.boolean().default(false),
  householdSize: z.number().int().min(1).max(20),
  annualIncome: z.number().min(0),
  citizenshipStatus: z.enum(["citizen", "qualified_immigrant", "undocumented", "other"]),
  hasEmployerInsurance: z.boolean().default(false),
})

export async function POST(request: Request) {
  const start = Date.now()
  logServerInfo("masshealth.eligibility.check.start", {
    route: "/api/masshealth/eligibility/check",
  })

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Missing or malformed JSON request body." },
        { status: 400 }
      )
    }

    const parseResult = checkEligibilitySchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request payload.",
          validationErrors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    // Run rules engine using parsed, validated payload
    const report = runEligibilityCheck(parseResult.data)

    logServerInfo("masshealth.eligibility.check.done", {
      fplPercent: report.fplPercent,
      resultsCount: report.results.length,
      ms: Date.now() - start,
    })

    return NextResponse.json({
      ok: true,
      report,
    })
  } catch (error) {
    logServerError("masshealth.eligibility.check.error", error, {
      ms: Date.now() - start,
    })
    return NextResponse.json(
      { ok: false, error: "An internal server error occurred while performing eligibility check." },
      { status: 500 }
    )
  }
}
