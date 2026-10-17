/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { FieldEntry } from "../types"

const program = (field: string, key: string): FieldEntry => ({
  fields: [field],
  source: { kind: "answer", stepId: "intake", path: `intake.programs.${key}` },
  encode: { kind: "check" },
})

const line = (field: string, derivedId: string): FieldEntry => ({
  fields: [field],
  source: { kind: "derived", id: derivedId },
  encode: "text",
})

/** Form page 1 above Step 1: program boxes, the SNAP opt-in and the per-program applicant name lines. */
export const INTAKE_ENTRIES: FieldEntry[] = [
  program("MassHealth or the Health Safety Net HSN", "masshealthHsn"),
  program("Health Connector Programs", "healthConnector"),
  program("LongTerm Care andor", "longTermCare"),
  program("Home and CommunityBased Services Waiver", "hcbsWaiver"),
  {
    fields: ["Check this box if you want this application to be sent to the Department of Transitional Assistance to serve as an application for"],
    source: { kind: "answer", stepId: "intake", path: "intake.applyForSnap" },
    encode: { kind: "check" },
  },
  // Names of the people applying under MassHealth/HSN (left, top), Health Connector (right) and
  // Long-Term Care / HCBS Waiver (left, below)
  line("You", "intake.names.masshealth.you"),
  line("Spouse", "intake.names.masshealth.spouse"),
  line("You_2", "intake.names.healthConnector.you"),
  line("Spouse_2", "intake.names.healthConnector.spouse"),
  line("You_3", "intake.names.longTermCare.you"),
  line("Spouse_3", "intake.names.longTermCare.spouse"),
]
