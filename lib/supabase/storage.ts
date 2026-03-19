/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import "server-only"

// ---------------------------------------------------------------------------
// Supabase Storage — direct REST API client
//
// We use the Supabase Storage REST API directly (plain fetch) instead of
// the @supabase/supabase-js SDK because the SDK v2.57 does not reliably
// forward the service-role JWT to storage operations from server-side code.
// The REST API has been verified to work with the same JWT key.
//
// Bucket layout (single "masshealth-dev" bucket):
//   {userId}/avatar/avatar.{ext}                          ← profile picture
//   {userId}/{applicationId}/{documentId}/{fileName}      ← application docs
// ---------------------------------------------------------------------------

export const STORAGE_BUCKET = "masshealth-dev"

/** @deprecated Use STORAGE_BUCKET */
export const DOCUMENTS_BUCKET = STORAGE_BUCKET

const DEFAULT_SIGNED_URL_EXPIRES = 60 * 60 // 1 hour

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getStorageBaseUrl(): string {
  const preferLocal = process.env.NODE_ENV !== "production"
  const supabaseUrl = preferLocal
    ? process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL || process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var.")
  return `${supabaseUrl}/storage/v1`
}

/** Returns the best available authorization key for server-side storage calls. */
function getServerKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (key) return key

  // Fallback to anon key — only works if bucket is public or policies allow it
  const preferLocal = process.env.NODE_ENV !== "production"
  const anonKey = preferLocal
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_LOCAL ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (anonKey) return anonKey
  throw new Error("No Supabase key available. Set SUPABASE_SERVICE_ROLE_KEY.")
}

/** Auth headers required by every Storage REST call.
 *
 * Key priority:
 *   1. SUPABASE_SERVICE_ROLE_KEY — bypasses bucket RLS (preferred for server-side)
 *   2. overrideToken             — user JWT, only used when service-role key is absent
 *   3. anon key fallback         — last resort (only works on public buckets)
 */
function authHeaders(overrideToken?: string): Record<string, string> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const key = serviceRoleKey ?? overrideToken ?? getServerKey()
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
  }
}

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

/**
 * Documents path: {userId}/{applicationId}/{documentId}/{sanitizedFileName}
 */
export function buildStoragePath(
  userId: string,
  applicationId: string,
  documentId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${userId}/${applicationId}/${documentId}/${safe}`
}

/**
 * Avatar path: {userId}/avatar/avatar.{ext}
 * Fixed name → upsert always replaces the previous avatar at the same path.
 */
export function buildAvatarStoragePath(userId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "")
  return `${userId}/avatar/avatar.${safeExt}`
}

// ---------------------------------------------------------------------------
// Storage operations — direct REST API
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to the bucket.
 * Use upsert:true for avatars (overwrite) and upsert:false for documents (no silent overwrites).
 */
export async function uploadToStorage(params: {
  accessToken?: string
  fileBuffer: Buffer
  mimeType: string
  storagePath: string
  upsert?: boolean
}): Promise<{ path: string }> {
  const base = getStorageBaseUrl()
  const url = `${base}/object/${STORAGE_BUCKET}/${params.storagePath}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(params.accessToken),
      "Content-Type": params.mimeType,
      "x-upsert": params.upsert ? "true" : "false",
    },
    body: params.fileBuffer,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Storage upload failed: ${body}`)
  }

  const data = (await res.json()) as { Key: string; Id: string }
  // Key is returned as "bucketName/path" — strip the bucket prefix
  const path = data.Key.replace(`${STORAGE_BUCKET}/`, "")
  return { path }
}

/** @deprecated Use uploadToStorage */
export const uploadDocumentToStorage = (params: {
  accessToken?: string
  fileBuffer: Buffer
  mimeType: string
  storagePath: string
}) => uploadToStorage(params)

/**
 * Delete one or more objects from the bucket.
 */
export async function deleteFromStorage(params: {
  accessToken?: string
  storagePaths: string[]
}): Promise<void> {
  if (params.storagePaths.length === 0) return

  const base = getStorageBaseUrl()
  const url = `${base}/object/${STORAGE_BUCKET}`

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      ...authHeaders(params.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: params.storagePaths }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Storage delete failed: ${body}`)
  }
}

/** @deprecated Use deleteFromStorage */
export const deleteDocumentFromStorage = (params: {
  accessToken?: string
  storagePath: string
}) => deleteFromStorage({ ...params, storagePaths: [params.storagePath] })

/**
 * List all objects inside a folder prefix.
 * Returns the full storage paths (ready to pass to deleteFromStorage).
 */
export async function listStorageFolder(params: {
  accessToken?: string
  folderPath: string
  limit?: number
}): Promise<string[]> {
  const base = getStorageBaseUrl()
  const url = `${base}/object/list/${STORAGE_BUCKET}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(params.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix: params.folderPath,
      limit: params.limit ?? 100,
      offset: 0,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Storage list failed: ${body}`)
  }

  const files = (await res.json()) as Array<{ name: string }>
  return files.map((f) => `${params.folderPath}/${f.name}`)
}

/**
 * Create a time-limited signed URL so the browser can download a private file.
 * Default TTL: 1 hour.
 */
export async function getSignedDocumentUrl(params: {
  accessToken?: string
  storagePath: string
  expiresInSeconds?: number
}): Promise<string> {
  const base = getStorageBaseUrl()
  const url = `${base}/object/sign/${STORAGE_BUCKET}/${params.storagePath}`
  const expiresIn = params.expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRES

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(params.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Failed to create signed URL: ${body}`)
  }

  const data = (await res.json()) as { signedURL: string }

  // The Storage API returns a relative path like /storage/v1/object/sign/...
  // Prepend the Supabase URL to make it absolute.
  if (data.signedURL.startsWith("/")) {
    const preferLocal = process.env.NODE_ENV !== "production"
    const supabaseUrl = preferLocal
      ? process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL || process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_URL
    return `${supabaseUrl}${data.signedURL}`
  }

  return data.signedURL
}
