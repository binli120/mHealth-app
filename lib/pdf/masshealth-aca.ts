/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"

export interface MassHealthAcaInput {
  firstName: string
  lastName: string
  dateOfBirth: string
  email?: string
  ssn?: string
  streetAddress: string
  apartment?: string
  city: string
  state: string
  zipCode: string
  county?: string
  phone: string
  otherPhone?: string
  householdSize: number
  citizenship?: "citizen" | "permanent" | "refugee" | "other"
  preferredSpokenLanguage?: string
  preferredWrittenLanguage?: string
  employerName?: string
  monthlyIncome?: number
  annualIncome?: number
  weeklyHours?: number
  signatureName?: string
  signatureDate?: string
}

interface NormalizedAcaInput {
  fullName: string
  dateOfBirth: string
  email: string
  ssn: string
  streetAddress: string
  apartment: string
  city: string
  state: string
  zipCode: string
  county: string
  phone: string
  otherPhone: string
  householdSize: string
  preferredSpokenLanguage: string
  preferredWrittenLanguage: string
  citizenship: "citizen" | "permanent" | "refugee" | "other"
  employerName: string
  monthlyIncome: number
  annualIncome: number
  weeklyHours: number
  signatureName: string
  signatureDate: string
}

const TEMPLATE_PATH = path.join(process.cwd(), "public", "forms", "ACA-3-0325.pdf")
const FONT_CANDIDATE_PATHS = [
  path.join(process.cwd(), "public", "fonts", "handwriting.ttf"),
  "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf",
  "/System/Library/Fonts/Supplemental/Brush Script.ttf",
  path.join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "caveat",
    "files",
    "caveat-latin-600-normal.woff",
  ),
]

const PAGE = {
  step1: 2,
  step2a: 3,
  step2b: 4,
  step2c: 5,
  step2d: 6,
  step2e: 7,
  sign: 27,
} as const

function formatDate(input?: string): string {
  if (!input) {
    return ""
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
    return input
  }

  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    return input
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  const year = parsed.getFullYear()
  return `${month}/${day}/${year}`
}

function asMoney(value: number): string {
  return Math.max(0, value).toFixed(2)
}

