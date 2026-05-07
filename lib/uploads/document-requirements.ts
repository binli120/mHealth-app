/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

function normalizeDocumentText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term))
}

export function isDriverLicenseDocument(
  documentType: string | null | undefined,
  documentLabel?: string | null,
): boolean {
  const text = normalizeDocumentText(`${documentType ?? ""} ${documentLabel ?? ""}`)
  if (!text) return false

  return (
    includesAny(text, [
      "driver license",
      "drivers license",
      "driving license",
      "driver licence",
      "drivers licence",
      "driving licence",
      "driver id",
      "dl id",
      "ma driver",
      "massachusetts driver",
    ]) ||
    /\bdl\b/.test(text)
  )
}

export function requiresDualSideDocument(
  documentType: string | null | undefined,
  documentLabel?: string | null,
): boolean {
  const text = normalizeDocumentText(`${documentType ?? ""} ${documentLabel ?? ""}`)
  if (!text) return false

  if (isDriverLicenseDocument(documentType, documentLabel)) return true

  return includesAny(text, [
    "government id",
    "government issued id",
    "state id",
    "state issued id",
    "photo id",
    "id card",
    "identity card",
    "mass id",
    "massachusetts id",
    "real id",
    "proof of identity",
  ])
}

