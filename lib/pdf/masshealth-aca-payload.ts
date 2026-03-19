/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { z } from "zod"

export const massHealthAcaPayloadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional().default(""),
  email: z.string().optional(),
  ssn: z.string().optional(),
  streetAddress: z.string().optional().default(""),
  apartment: z.string().optional(),
  city: z.string().optional().default(""),
  state: z.string().optional().default("MA"),
  zipCode: z.string().optional().default(""),
  county: z.string().optional(),
  phone: z.string().optional().default(""),
  otherPhone: z.string().optional(),
  householdSize: z.number().int().min(1).optional().default(1),
  citizenship: z.enum(["citizen", "permanent", "refugee", "other"]).optional(),
  preferredSpokenLanguage: z.string().optional(),
  preferredWrittenLanguage: z.string().optional(),
  employerName: z.string().optional(),
  monthlyIncome: z.number().optional(),
  annualIncome: z.number().optional(),
  weeklyHours: z.number().optional(),
  signatureName: z.string().optional(),
  signatureDate: z.string().optional(),
})

export type MassHealthAcaPayload = z.infer<typeof massHealthAcaPayloadSchema>
