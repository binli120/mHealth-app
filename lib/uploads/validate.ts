/**
 * Centralised upload validation: size limits, MIME type allowlists, and
 * magic-bytes verification so clients cannot spoof Content-Type.
 *
 * Usage:
 *   const result = await validateUpload(file, "document")
 *   if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
 *   // result.mimeType is the normalised, verified MIME type
 *
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

// ── Category definitions ──────────────────────────────────────────────────────

export type UploadCategory =
  | "document"       // application / income-verification docs — JPEG PNG WebP HEIC PDF — 10 MB
  | "avatar"         // profile picture — JPEG PNG WebP GIF — 5 MB
  | "vision"         // AI vision / appeals — JPEG PNG WebP PDF — 10 MB (no HEIC)
  | "pdf"            // PDF extraction only — 10 MB
  | "dm-voice"       // direct message audio — 10 MB
  | "dm-image"       // direct message image — 20 MB
  | "dm-file"        // direct message document — 25 MB
  | "session-voice"  // collaborative session audio — 10 MB

const MB = 1024 * 1024

interface CategoryConfig {
  maxBytes: number
  allowed: Set<string>
  label: string
}

const CATEGORY_CONFIG: Record<UploadCategory, CategoryConfig> = {
  document: {
    maxBytes: 10 * MB,
    allowed: new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]),
    label: "JPEG, PNG, WebP, HEIC, or PDF",
  },
  avatar: {
    maxBytes: 5 * MB,
    allowed: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    label: "JPEG, PNG, WebP, or GIF",
  },
  vision: {
    maxBytes: 10 * MB,
    allowed: new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    label: "JPEG, PNG, WebP, or PDF",
  },
  pdf: {
    maxBytes: 10 * MB,
    allowed: new Set(["application/pdf"]),
    label: "PDF",
  },
  "dm-voice": {
    maxBytes: 10 * MB,
    allowed: new Set([
      "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4",
      "audio/wav", "audio/x-wav", "audio/wave", "audio/x-m4a", "audio/aac",
    ]),
    label: "WebM, Ogg, MP3, MP4, WAV, or AAC audio",
  },
  "dm-image": {
    maxBytes: 20 * MB,
    allowed: new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"]),
    label: "JPEG, PNG, GIF, WebP, or HEIC",
  },
  "dm-file": {
    maxBytes: 25 * MB,
    allowed: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ]),
    label: "PDF, Word, Excel, PowerPoint, or plain text",
  },
  "session-voice": {
    maxBytes: 10 * MB,
    allowed: new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"]),
    label: "WebM, Ogg, MP3, MP4, or WAV audio",
  },
}

// ── Magic-bytes signatures ────────────────────────────────────────────────────
// Reads the first 16 bytes of the file and checks against known format
// signatures to detect MIME type spoofing.

function matchesMagicBytes(h: Uint8Array, mime: string): boolean {
  switch (mime) {

    // ── Images ───────────────────────────────────────────────────────────────

    case "image/jpeg":
      return h[0] === 0xFF && h[1] === 0xD8 && h[2] === 0xFF

    case "image/png":
      return (
        h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47 &&
        h[4] === 0x0D && h[5] === 0x0A && h[6] === 0x1A && h[7] === 0x0A
      )

    case "image/webp":
      // RIFF????WEBP
      return (
        h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
        h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50
      )

    case "image/gif":
      // GIF87a or GIF89a
      return h[0] === 0x47 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x38

    case "image/heic": {
      // ISO Base Media File Format — ftyp box at 4-7, brand at 8-11
      const hasFtyp =
        h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70
      if (!hasFtyp) return false
      const brand = String.fromCharCode(h[8], h[9], h[10], h[11])
      return ["heic", "heix", "mif1", "msf1", "heim", "heis"].includes(brand)
    }

    // ── PDF ──────────────────────────────────────────────────────────────────

    case "application/pdf":
      // %PDF
      return h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46

    // ── Audio ────────────────────────────────────────────────────────────────

    case "audio/webm":
      // EBML header (WebM / Matroska)
      return h[0] === 0x1A && h[1] === 0x45 && h[2] === 0xDF && h[3] === 0xA3

    case "audio/ogg":
      // OggS capture pattern
      return h[0] === 0x4F && h[1] === 0x67 && h[2] === 0x67 && h[3] === 0x53

    case "audio/mpeg":
      // ID3 tag or MPEG sync word
      return (
        (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) ||        // ID3
        (h[0] === 0xFF && (h[1] & 0xE0) === 0xE0)                    // MPEG sync
      )

    case "audio/mp4":
    case "audio/x-m4a": {
      // ISO Base Media: ftyp at 4-7, M4A / mp4x brand at 8-11
      const hasFtyp =
        h[4] === 0x66 && h[5] === 0x74 && h[6] === 0x79 && h[7] === 0x70
      if (!hasFtyp) return false
      const brand = String.fromCharCode(h[8], h[9], h[10], h[11])
      return ["M4A ", "mp41", "mp42", "isom", "M4V ", "M4B ", "f4v ", "avc1"].includes(brand)
    }

    case "audio/wav":
    case "audio/x-wav":
    case "audio/wave":
      // RIFF????WAVE
      return (
        h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
        h[8] === 0x57 && h[9] === 0x41 && h[10] === 0x56 && h[11] === 0x45
      )

    case "audio/aac":
      // ADTS sync word (0xFFF0-FFFF) or ADIF header
      return (
        (h[0] === 0xFF && (h[1] & 0xF6) === 0xF0) ||
        (h[0] === 0x41 && h[1] === 0x44 && h[2] === 0x49 && h[3] === 0x46) // ADIF
      )

    // ── Office / document ────────────────────────────────────────────────────

    case "application/msword":
    case "application/vnd.ms-excel":
    case "application/vnd.ms-powerpoint":
      // OLE2 Compound Document (legacy Office formats)
      return h[0] === 0xD0 && h[1] === 0xCF && h[2] === 0x11 && h[3] === 0xE0

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      // OOXML = ZIP; also accept OLE2 for files saved by legacy apps
      return (
        (h[0] === 0x50 && h[1] === 0x4B) ||  // PK (ZIP)
        (h[0] === 0xD0 && h[1] === 0xCF)      // OLE2
      )

    case "text/plain":
      // Plain text has no reliable magic bytes; skip the check.
      return true

    default:
      return false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type UploadValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; error: string; status: 400 | 413 | 415 }

/**
 * Validates a file upload against the rules for the given category:
 *
 * 1. Rejects empty files.
 * 2. Enforces the per-category file-size limit.
 * 3. Rejects declared MIME types not in the category allowlist.
 * 4. Reads the first 16 bytes and rejects files whose magic bytes do not
 *    match the declared MIME type (prevents Content-Type spoofing).
 *
 * Returns `{ ok: true, mimeType }` on success (mimeType is normalised and
 * stripped of charset parameters), or `{ ok: false, error, status }` on failure.
 */
