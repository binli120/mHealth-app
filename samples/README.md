# Sample ID Assets (Testing Only)

These files are **not real IDs** and are provided only for development and QA.

- `ma-test-id-front.svg`: non-official mock front image
- `ma-test-id-back.svg`: non-official mock back image with a placeholder barcode area
- `ma-test-id-barcode-aamva.txt`: synthetic AAMVA-style payload for parser tests
- `ma-test-id-pdf417.png`: generated PDF417 barcode image from the synthetic payload
- `ma-test-id-pdf417-hires.png`: high-resolution PDF417 barcode image (recommended for scanner testing)
- `ma-test-id-pdf417.svg`: generated PDF417 barcode vector image from the synthetic payload
- `aca-3-0325-payload.sample.json`: sample request payload for `POST /api/forms/aca-3-0325/fill`
- `aca-3-0325-workflow-full.sample.json`: comprehensive ACA-3 workflow sample (program/contact/assister + 2 persons with tax, coverage, and income sections) based on `config/ACA-03-0325.json`

Use these to test UI upload/capture flow and parser behavior. They are intentionally marked
`NOT A REAL ID` and should not be used for anything outside testing.
