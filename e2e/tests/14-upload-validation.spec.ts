/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * E2E tests for server-side upload validation (lib/uploads/validate.ts).
 *
 * Security requirements verified here:
 *   1. All upload endpoints reject unauthenticated requests (401)
 *   2. Empty files are rejected (400)
 *   3. Files that exceed the per-category size limit are rejected (413)
 *   4. Files with a MIME type not in the allowlist are rejected (415)
 *   5. Files whose magic bytes do not match the declared MIME type are
 *      rejected (415) — prevents Content-Type spoofing
 *   6. Valid files with correct magic bytes are accepted
 *
 * Endpoints under test:
 *   POST /api/user-profile/avatar
 *   POST /api/appeals/extract-document
 *   POST /api/agents/vision
 *   POST /api/pdf/extract
 *   POST /api/applications/{applicationId}/documents
 *   POST /api/masshealth/income-verification/documents
 *
 * NOTE: Authenticated tests are guarded behind an auth session.  They are
 * skipped gracefully when no auth state file is present (no Supabase running).
 */

import { test, expect, type APIRequestContext } from "@playwright/test"
import { createHmac } from "crypto"
import * as fs from "fs"
import * as path from "path"
import { hasSupabaseAuthState } from "../auth-state"

const AUTH_FILE = path.join(__dirname, "../.auth/user.json")
const HAS_AUTH = hasSupabaseAuthState(AUTH_FILE)
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const IS_LOCAL_E2E =
  BASE_URL.startsWith("http://localhost") || BASE_URL.startsWith("http://127.0.0.1")
const LOCAL_AUTH_HELPERS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS !== "false" &&
  process.env.ENABLE_LOCAL_AUTH_HELPERS !== "false"
const LOCAL_DEV_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long"

// ── Magic-byte buffers ────────────────────────────────────────────────────────

const MB = 1024 * 1024

/** 16-byte buffer whose first bytes match a given format signature. */
function magic(header: number[]): Buffer {
  const buf = Buffer.alloc(16, 0)
  header.forEach((b, i) => { buf[i] = b })
  return buf
}

const JPEG_MAGIC  = magic([0xFF, 0xD8, 0xFF, 0xE0])
const PNG_MAGIC   = magic([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
const PDF_MAGIC   = magic([0x25, 0x50, 0x44, 0x46])               // %PDF
const WEBM_MAGIC  = magic([0x1A, 0x45, 0xDF, 0xA3])               // EBML
const ZEROS       = Buffer.alloc(16, 0)                            // no valid signature

// ── Auth helpers ──────────────────────────────────────────────────────────────

function signJwt(signingInput: string): string {
  return createHmac("sha256", LOCAL_DEV_JWT_SECRET).update(signingInput).digest("base64url")
}

function makeLocalE2EJwt(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    aud: "authenticated",
    iss: "supabase-demo",
    aal: "aal1",
  })).toString("base64url")

  return `${header}.${body}.${signJwt(`${header}.${body}`)}`
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".")
  if (!payload) return null

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Read the Supabase access token and user ID directly from the Playwright
 * storageState file.  This avoids navigating to any page (which would trigger
 * auth redirects) just to read localStorage.
 */
function readAuthSessionFromFile(filePath: string): { accessToken: string | null; userId: string | null } {
  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
      origins?: Array<{
        localStorage?: Array<{ name: string; value: string }>
      }>
    }
    for (const origin of state.origins ?? []) {
      for (const item of origin.localStorage ?? []) {
        if (item.name.startsWith("sb-") && item.name.endsWith("-auth-token")) {
          const parsed = JSON.parse(item.value) as {
            access_token?: unknown
            user?: { id?: unknown }
          }
          return {
            accessToken: typeof parsed.access_token === "string" ? parsed.access_token : null,
            userId: typeof parsed.user?.id === "string" ? parsed.user.id : null,
          }
        }
      }
    }
  } catch {
    // File does not exist yet — return nulls
  }
  return { accessToken: null, userId: null }
}