export async function validateUpload(
  file: File | Blob,
  category: UploadCategory,
): Promise<UploadValidationResult> {
  const config = CATEGORY_CONFIG[category]

  if (file.size === 0) {
    return { ok: false, error: "File must not be empty.", status: 400 }
  }

  if (file.size > config.maxBytes) {
    const limitMB = config.maxBytes / MB
    return {
      ok: false,
      error: `File size ${(file.size / MB).toFixed(1)} MB exceeds the ${limitMB} MB limit.`,
      status: 413,
    }
  }

  // Strip charset / boundary parameters (e.g. "text/plain; charset=utf-8")
  const declaredMime = (file.type || "").split(";")[0].toLowerCase().trim()
  if (!config.allowed.has(declaredMime)) {
    return {
      ok: false,
      error: `File type "${file.type || "(none)"}" is not allowed for this upload. Accepted: ${config.label}.`,
      status: 415,
    }
  }

  // Read the first 16 bytes for magic-byte detection.
  // We read the whole file and take a slice because Blob.slice().arrayBuffer()
  // is not available in all environments (e.g. jsdom used in tests).
  const fullBuffer = await file.arrayBuffer()
  const header = new Uint8Array(fullBuffer, 0, Math.min(16, fullBuffer.byteLength))
  if (!matchesMagicBytes(header, declaredMime)) {
    return {
      ok: false,
      error: "File content does not match the declared type.",
      status: 415,
    }
  }

  return { ok: true, mimeType: declaredMime }
}
