import { NextResponse } from "next/server"
import { z } from "zod"
import { generateMassHealthAcaPdf } from "@/lib/pdf/masshealth-aca"

export const runtime = "nodejs"

const payloadSchema = z.object({
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = payloadSchema.parse(body)

    const pdfBytes = await generateMassHealthAcaPdf(payload)
    const filename = `ACA-3-0325-filled-${new Date().toISOString().slice(0, 10)}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Failed to generate ACA PDF", error)

    return NextResponse.json(
      {
        error: "Unable to generate filled ACA PDF",
      },
      {
        status: 400,
      },
    )
  }
}