// Read once at module load; no page navigation needed for any test.
const AUTH_SESSION = readAuthSessionFromFile(AUTH_FILE)

function getStaticAuthHeaders(): Record<string, string> {
  if (!AUTH_SESSION.accessToken) return {}

  if (IS_LOCAL_E2E && LOCAL_AUTH_HELPERS_ENABLED) {
    const payload = decodeJwtPayload(AUTH_SESSION.accessToken)
    const subject =
      AUTH_SESSION.userId ?? (typeof payload?.sub === "string" ? payload.sub : null)

    if (subject) {
      return { Authorization: `Bearer ${makeLocalE2EJwt(subject)}` }
    }
  }

  return { Authorization: `Bearer ${AUTH_SESSION.accessToken}` }
}

/**
 * Post a multipart upload to `url` with the auth bearer token.
 * `file` becomes the `file` form field; `extra` fields are merged in.
 */
function authedUpload(
  request: APIRequestContext,
  url: string,
  file: { name: string; mimeType: string; buffer: Buffer },
  extra: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {},
) {
  return request.post(url, {
    headers: getStaticAuthHeaders(),
    multipart: { file, ...extra },
  })
}

// ── 1. Unauthenticated guards ─────────────────────────────────────────────────

test.describe("Upload validation — unauthenticated guards", () => {
  const ENDPOINTS = [
    "/api/user-profile/avatar",
    "/api/appeals/extract-document",
    "/api/agents/vision",
    "/api/pdf/extract",
    // Application-scoped routes — the UUID is fake; 401 fires before the access check
    "/api/applications/00000000-0000-4000-8000-000000000001/documents",
    "/api/masshealth/income-verification/documents",
  ]

  for (const endpoint of ENDPOINTS) {
    test(`POST ${endpoint} returns 401 without authentication`, async ({ request }) => {
      // Send an empty multipart body — no auth header
      const res = await request.post(endpoint, {
        multipart: {
          file: { name: "test.jpg", mimeType: "image/jpeg", buffer: JPEG_MAGIC },
        },
      })
      expect([401, 403]).toContain(res.status())
    })
  }
})

// ── 2. Avatar upload ──────────────────────────────────────────────────────────

