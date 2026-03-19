/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { getUserProfile, upsertUserProfile, upsertBankAccount } from "@/lib/db/user-profile"
import {
  ERROR_USER_PROFILE_NOT_FOUND,
  ERROR_USER_PROFILE_SAVE_FAILED,
  ERROR_USER_PROFILE_INVALID_PAYLOAD,
  ERROR_USER_PROFILE_LOG_PREFIX,
} from "@/lib/user-profile/constants"

export const runtime = "nodejs"

// ── Validation schemas ─────────────────────────────────────────────────────────

const accessibilitySchema = z.object({
  needsReadingAssistance: z.boolean(),
  needsTranslation: z.boolean(),
  needsVoiceAssistant: z.boolean(),
})

const educationSchema = z.object({
  level: z.enum([
    "less_than_high_school",
    "high_school_or_ged",
    "some_college",
    "associates",
    "bachelors",
    "graduate_or_professional",
  ]),
  currentlyEnrolled: z.boolean(),
  schoolName: z.string().trim().max(100).optional(),
})

const notificationsSchema = z.object({
  deadlineReminders: z.boolean(),
  qualificationAlerts: z.boolean(),
  regulationUpdates: z.boolean(),
  channel: z.enum(["email", "sms", "both"]),
  reminderLeadDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
})

const profileDataSchema = z.object({
  preferredName: z.string().trim().max(60).optional(),
  gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say"]).optional(),
  preferredLanguage: z.enum(["en", "zh-CN", "ht", "pt-BR", "es", "vi"]),
  accessibility: accessibilitySchema,
  education: educationSchema.optional(),
  notifications: notificationsSchema,
})

const bankDataSchema = z.object({
  bankName: z.string().trim().min(1).max(100),
  accountType: z.enum(["checking", "savings"]),
  routingNumber: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "Routing number must be exactly 9 digits"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{4,17}$/, "Account number must be 4–17 digits"),
})

const putBodySchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("profile"), data: profileDataSchema }),
  z.object({ section: z.literal("bank"), data: bankDataSchema }),
])

// ── GET /api/user-profile ──────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const profile = await getUserProfile(authResult.userId)
    if (!profile) {
      return NextResponse.json({ ok: false, error: ERROR_USER_PROFILE_NOT_FOUND }, { status: 404 })
    }

    return NextResponse.json({ ok: true, profile }, { status: 200 })
  } catch (error) {
    logServerError(ERROR_USER_PROFILE_LOG_PREFIX, error, { route: "GET /api/user-profile" })
    return NextResponse.json({ ok: false, error: ERROR_USER_PROFILE_SAVE_FAILED }, { status: 500 })
  }
}

// ── PUT /api/user-profile ─────────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const body = (await request.json().catch(() => null)) as unknown
    const parsed = putBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: ERROR_USER_PROFILE_INVALID_PAYLOAD }, { status: 400 })
    }

    if (parsed.data.section === "profile") {
      await upsertUserProfile(authResult.userId, parsed.data.data)
    } else {
      await upsertBankAccount(authResult.userId, parsed.data.data)
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    logServerError(ERROR_USER_PROFILE_LOG_PREFIX, error, { route: "PUT /api/user-profile" })
    const status =
      error instanceof Error && error.message.includes("not found") ? 404 : 500
    const message =
      error instanceof Error && error.message.includes("not found")
        ? ERROR_USER_PROFILE_NOT_FOUND
        : ERROR_USER_PROFILE_SAVE_FAILED
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
