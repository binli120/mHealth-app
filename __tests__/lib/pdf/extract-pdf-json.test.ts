import { describe, expect, it } from "vitest"
import { PDFDocument } from "pdf-lib"

import { extractPdfJson } from "@/lib/pdf/extract-pdf-json"

describe("lib/pdf/extract-pdf-json", () => {
  it("extracts metadata and form field values from PDF", async () => {
    const pdfDoc = await PDFDocument.create()
    pdfDoc.setTitle("Sample Form")
    pdfDoc.setAuthor("Unit Test")

    const page = pdfDoc.addPage([600, 800])
    const form = pdfDoc.getForm()

    const fullNameField = form.createTextField("fullName")
    fullNameField.setText("Jane Doe")
    fullNameField.addToPage(page, { x: 50, y: 700, width: 200, height: 24 })

    const citizenField = form.createCheckBox("isCitizen")
    citizenField.check()
    citizenField.addToPage(page, { x: 50, y: 650, width: 16, height: 16 })

    const bytes = await pdfDoc.save()

    const result = await extractPdfJson({
      bytes,
      fileName: "sample.pdf",
      fileSize: bytes.byteLength,
    })

    expect(result.pageCount).toBe(1)
    expect(result.fileName).toBe("sample.pdf")
    expect(result.metadata.title).toBe("Sample Form")
    expect(result.metadata.author).toBe("Unit Test")

    expect(result.formFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "fullName",
          type: "text",
          value: "Jane Doe",
        }),
        expect.objectContaining({
          name: "isCitizen",
          type: "checkbox",
          value: true,
        }),
      ]),
    )
  })
})