test.describe("POST /api/user-profile/avatar — upload validation", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated upload tests")
  })

  test("rejects an empty file (400)", async ({ request }) => {
    // The avatar route reads the 'image' field, not 'file'
    const res = await authedUpload(request, "/api/user-profile/avatar",
      { name: "avatar.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) },
      { image: { name: "avatar.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) } },
    )
    expect([400]).toContain(res.status())
  })

  test("rejects a MIME type not in the avatar allowlist (415)", async ({ request }) => {
    const res = await authedUpload(request, "/api/user-profile/avatar",
      { name: "avatar.pdf", mimeType: "application/pdf", buffer: PDF_MAGIC },
      { image: { name: "avatar.pdf", mimeType: "application/pdf", buffer: PDF_MAGIC } },
    )
    expect([400, 415]).toContain(res.status())
  })

  test("rejects a JPEG whose magic bytes look like a PDF (MIME spoofing → 415)", async ({ request }) => {
    // Claim image/jpeg but send PDF magic bytes
    const res = await authedUpload(request, "/api/user-profile/avatar",
      { name: "photo.jpg", mimeType: "image/jpeg", buffer: PDF_MAGIC },
      { image: { name: "photo.jpg", mimeType: "image/jpeg", buffer: PDF_MAGIC } },
    )
    expect([400, 415]).toContain(res.status())
  })
})

// ── 3. Appeals / vision extract-document ─────────────────────────────────────

test.describe("POST /api/appeals/extract-document — upload validation", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated upload tests")
  })

  test("rejects an empty file (400)", async ({ request }) => {
    const res = await authedUpload(request, "/api/appeals/extract-document", {
      name: "letter.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
    })
    expect(res.status()).toBe(400)
  })

  test("rejects a file whose size exceeds the 10 MB limit (413)", async ({ request }) => {
    // 11 MB — allocating is fine; buffer size > limit is checked before disk I/O
    const big = Buffer.alloc(11 * MB, 0)
    PDF_MAGIC.copy(big)                              // set valid magic so size is the only failure
    const res = await authedUpload(request, "/api/appeals/extract-document", {
      name: "big.pdf",
      mimeType: "application/pdf",
      buffer: big,
    })
    expect(res.status()).toBe(413)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/exceeds/i)
  })

  test("rejects a file type not in the vision allowlist (415)", async ({ request }) => {
    // GIF is valid for avatar but not for vision/extract-document
    const res = await authedUpload(request, "/api/appeals/extract-document", {
      name: "animation.gif",
      mimeType: "image/gif",
      buffer: magic([0x47, 0x49, 0x46, 0x38]),
    })
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test("rejects a PDF file whose magic bytes do not match (MIME spoofing → 415)", async ({ request }) => {
    // Claims to be application/pdf but bytes are JPEG
    const res = await authedUpload(request, "/api/appeals/extract-document", {
      name: "letter.pdf",
      mimeType: "application/pdf",
      buffer: JPEG_MAGIC,
    })
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/does not match/i)
  })

  test("rejects a JPEG disguised as PDF — spoofing scenario (415)", async ({ request }) => {
    const res = await authedUpload(request, "/api/appeals/extract-document", {
      name: "sneaky.pdf",
      mimeType: "application/pdf",
      buffer: JPEG_MAGIC,
    })
    expect(res.status()).toBe(415)
  })

  test("accepts a valid PDF with correct magic bytes", async ({ request }) => {
    // 16-byte PDF stub — extraction will fail gracefully but the route should
    // reach the extraction stage (200 with empty extractedText)
    const res = await authedUpload(request, "/api/appeals/extract-document", {
      name: "denial-letter.pdf",
      mimeType: "application/pdf",
      buffer: PDF_MAGIC,
    })
    // 200 OK (extraction may yield empty text for a stub) or 500 if Ollama is down
    expect([200, 500]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(typeof body.extractedText).toBe("string")
    }
  })

  test("accepts a valid JPEG with correct magic bytes", async ({ request }) => {
    const res = await authedUpload(request, "/api/appeals/extract-document", {
      name: "denial.jpg",
      mimeType: "image/jpeg",
      buffer: JPEG_MAGIC,
    })
    expect([200, 500]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.ok).toBe(true)
    }
  })
})

// ── 4. PDF extraction ─────────────────────────────────────────────────────────

test.describe("POST /api/pdf/extract — upload validation", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated upload tests")
  })

  test("rejects a non-PDF MIME type (415)", async ({ request }) => {
    const res = await authedUpload(request, "/api/pdf/extract", {
      name: "image.png",
      mimeType: "image/png",
      buffer: PNG_MAGIC,
    })
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  test("rejects a file that exceeds the 10 MB size limit (413)", async ({ request }) => {
    const big = Buffer.alloc(11 * MB, 0)
    PDF_MAGIC.copy(big)
    const res = await authedUpload(request, "/api/pdf/extract", {
      name: "large.pdf",
      mimeType: "application/pdf",
      buffer: big,
    })
    expect(res.status()).toBe(413)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/exceeds/i)
  })

  test("rejects a ZIP archive disguised as application/pdf (415)", async ({ request }) => {
    // PK ZIP magic bytes, declared as PDF
    const res = await authedUpload(request, "/api/pdf/extract", {
      name: "archive.pdf",
      mimeType: "application/pdf",
      buffer: magic([0x50, 0x4B, 0x03, 0x04]),
    })
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/does not match/i)
  })

  test("error response never leaks a stack trace", async ({ request }) => {
    const res = await authedUpload(request, "/api/pdf/extract", {
      name: "bad.pdf",
      mimeType: "application/pdf",
      buffer: JPEG_MAGIC,
    })
    expect(res.status()).toBe(415)
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toMatch(/\bstack\b/)
    expect(raw).not.toMatch(/^\s+at\s+\w/m)
  })
})

