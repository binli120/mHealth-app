/**
 * Server-side artifacts for uploaded documents:
 * - small WebP thumbnail for UI preview
 * - PDF rendition for uploaded/captured images
 */

import "server-only"

import { PDFDocument } from "pdf-lib"

import {
  buildPdfStoragePath,
  buildThumbnailStoragePath,
  uploadDocumentToStorage,
} from "@/lib/supabase/storage"

const THUMBNAIL_MIME_TYPE = "image/webp"
const PDF_MIME_TYPE = "application/pdf"
const THUMBNAIL_SIZE_PX = 320

const IMAGE_ARTIFACT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

const THUMBNAIL_SOURCE_MIME_TYPES = new Set([
  ...IMAGE_ARTIFACT_MIME_TYPES,
  "application/pdf",
])

const ANALYSIS_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
])

export function canCreateImageArtifacts(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && IMAGE_ARTIFACT_MIME_TYPES.has(mimeType))
}

export function canAnalyzeImageDocument(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && ANALYSIS_IMAGE_MIME_TYPES.has(mimeType))
}

export async function createThumbnailBuffer(fileBuffer: Buffer, mimeType: string): Promise<Buffer | null> {
  if (!mimeType || !THUMBNAIL_SOURCE_MIME_TYPES.has(mimeType)) return null

  const { default: sharp } = await import("sharp")
  return sharp(fileBuffer, { failOn: "none", limitInputPixels: 30_000_000, page: 0 })
    .rotate()
    .resize({
      width: THUMBNAIL_SIZE_PX,
      height: THUMBNAIL_SIZE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 78 })
    .toBuffer()
}

export async function createPdfFromImageBuffer(fileBuffer: Buffer, mimeType: string): Promise<Buffer | null> {
  if (!canCreateImageArtifacts(mimeType)) return null

  const pdf = await PDFDocument.create()
  const embeddableBuffer = mimeType === "image/webp"
    ? await (await import("sharp")).default(fileBuffer, { failOn: "none" }).rotate().jpeg({ quality: 90 }).toBuffer()
    : fileBuffer
  const image = mimeType === "image/png"
    ? await pdf.embedPng(embeddableBuffer)
    : await pdf.embedJpg(embeddableBuffer)
  const page = pdf.addPage([image.width, image.height])
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })

  return Buffer.from(await pdf.save())
}

export async function createAndUploadDocumentArtifacts(params: {
  accessToken?: string
  fileBuffer: Buffer
  mimeType: string
  storagePath: string
}): Promise<{ thumbnailPath: string | null; pdfPath: string | null }> {
  let thumbnailPath: string | null = null
  let pdfPath: string | null = params.mimeType === "application/pdf" ? params.storagePath : null

  const thumbnailBuffer = await createThumbnailBuffer(params.fileBuffer, params.mimeType).catch(() => null)
  if (thumbnailBuffer) {
    thumbnailPath = buildThumbnailStoragePath(params.storagePath)
    await uploadDocumentToStorage({
      accessToken: params.accessToken,
      fileBuffer: thumbnailBuffer,
      mimeType: THUMBNAIL_MIME_TYPE,
      storagePath: thumbnailPath,
    })
  }

  const pdfBuffer = await createPdfFromImageBuffer(params.fileBuffer, params.mimeType)
  if (pdfBuffer) {
    pdfPath = buildPdfStoragePath(params.storagePath)
    await uploadDocumentToStorage({
      accessToken: params.accessToken,
      fileBuffer: pdfBuffer,
      mimeType: PDF_MIME_TYPE,
      storagePath: pdfPath,
    })
  }

  return { thumbnailPath, pdfPath }
}