function normalizeInput(input: MassHealthAcaInput): NormalizedAcaInput {
  const fullName = `${input.firstName} ${input.lastName}`.trim() || "Jane Doe"
  const now = new Date()
  const fallbackDate = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`

  const monthlyIncome = Number.isFinite(input.monthlyIncome) ? Number(input.monthlyIncome) : 3200
  const annualIncome = Number.isFinite(input.annualIncome)
    ? Number(input.annualIncome)
    : monthlyIncome * 12

  return {
    fullName,
    dateOfBirth: formatDate(input.dateOfBirth) || "01/15/1988",
    email: input.email?.trim() || "applicant@example.com",
    ssn: input.ssn?.trim() || "123-45-6789",
    streetAddress: input.streetAddress?.trim() || "123 Main St",
    apartment: input.apartment?.trim() || "",
    city: input.city?.trim() || "Boston",
    state: input.state?.trim() || "MA",
    zipCode: input.zipCode?.trim() || "02108",
    county: input.county?.trim() || "Suffolk",
    phone: input.phone?.trim() || "(617) 555-0101",
    otherPhone: input.otherPhone?.trim() || "",
    householdSize: String(Math.max(1, input.householdSize || 1)),
    citizenship: input.citizenship || "citizen",
    preferredSpokenLanguage: input.preferredSpokenLanguage?.trim() || "English",
    preferredWrittenLanguage: input.preferredWrittenLanguage?.trim() || "English",
    employerName: input.employerName?.trim() || "Acme Health Services",
    monthlyIncome,
    annualIncome,
    weeklyHours: Number.isFinite(input.weeklyHours) ? Number(input.weeklyHours) : 40,
    signatureName: input.signatureName?.trim() || fullName,
    signatureDate: formatDate(input.signatureDate) || fallbackDate,
  }
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size = 14,
) {
  if (!text.trim()) {
    return
  }

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0.11, 0.11, 0.11),
  })
}

function drawCheck(
  page: PDFPage,
  checked: boolean,
  x: number,
  y: number,
  font: PDFFont,
) {
  if (!checked) {
    return
  }

  page.drawText("X", {
    x,
    y,
    size: 12,
    font,
    color: rgb(0.11, 0.11, 0.11),
  })
}

export async function generateMassHealthAcaPdf(input: MassHealthAcaInput): Promise<Uint8Array> {
  const normalized = normalizeInput(input)
  const templateBytes = await readFile(TEMPLATE_PATH)

  const pdfDoc = await PDFDocument.load(templateBytes)
  pdfDoc.registerFontkit(fontkit)
  let handwritingFont: PDFFont | null = null

  for (const fontPath of FONT_CANDIDATE_PATHS) {
    try {
      const fontBytes = await readFile(fontPath)
      handwritingFont = await pdfDoc.embedFont(fontBytes)
      break
    } catch {
      // Try the next available font candidate.
    }
  }

  if (!handwritingFont) {
    handwritingFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
  }
  const pages = pdfDoc.getPages()

  const step1 = pages[PAGE.step1]
  drawText(step1, normalized.fullName, 44, 402, handwritingFont, 16)
  drawText(step1, normalized.dateOfBirth, 416, 402, handwritingFont, 16)
  drawText(step1, normalized.email, 42, 372, handwritingFont, 14)
  drawCheck(step1, false, 41, 364, handwritingFont)
  drawText(step1, normalized.streetAddress, 42, 340, handwritingFont, 14)
  drawText(step1, normalized.apartment, 452, 340, handwritingFont, 14)
  drawText(step1, normalized.city, 42, 308, handwritingFont, 14)
  drawText(step1, normalized.state, 320, 308, handwritingFont, 14)
  drawText(step1, normalized.zipCode, 362, 308, handwritingFont, 14)
  drawText(step1, normalized.county, 452, 308, handwritingFont, 14)
  drawText(step1, normalized.streetAddress, 42, 276, handwritingFont, 14)
  drawCheck(step1, true, 126, 268, handwritingFont)
  drawText(step1, normalized.city, 42, 244, handwritingFont, 14)
  drawText(step1, normalized.state, 320, 244, handwritingFont, 14)
  drawText(step1, normalized.zipCode, 364, 244, handwritingFont, 14)
  drawText(step1, normalized.county, 452, 244, handwritingFont, 14)
  drawText(step1, normalized.phone, 42, 212, handwritingFont, 14)
  drawText(step1, normalized.otherPhone, 215, 212, handwritingFont, 14)
  drawText(step1, normalized.householdSize, 420, 212, handwritingFont, 14)
  drawText(step1, normalized.preferredSpokenLanguage, 285, 177, handwritingFont, 13)
  drawText(step1, normalized.preferredWrittenLanguage, 430, 177, handwritingFont, 13)
  drawCheck(step1, false, 250, 142, handwritingFont)
  drawCheck(step1, true, 286, 142, handwritingFont)
  drawCheck(step1, false, 208, 99, handwritingFont)
  drawCheck(step1, true, 244, 99, handwritingFont)

  const step2a = pages[PAGE.step2a]
  drawText(step2a, normalized.fullName, 42, 238, handwritingFont, 16)
  drawText(step2a, normalized.dateOfBirth, 498, 238, handwritingFont, 14)
  drawCheck(step2a, normalized.citizenship === "citizen", 212, 228, handwritingFont)
  drawCheck(step2a, normalized.citizenship !== "citizen", 256, 228, handwritingFont)
  drawCheck(step2a, true, 62, 107, handwritingFont)
  drawCheck(step2a, false, 116, 107, handwritingFont)
  drawCheck(step2a, false, 181, 107, handwritingFont)
  drawCheck(step2a, false, 299, 107, handwritingFont)
  drawCheck(step2a, false, 420, 107, handwritingFont)
  drawCheck(step2a, false, 62, 89, handwritingFont)
  drawCheck(step2a, false, 394, 89, handwritingFont)
  drawCheck(step2a, true, 465, 89, handwritingFont)

  const step2b = pages[PAGE.step2b]
  drawCheck(step2b, true, 62, 707, handwritingFont)
  drawCheck(step2b, false, 181, 707, handwritingFont)
  drawCheck(step2b, false, 261, 707, handwritingFont)
  drawCheck(step2b, false, 317, 707, handwritingFont)
  drawCheck(step2b, false, 404, 693, handwritingFont)
  drawCheck(step2b, false, 474, 693, handwritingFont)

  drawCheck(step2b, false, 62, 628, handwritingFont)
  drawCheck(step2b, true, 176, 628, handwritingFont)
  drawCheck(step2b, false, 306, 628, handwritingFont)
  drawCheck(step2b, false, 378, 628, handwritingFont)
  drawText(step2b, "White", 142, 603, handwritingFont, 14)
  drawText(step2b, "Not Hispanic", 160, 566, handwritingFont, 14)

  const hasSsn = Boolean(normalized.ssn)
  drawCheck(step2b, hasSsn, 251, 529, handwritingFont)
  drawCheck(step2b, !hasSsn, 287, 529, handwritingFont)
  drawText(step2b, normalized.ssn, 170, 434, handwritingFont, 15)
  drawCheck(step2b, true, 414, 391, handwritingFont)
  drawCheck(step2b, false, 449, 391, handwritingFont)
  drawCheck(step2b, true, 111, 327, handwritingFont)
  drawCheck(step2b, false, 145, 327, handwritingFont)
  drawCheck(step2b, false, 184, 163, handwritingFont)
  drawCheck(step2b, true, 219, 163, handwritingFont)
  drawCheck(step2b, false, 511, 122, handwritingFont)
  drawCheck(step2b, true, 547, 122, handwritingFont)
  drawCheck(step2b, false, 511, 104, handwritingFont)
  drawCheck(step2b, true, 547, 104, handwritingFont)

  const step2c = pages[PAGE.step2c]
  drawCheck(step2c, false, 76, 733, handwritingFont)
  drawCheck(step2c, true, 112, 733, handwritingFont)
  drawCheck(step2c, false, 249, 663, handwritingFont)
  drawCheck(step2c, true, 285, 663, handwritingFont)
  drawCheck(step2c, false, 460, 618, handwritingFont)
  drawCheck(step2c, true, 496, 618, handwritingFont)
  drawCheck(step2c, true, 321, 504, handwritingFont)
  drawCheck(step2c, false, 357, 504, handwritingFont)
  drawCheck(step2c, normalized.citizenship === "citizen", 214, 470, handwritingFont)
  drawCheck(step2c, normalized.citizenship !== "citizen", 250, 470, handwritingFont)
  drawCheck(step2c, false, 383, 459, handwritingFont)
  drawCheck(step2c, true, 419, 459, handwritingFont)
  drawCheck(step2c, normalized.citizenship !== "citizen", 338, 424, handwritingFont)
  drawCheck(step2c, normalized.citizenship === "citizen", 374, 424, handwritingFont)
  drawCheck(step2c, false, 274, 367, handwritingFont)
  drawCheck(step2c, true, 310, 367, handwritingFont)
  drawCheck(step2c, false, 451, 205, handwritingFont)
  drawCheck(step2c, true, 487, 205, handwritingFont)
  drawCheck(step2c, false, 269, 177, handwritingFont)
  drawCheck(step2c, true, 305, 177, handwritingFont)
  drawCheck(step2c, false, 343, 148, handwritingFont)
  drawCheck(step2c, true, 379, 148, handwritingFont)
  drawCheck(step2c, false, 56, 88, handwritingFont)
  drawCheck(step2c, true, 92, 88, handwritingFont)

  const step2d = pages[PAGE.step2d]
  drawCheck(step2d, true, 364, 739, handwritingFont)
  drawCheck(step2d, false, 400, 739, handwritingFont)
  drawCheck(step2d, false, 274, 686, handwritingFont)
  drawCheck(step2d, true, 310, 686, handwritingFont)
  drawCheck(step2d, false, 382, 668, handwritingFont)
  drawCheck(step2d, true, 418, 668, handwritingFont)
  drawCheck(step2d, false, 145, 638, handwritingFont)
  drawCheck(step2d, true, 181, 638, handwritingFont)
  drawCheck(step2d, false, 264, 608, handwritingFont)
  drawCheck(step2d, true, 300, 608, handwritingFont)
  drawCheck(step2d, false, 194, 591, handwritingFont)
  drawCheck(step2d, true, 230, 591, handwritingFont)
  drawCheck(step2d, false, 187, 573, handwritingFont)
  drawCheck(step2d, true, 223, 573, handwritingFont)
  drawCheck(step2d, false, 321, 540, handwritingFont)
  drawCheck(step2d, true, 357, 540, handwritingFont)

  const hasIncome = normalized.monthlyIncome > 0
  drawCheck(step2d, hasIncome, 173, 492, handwritingFont)
  drawCheck(step2d, !hasIncome, 209, 492, handwritingFont)
  drawText(step2d, normalized.employerName, 73, 415, handwritingFont, 14)
  drawText(step2d, asMoney(normalized.monthlyIncome), 73, 386, handwritingFont, 14)
  drawCheck(step2d, true, 370, 386, handwritingFont)
  drawText(step2d, String(normalized.weeklyHours), 170, 354, handwritingFont, 14)
  drawCheck(step2d, false, 193, 343, handwritingFont)
  drawCheck(step2d, true, 229, 343, handwritingFont)
  drawText(step2d, "", 73, 335, handwritingFont, 14)
  drawText(step2d, "", 73, 304, handwritingFont, 14)
  drawText(step2d, "", 170, 261, handwritingFont, 14)
  drawCheck(step2d, false, 193, 223, handwritingFont)
  drawCheck(step2d, true, 229, 223, handwritingFont)

  const isSelfEmployed = normalized.employerName.toLowerCase().includes("self")
  drawCheck(step2d, isSelfEmployed, 257, 191, handwritingFont)
  drawCheck(step2d, !isSelfEmployed, 293, 191, handwritingFont)

  const step2e = pages[PAGE.step2e]
  drawText(step2e, asMoney(0), 146, 744, handwritingFont, 13)
  drawText(step2e, asMoney(0), 146, 725, handwritingFont, 13)
  drawText(step2e, asMoney(0), 198, 707, handwritingFont, 13)
  drawText(step2e, asMoney(0), 153, 689, handwritingFont, 13)
  drawText(step2e, asMoney(0), 181, 671, handwritingFont, 13)
  drawText(step2e, asMoney(0), 146, 652, handwritingFont, 13)
  drawText(step2e, asMoney(0), 161, 599, handwritingFont, 13)
  drawText(step2e, asMoney(0), 171, 581, handwritingFont, 13)
  drawText(step2e, asMoney(0), 286, 562, handwritingFont, 13)
  drawText(step2e, asMoney(0), 170, 525, handwritingFont, 13)
  drawText(step2e, asMoney(0), 198, 508, handwritingFont, 13)

  drawCheck(step2e, false, 440, 487, handwritingFont)
  drawCheck(step2e, true, 476, 487, handwritingFont)
  drawCheck(step2e, false, 410, 443, handwritingFont)
  drawCheck(step2e, true, 446, 443, handwritingFont)
  drawCheck(step2e, true, 57, 111, handwritingFont)

  drawText(step2e, asMoney(normalized.annualIncome), 67, 54, handwritingFont, 14)
  drawText(step2e, asMoney(normalized.annualIncome), 67, 42, handwritingFont, 14)

  const sign = pages[PAGE.sign]
  drawText(sign, normalized.signatureName, 44, 578, handwritingFont, 16)
  drawText(sign, normalized.signatureName, 376, 578, handwritingFont, 14)
  drawText(sign, normalized.signatureDate, 378, 559, handwritingFont, 14)
  drawCheck(sign, false, 294, 549, handwritingFont)
  drawCheck(sign, true, 330, 549, handwritingFont)

  drawCheck(sign, false, 79, 74, handwritingFont)
  drawCheck(sign, true, 115, 74, handwritingFont)

  return pdfDoc.save()
}
