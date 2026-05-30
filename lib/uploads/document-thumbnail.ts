/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * Server-side thumbnail generation for uploaded application documents.
 *
 * Thumbnails are derived objects stored next to the original upload:
 *   {userId}/{applicationId}/{documentId}/{fileName}.thumb.webp
 */

import "server-only"

import {
  buildThumbnailStoragePath,
  uploadDocumentToStorage,
} from "@/lib/supabase/storage"

const THUMBNAIL_MIME_TYPE = "image/webp"
const THUMBNAIL_SIZE_PX = 320
const THUMBNAIL_QUALITY = 78

const THUMBNAIL_SOURCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export function canCreateDocumentThumbnail(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && THUMBNAIL_SOURCE_MIME_TYPES.has(mimeType))
}

export async function createDocumentThumbnailBuffer(params: {
  fileBuffer: Buffer
  mimeType: string
}): Promise<Buffer | null> {
  if (!canCreateDocumentThumbnail(params.mimeType)) return null

  const { default: sharp } = await import("sharp")
  return sharp(params.fileBuffer, { failOn: "none", limitInputPixels: 30_000_000 })
    .rotate()
    .resize({
      width: THUMBNAIL_SIZE_PX,
      height: THUMBNAIL_SIZE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer()
}

export async function uploadDocumentThumbnail(params: {
  accessToken?: string
  fileBuffer: Buffer
  mimeType: string
  storagePath: string
}): Promise<string | null> {
  const thumbnailBuffer = await createDocumentThumbnailBuffer({
    fileBuffer: params.fileBuffer,
    mimeType: params.mimeType,
  })
  if (!thumbnailBuffer) return null

  const thumbnailPath = buildThumbnailStoragePath(params.storagePath)
  await uploadDocumentToStorage({
    accessToken: params.accessToken,
    fileBuffer: thumbnailBuffer,
    mimeType: THUMBNAIL_MIME_TYPE,
    storagePath: thumbnailPath,
  })

  return thumbnailPath
}
