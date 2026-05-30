/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

/**
 * CSV import helpers for the admin users page.
 * Parses a bulk-invite CSV with columns: email, first_name, last_name, role, company_id.
 */

export type CsvRow = {
  email: string
  first_name: string
  last_name: string
  role: string
  company_id: string
  _error?: string
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
    const get = (key: string) => cols[header.indexOf(key)] ?? ""
    const row: CsvRow = {
      email: get("email"),
      first_name: get("first_name"),
      last_name: get("last_name"),
      role: get("role") || "applicant",
      company_id: get("company_id"),
    }
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      row._error = "Invalid email"
    }
    return row
  })
}
