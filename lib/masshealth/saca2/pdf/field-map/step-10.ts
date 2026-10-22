/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Encoder, FieldEntry } from "../types"

const YES_NO_NAMED: Encoder = { kind: "yesNo", yes: "Yes", no: "No" }

const part = (field: string, key: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "answer", stepId: "signature", path: `signing.responsibleParty.${key}` },
  encode,
})

const derived = (field: string, id: string): FieldEntry => ({
  fields: [field],
  source: { kind: "derived", id },
  encode: "text",
})

/**
 * Step 10: the voter-registration answer (PDF index 24), the emancipated-minor question and the
 * responsible-party block (form page 24, PDF index 25). The form has no "who signs" box, so `signature.signedBy` is never written; the signature,
 * its date and the printed name are never-fill. The wizard shows the block only when it applies.
 */
export const STEP_10_ENTRIES: FieldEntry[] = [
  {
    // the template name ends with an EM SPACE (U+2003)
    fields: ["If you are under 18 years of age, are you an emancipated minor?\u2003"],
    source: { kind: "answer", stepId: "signature", path: "signing.emancipatedMinor" },
    encode: YES_NO_NAMED,
  },
  // Voter registration (form p.23, PDF index 24): the applicant answers it in the wizard, so writing it
  // is not an auto-filled consent or signature. Widgets: Yes (left) = "1", No = "2"; unanswered stays blank.
  {
    fields: ["would you like to apply to register to vote today?"],
    source: { kind: "answer", stepId: "signature", path: "signing.registerToVote" },
    encode: { kind: "yesNo", yes: "1", no: "2" },
  },
  part("First name_S", "firstName", "text"),
  part("Middle name_S", "middleName", "text"),
  part("Last name_S", "lastName", "text"),
  part("Suffix_S", "suffix", "text"),
  derived("Social Security Number_S", "signing.responsibleParty.ssnLine"),
  part("Relationship to you_S", "relationship", "text"),
  part("Date of birth_S", "dateOfBirth", "date"),
  part("Street address_S", "street", "text"),
  part("ApartmentUnit_S", "apartment", "text"),
  part("City_S", "city", "text"),
  part("State_S", "state", "upper"),
  part("Zip code_S", "zip", "text"),
  part("County_S", "county", "text"),
  part("Phone_S", "phone", "phone"),
  derived("Phone type_S", "signing.responsibleParty.phoneTypeLabel"),
  part("Second Phone_S", "secondPhone", "phone"),
  part("Email_S", "email", "text"),
]
