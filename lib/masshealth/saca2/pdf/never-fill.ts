/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export type NeverFillReason =
  | "button"
  | "signature"
  | "signature-date"
  | "consent"
  | "office-use"
  | "voter"
  | "other"

/**
 * Fields the generator deliberately never writes. Every entry needs a reason; later tasks add the
 * signature, consent and office-use fields. Keys must be real AcroForm field names.
 */
export const NEVER_FILL: Record<string, { reason: NeverFillReason; note?: string }> = {
  Clear: { reason: "button", note: "Form reset button" },
  Print: { reason: "button", note: "Form print button" },
}
