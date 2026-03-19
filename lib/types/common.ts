/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

/**
 * Generic API response shape used across all API routes.
 *
 * Success:  { ok: true;  data: T }
 * Failure:  { ok: false; error: string }
 */
export type ApiResponse<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string }

/**
 * Async data-fetch state used in components.
 */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string }

/**
 * Discriminated union for file-upload states shared across upload components.
 */
export type DocumentUploadState =
  | { status: "idle" }
  | { status: "extracting"; fileName: string }
  | { status: "ready"; fileName: string; extractedText: string }
  | { status: "error"; fileName: string; message: string }

/**
 * Generic select option used by all dropdown option lists.
 */
export interface SelectOption<T extends string = string> {
  value: T
  label: string
}
