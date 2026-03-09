import "server-only"

import { NextResponse } from "next/server"

import { getSupabaseServerClient } from "@/lib/supabase/server"

function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null
  }

  const [scheme, token] = headerValue.trim().split(/\s+/, 2)
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null
  }

  return token
}

function parseCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) {
    return null
  }

  const pair = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`))

  if (!pair) {
    return null
  }

  const value = pair.slice(cookieName.length + 1)
  return value ? decodeURIComponent(value) : null
}

function extractAccessToken(request: Request): string | null {
  const bearerToken = parseBearerToken(request.headers.get("authorization"))
  if (bearerToken) {
    return bearerToken
  }

  return parseCookieValue(request.headers.get("cookie"), "sb-access-token")
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<
  | {
      ok: true
      userId: string
    }
  | {
      ok: false
      response: NextResponse
    }
> {
  try {
    const token = extractAccessToken(request)
    if (!token) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            error: "Authentication required.",
          },
          { status: 401 },
        ),
      }
    }

    const { data, error } = await getSupabaseServerClient().auth.getUser(token)
    if (error || !data.user?.id) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            error: "Invalid or expired session.",
          },
          { status: 401 },
        ),
      }
    }

    return {
      ok: true,
      userId: data.user.id,
    }
  } catch (error) {
    console.error("Failed to verify authentication token", error)

    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Unable to verify authentication.",
        },
        { status: 500 },
      ),
    }
  }
}
