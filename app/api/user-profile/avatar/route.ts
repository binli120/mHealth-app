import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { updateAvatarUrl } from "@/lib/db/user-profile"

export const runtime = "nodejs"

const BUCKET = "profile-avatars"
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

/** Build a per-request Supabase client that carries the user's JWT so Storage
 *  RLS policies can validate the uploader's identity. */
function makeStorageClient(accessToken: string) {
  const preferLocal = process.env.NODE_ENV !== "production"
  const url =
    (preferLocal
      ? process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL
      : undefined) ?? process.env.NEXT_PUBLIC_SUPABASE_URL

  // Prefer service-role key when available (bypasses RLS on Storage).
  // Falls back to the anon key with the user's JWT, which requires proper
  // bucket RLS policies (see database/migrations/add_avatar_url.sql).
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (preferLocal
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_LOCAL
      : undefined) ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) throw new Error("Missing Supabase env vars for storage.")

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? ""
  const [scheme, token] = header.trim().split(/\s+/, 2)
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null
  return token
}

// ── POST /api/user-profile/avatar ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const accessToken = extractBearerToken(request)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Bearer token required for storage upload." }, { status: 401 })
    }

    const formData = await request.formData().catch(() => null)
    const file = formData?.get("image")
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No image file provided." }, { status: 400 })
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only JPEG, PNG, WebP, and GIF images are allowed." },
        { status: 400 },
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image must be 5 MB or smaller." },
        { status: 400 },
      )
    }

    const ext = EXT_MAP[file.type] ?? "jpg"
    const storagePath = `${authResult.userId}/avatar.${ext}`
    const bytes = await file.arrayBuffer()

    const supabase = makeStorageClient(accessToken)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      logServerError("[avatar-upload]", uploadError, { userId: authResult.userId })
      return NextResponse.json({ ok: false, error: "Failed to upload image." }, { status: 500 })
    }

    // Build a cache-busted public URL so browsers fetch the new image immediately.
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

    await updateAvatarUrl(authResult.userId, avatarUrl)

    return NextResponse.json({ ok: true, avatarUrl }, { status: 200 })
  } catch (error) {
    logServerError("[avatar-upload]", error, { route: "POST /api/user-profile/avatar" })
    return NextResponse.json({ ok: false, error: "Failed to upload avatar." }, { status: 500 })
  }
}

// ── DELETE /api/user-profile/avatar ───────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const accessToken = extractBearerToken(request)
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Bearer token required." }, { status: 401 })
    }

    const supabase = makeStorageClient(accessToken)

    // Remove all avatar files for this user (any extension).
    const { data: listed } = await supabase.storage
      .from(BUCKET)
      .list(authResult.userId)

    if (listed && listed.length > 0) {
      const paths = listed.map((f) => `${authResult.userId}/${f.name}`)
      await supabase.storage.from(BUCKET).remove(paths)
    }

    await updateAvatarUrl(authResult.userId, null)

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    logServerError("[avatar-delete]", error, { route: "DELETE /api/user-profile/avatar" })
    return NextResponse.json({ ok: false, error: "Failed to remove avatar." }, { status: 500 })
  }
}
