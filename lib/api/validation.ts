/**
 * Shared request validation for API routes.
 *
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { NextResponse } from "next/server"
import { z, type ZodError, type ZodSchema } from "zod"

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

const INVALID_JSON_MESSAGE = "Request body must be valid JSON."

export function validationErrorResponse(
  error: ZodError,
  fallback = "Invalid request.",
): NextResponse {
  const message = error.errors[0]?.message ?? fallback
  return NextResponse.json({ ok: false, error: message }, { status: 400 })
}

/** Parses and validates a JSON request body against `schema`. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<ValidationResult<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: INVALID_JSON_MESSAGE }, { status: 400 }),
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse(parsed.error) }
  }
  return { ok: true, data: parsed.data }
}

/** Parses and validates URL search params against `schema`. */
export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>,
): ValidationResult<T> {
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse(parsed.error) }
  }
  return { ok: true, data: parsed.data }
}

/** Parses and validates a plain object (e.g. resolved dynamic route params) against `schema`. */
export function parseParams<T>(
  params: Record<string, string>,
  schema: ZodSchema<T>,
): ValidationResult<T> {
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse(parsed.error) }
  }
  return { ok: true, data: parsed.data }
}

// ── Shared primitive schemas ─────────────────────────────────────────────────

export const uuidSchema = z.string().uuid("Must be a valid UUID.")

export const emailSchema = z.string().trim().toLowerCase().email("Valid email required.")

export const passwordSchema = z
  .string({ required_error: "Password must be at least 8 characters." })
  .min(8, "Password must be at least 8 characters.")