// ── 5. Agents/vision ──────────────────────────────────────────────────────────

test.describe("POST /api/agents/vision — upload validation", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated upload tests")
  })

  test("rejects a MIME type outside the vision allowlist (415)", async ({ request }) => {
    // audio/webm is valid for dm-voice but not for vision
    const res = await authedUpload(request, "/api/agents/vision", {
      name: "recording.webm",
      mimeType: "audio/webm",
      buffer: WEBM_MAGIC,
    })
    expect(res.status()).toBe(415)
  })

  test("rejects a PNG whose magic bytes look like a WebM (spoofing → 415)", async ({ request }) => {
    const res = await authedUpload(request, "/api/agents/vision", {
      name: "image.png",
      mimeType: "image/png",
      buffer: WEBM_MAGIC,
    })
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/does not match/i)
  })

  test("rejects a file that exceeds the size limit (413)", async ({ request }) => {
    const big = Buffer.alloc(11 * MB, 0)
    JPEG_MAGIC.copy(big)
    const res = await authedUpload(request, "/api/agents/vision", {
      name: "huge.jpg",
      mimeType: "image/jpeg",
      buffer: big,
    })
    expect(res.status()).toBe(413)
  })
})

// ── 6. Application document upload ────────────────────────────────────────────
// Tests focus on the validation layer — the fake applicationId causes a 403
// after validation passes, which is the expected happy-path rejection for
// the validation tests themselves.

test.describe("POST /api/applications/{applicationId}/documents — upload validation", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated upload tests")
  })

  // A syntactically valid UUID that won't exist in any test DB
  const FAKE_APP_ID = "aaaabbbb-cccc-4ddd-8eee-ffffffff0001"
  const ENDPOINT = `/api/applications/${FAKE_APP_ID}/documents`

  test("rejects an empty file (400) before the application access check", async ({ request }) => {
    const res = await authedUpload(request, ENDPOINT, {
      name: "doc.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
    })
    expect(res.status()).toBe(400)
  })

  test("rejects a MIME type not in the document allowlist (415)", async ({ request }) => {
    // audio/webm is not a valid document type
    const res = await authedUpload(request, ENDPOINT, {
      name: "audio.webm",
      mimeType: "audio/webm",
      buffer: WEBM_MAGIC,
    })
    expect(res.status()).toBe(415)
  })

  test("rejects a file that exceeds the 10 MB document limit (413)", async ({ request }) => {
    const big = Buffer.alloc(11 * MB, 0)
    PDF_MAGIC.copy(big)
    const res = await authedUpload(request, ENDPOINT, {
      name: "large.pdf",
      mimeType: "application/pdf",
      buffer: big,
    })
    expect(res.status()).toBe(413)
  })

  test("rejects a JPEG with PDF magic bytes declared as image/jpeg (spoofing → 415)", async ({ request }) => {
    const res = await authedUpload(request, ENDPOINT, {
      name: "photo.jpg",
      mimeType: "image/jpeg",
      buffer: PDF_MAGIC,       // wrong magic for JPEG
    })
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/does not match/i)
  })

  test("validation passes for a valid JPEG (request proceeds to 403 application-access check)", async ({ request }) => {
    const res = await authedUpload(request, ENDPOINT, {
      name: "id.jpg",
      mimeType: "image/jpeg",
      buffer: JPEG_MAGIC,
    })
    // 403 = validation passed, but the fake application UUID isn't accessible
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.ok).toBe(false)
    // Must be the application-access error, not a validation error
    expect(body.error).not.toMatch(/does not match/i)
    expect(body.error).not.toMatch(/exceeds/i)
    expect(body.error).not.toMatch(/not allowed/i)
  })

  test("validation passes for a valid PDF (request proceeds to 403 application-access check)", async ({ request }) => {
    const res = await authedUpload(request, ENDPOINT, {
      name: "paystub.pdf",
      mimeType: "application/pdf",
      buffer: PDF_MAGIC,
    })
    expect(res.status()).toBe(403)
  })
})

// ── 7. Income verification document upload ────────────────────────────────────

