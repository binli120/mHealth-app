import { NextResponse } from "next/server"

import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import { updateAvatarUrl } from "@/lib/db/user-profile"
import {
  uploadToStorage,
  deleteFromStorage,
  listStorageFolder,
  buildAvatarStoragePath,
  getSignedDocumentUrl,
} from "@/lib/supabase/storage"

export const runtime = "nodejs"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization") ?? ""
  const [scheme, token] = header.trim().split(/\s+/, 2)
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined
}

// ---------------------------------------------------------------------------
// POST /api/user-profile/avatar
// Uploads an avatar image to masshealth-dev/{userId}/avatar/avatar.{ext}
// Stores the storage PATH in the DB (not a URL — see getUserProfile for how
// a signed URL is generated on read).
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

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
    // Path: {userId}/avatar/avatar.{ext}  (fixed name → upsert replaces previous)
    const storagePath = buildAvatarStoragePath(authResult.userId, ext)
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const accessToken = extractBearerToken(request)

    // Upload (upsert: true so changing JPEG → PNG replaces the old file cleanly)
    await uploadToStorage({
      accessToken,
      fileBuffer,
      mimeType: file.type,
      storagePath,
      upsert: true,
    })

    // Persist the storage PATH (not a URL) so getUserProfile can always
    // generate a fresh signed URL on demand, regardless of expiry.
    await updateAvatarUrl(authResult.userId, storagePath)

    // Return a short-lived signed URL so the UI can display the new avatar immediately
    const accessToken2 = extractBearerToken(request)
    let signedUrl: string | null = null
    try {
      signedUrl = await getSignedDocumentUrl({ accessToken: accessToken2, storagePath })
    } catch {
      // Non-fatal — client can re-fetch the profile to get a fresh URL
    }

    return NextResponse.json({ ok: true, avatarUrl: signedUrl ?? storagePath }, { status: 200 })
  } catch (error) {
    logServerError("[avatar-upload]", error, { route: "POST /api/user-profile/avatar" })
    return NextResponse.json({ ok: false, error: "Failed to upload avatar." }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/user-profile/avatar
// Removes all avatar files for this user and clears the DB record.
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) return authResult.response

    const accessToken = extractBearerToken(request)
    const avatarFolder = `${authResult.userId}/avatar`

    // List and delete all files under {userId}/avatar/
    const paths = await listStorageFolder({ accessToken, folderPath: avatarFolder })
    if (paths.length > 0) {
      await deleteFromStorage({ accessToken, storagePaths: paths })
    }

    // Clear the stored path in the DB
    await updateAvatarUrl(authResult.userId, null)

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    logServerError("[avatar-delete]", error, { route: "DELETE /api/user-profile/avatar" })
    return NextResponse.json({ ok: false, error: "Failed to remove avatar." }, { status: 500 })
  }
}
