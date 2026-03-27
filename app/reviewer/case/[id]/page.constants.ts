/**
 * Mock data constants for the Case Detail (Reviewer) page.
 * @author Bin Lee
 */

export const extractedData = [
  { field: "Full Name", value: "John Michael Doe", confidence: 98, source: "Driver's License" },
  { field: "Date of Birth", value: "January 15, 1985", confidence: 95, source: "Driver's License" },
  { field: "SSN", value: "***-**-4589", confidence: 99, source: "Application Form" },
  { field: "Address", value: "123 Main Street, Boston, MA 02101", confidence: 92, source: "Driver's License" },
  { field: "Employer", value: "ABC Corporation", confidence: 88, source: "Paystub" },
  { field: "Monthly Income", value: "$3,200", confidence: 75, source: "Paystub" },
  { field: "Employment Start", value: "March 2022", confidence: 72, source: "Paystub" },
  { field: "Household Size", value: "3", confidence: 96, source: "Application Form" },
]

export const validationWarnings = [
  { severity: "high", message: "Income listed but paystub date is over 60 days old", field: "Monthly Income" },
  { severity: "medium", message: "Address on license differs from application address", field: "Address" },
  { severity: "low", message: "Missing second income verification for spouse", field: "Household Income" },
]

export const auditLog = [
  { action: "Application Submitted", user: "Applicant", timestamp: "Feb 15, 2024 - 10:30 AM", details: "Initial submission" },
  { action: "Documents Uploaded", user: "Applicant", timestamp: "Feb 15, 2024 - 10:32 AM", details: "4 documents" },
  { action: "AI Extraction Complete", user: "System", timestamp: "Feb 15, 2024 - 10:45 AM", details: "89% overall confidence" },
  { action: "Assigned to Reviewer", user: "System", timestamp: "Feb 16, 2024 - 9:00 AM", details: "Sarah Johnson" },
  { action: "Case Opened", user: "Sarah Johnson", timestamp: "Feb 18, 2024 - 2:15 PM", details: "Initial review started" },
]

export const documents = [
  { name: "Driver's License", type: "image/jpeg", size: "1.2 MB", status: "verified" },
  { name: "Paystub_Jan_2024.pdf", type: "application/pdf", size: "245 KB", status: "warning" },
  { name: "Tax_Return_2023.pdf", type: "application/pdf", size: "1.8 MB", status: "verified" },
  { name: "Lease_Agreement.pdf", type: "application/pdf", size: "890 KB", status: "pending" },
]