test.describe("POST /api/masshealth/income-verification/documents — upload validation", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated upload tests")
  })

  const FAKE_APP_ID    = "aaaabbbb-cccc-4ddd-8eee-ffffffff0002"
  const FAKE_MEMBER_ID = "aaaabbbb-cccc-4ddd-8eee-ffffffff0003"
  const ENDPOINT = "/api/masshealth/income-verification/documents"

  function postIncomeDoc(
    request: APIRequestContext,
    file: { name: string; mimeType: string; buffer: Buffer },
  ) {
    return request.post(ENDPOINT, {
      headers: getStaticAuthHeaders(),
      multipart: {
        file,
        applicationId: FAKE_APP_ID,
        memberId: FAKE_MEMBER_ID,
        docTypeClaimed: "pay_stub",
      },
    })
  }

  test("rejects a MIME type not in the document allowlist (415)", async ({ request }) => {
    const res = await postIncomeDoc(request, {
      name: "clip.webm",
      mimeType: "audio/webm",
      buffer: WEBM_MAGIC,
    })
    expect(res.status()).toBe(415)
  })

  test("rejects a file that exceeds the 10 MB limit (413)", async ({ request }) => {
    const big = Buffer.alloc(11 * MB, 0)
    PDF_MAGIC.copy(big)
    const res = await postIncomeDoc(request, {
      name: "big.pdf",
      mimeType: "application/pdf",
      buffer: big,
    })
    expect(res.status()).toBe(413)
  })

  test("rejects a WebM buffer declared as application/pdf (spoofing → 415)", async ({ request }) => {
    const res = await postIncomeDoc(request, {
      name: "paystub.pdf",
      mimeType: "application/pdf",
      buffer: WEBM_MAGIC,
    })
    expect(res.status()).toBe(415)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/does not match/i)
  })
})

// ── 8. Cross-endpoint spoofing matrix ────────────────────────────────────────
// Verify the most dangerous spoofing scenario (executable disguised as image)
// is caught across different endpoints.

test.describe("Upload validation — MIME spoofing matrix", () => {
  test.use({ storageState: AUTH_FILE })

  test.beforeEach(() => {
    test.skip(!HAS_AUTH, "No auth session — create a test user to run authenticated upload tests")
  })

  const SPOOFING_CASES: Array<{
    endpoint: string
    name: string
    declaredMime: string
    actualMagic: Buffer
    label: string
  }> = [
    {
      endpoint: "/api/pdf/extract",
      name: "trojan.pdf",
      declaredMime: "application/pdf",
      actualMagic: JPEG_MAGIC,
      label: "JPEG bytes declared as PDF on /api/pdf/extract",
    },
    {
      endpoint: "/api/appeals/extract-document",
      name: "trojan.jpg",
      declaredMime: "image/jpeg",
      actualMagic: PDF_MAGIC,
      label: "PDF bytes declared as JPEG on /api/appeals/extract-document",
    },
    {
      endpoint: "/api/agents/vision",
      name: "trojan.png",
      declaredMime: "image/png",
      actualMagic: WEBM_MAGIC,
      label: "WebM bytes declared as PNG on /api/agents/vision",
    },
    {
      endpoint: "/api/applications/aaaabbbb-cccc-4ddd-8eee-ffffffff0004/documents",
      name: "trojan.pdf",
      declaredMime: "application/pdf",
      actualMagic: magic([0x50, 0x4B, 0x03, 0x04]),  // ZIP/PK
      label: "ZIP bytes declared as PDF on /api/applications/.../documents",
    },
  ]

  for (const { endpoint, name, declaredMime, actualMagic, label } of SPOOFING_CASES) {
    test(`rejects ${label}`, async ({ request }) => {
      const res = await authedUpload(request, endpoint, {
        name,
        mimeType: declaredMime,
        buffer: actualMagic,
      })
      expect(res.status()).toBe(415)
      const body = await res.json()
      expect(body.ok).toBe(false)
      expect(body.error).toMatch(/does not match/i)
    })
  }
})
