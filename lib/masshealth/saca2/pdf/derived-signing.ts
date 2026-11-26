/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { encodeSsn } from "./encoders"
import type { DerivedRegistry } from "./pdf-fill"

const PHONE_TYPE_LABELS: Record<string, string> = { mobile: "Mobile", home: "Home", work: "Work" }

/**
 * Step 10's responsible-party block. Every read goes through the visible reader, so the block is
 * empty unless the wizard itself shows it (signer is a responsible party, or a non-emancipated minor).
 */
export const SIGNING_DERIVED: DerivedRegistry = {
  /** The form's Social Security Number is one text line (not nine boxes): "123-45-6789". */
  "signing.responsibleParty.ssnLine": (reader) => {
    const digits = encodeSsn(reader.get({ kind: "answer", stepId: "signature", path: "signing.responsibleParty.ssn" }))
    return digits === undefined ? undefined : `${digits.slice(0, 3).join("")}-${digits.slice(3, 5).join("")}-${digits.slice(5).join("")}`
  },

  /** The form's "Phone type" is a text line; the wizard offers Mobile / Home / Work. */
  "signing.responsibleParty.phoneTypeLabel": (reader) => {
    const raw = reader.get({ kind: "answer", stepId: "signature", path: "signing.responsibleParty.phoneType" })
    return typeof raw === "string" && Object.prototype.hasOwnProperty.call(PHONE_TYPE_LABELS, raw) ? PHONE_TYPE_LABELS[raw] : undefined
  },
}
