/**
 * Shared upload MIME contracts used by client pickers and server validators.
 *
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export const VISION_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export const VISION_UPLOAD_ACCEPT = VISION_UPLOAD_MIME_TYPES.join(",")
export const VISION_UPLOAD_FORMAT_LABEL = "PDF, JPEG, PNG, or WebP"
