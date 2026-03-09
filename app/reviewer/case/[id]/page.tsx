"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { 
  ArrowLeft, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  User,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Edit3,
  History,
  Send,
  XCircle,
  MessageSquare,
  Shield,
  Brain
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ShieldHeartIcon } from "@/lib/icons"

interface PageProps {
  params: Promise<{ id: string }>
}

const extractedData = [
  { field: "Full Name", value: "John Michael Doe", confidence: 98, source: "Driver's License" },
  { field: "Date of Birth", value: "January 15, 1985", confidence: 95, source: "Driver's License" },
  { field: "SSN", value: "***-**-4589", confidence: 99, source: "Application Form" },
  { field: "Address", value: "123 Main Street, Boston, MA 02101", confidence: 92, source: "Driver's License" },
  { field: "Employer", value: "ABC Corporation", confidence: 88, source: "Paystub" },
  { field: "Monthly Income", value: "$3,200", confidence: 75, source: "Paystub" },
  { field: "Employment Start", value: "March 2022", confidence: 72, source: "Paystub" },
  { field: "Household Size", value: "3", confidence: 96, source: "Application Form" },
]

const validationWarnings = [
  { severity: "high", message: "Income listed but paystub date is over 60 days old", field: "Monthly Income" },
  { severity: "medium", message: "Address on license differs from application address", field: "Address" },
  { severity: "low", message: "Missing second income verification for spouse", field: "Household Income" },
]

const auditLog = [
  { action: "Application Submitted", user: "Applicant", timestamp: "Feb 15, 2024 - 10:30 AM", details: "Initial submission" },
  { action: "Documents Uploaded", user: "Applicant", timestamp: "Feb 15, 2024 - 10:32 AM", details: "4 documents" },
  { action: "AI Extraction Complete", user: "System", timestamp: "Feb 15, 2024 - 10:45 AM", details: "89% overall confidence" },
  { action: "Assigned to Reviewer", user: "System", timestamp: "Feb 16, 2024 - 9:00 AM", details: "Sarah Johnson" },
  { action: "Case Opened", user: "Sarah Johnson", timestamp: "Feb 18, 2024 - 2:15 PM", details: "Initial review started" },
]

const documents = [
  { name: "Driver's License", type: "image/jpeg", size: "1.2 MB", status: "verified" },
  { name: "Paystub_Jan_2024.pdf", type: "application/pdf", size: "245 KB", status: "warning" },
  { name: "Tax_Return_2023.pdf", type: "application/pdf", size: "1.8 MB", status: "verified" },
  { name: "Lease_Agreement.pdf", type: "application/pdf", size: "890 KB", status: "pending" },
]

export default function CaseDetailPage({ params }: PageProps) {
  const [selectedDoc, setSelectedDoc] = useState(0)
  const [decision, setDecision] = useState<string | null>(null)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-sidebar">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/reviewer/dashboard" className="flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">MassHealth</span>
            <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-xs font-medium text-sidebar-accent-foreground">
              Reviewer
            </span>
          </div>
        </div>
      </header>

      {/* Case Header */}
      <div className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">MH-2024-ABC12</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Under Review
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              New Application • Submitted Feb 15, 2024 • 3 days old
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <History className="h-4 w-4" />
              Audit Log
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Contact
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <main className="flex flex-1 flex-col lg:flex-row">
        {/* Left Panel - Document Viewer */}
        <div className="flex w-full flex-col border-b border-border lg:w-1/2 lg:border-b-0 lg:border-r">
          {/* Document Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-secondary/30 p-2">
            {documents.map((doc, index) => (
              <button
                key={index}
                onClick={() => setSelectedDoc(index)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedDoc === index
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card/50"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span className="max-w-[120px] truncate">{doc.name}</span>
                {doc.status === "verified" && (
                  <CheckCircle2 className="h-3 w-3 text-success" />
                )}
                {doc.status === "warning" && (
                  <AlertCircle className="h-3 w-3 text-warning" />
                )}
              </button>
            ))}
          </div>

          {/* Document Viewer */}
          <div className="relative flex-1 bg-secondary/30">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">100%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>

            {/* Document Preview Placeholder */}
            <div className="flex h-[400px] items-center justify-center lg:h-[calc(100vh-280px)]">
              <div className="text-center">
                <FileText className="mx-auto h-16 w-16 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">Document Preview</p>
                <p className="text-sm text-muted-foreground/70">{documents[selectedDoc].name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Data & Actions */}
        <div className="flex w-full flex-col lg:w-1/2">
          <Tabs defaultValue="extracted" className="flex flex-1 flex-col">
            <TabsList className="mx-4 mt-4 grid grid-cols-4">
              <TabsTrigger value="extracted">Extracted</TabsTrigger>
              <TabsTrigger value="ai-summary">AI Summary</TabsTrigger>
              <TabsTrigger value="warnings">Warnings</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="extracted" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-card-foreground">Extracted Data</CardTitle>
                    <CardDescription>Information extracted from uploaded documents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {extractedData.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-start justify-between rounded-lg border border-border bg-secondary/30 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">{item.field}</p>
                            <p className="font-medium text-foreground">{item.value}</p>
                            <p className="text-xs text-muted-foreground">Source: {item.source}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                item.confidence >= 90
                                  ? "bg-success/10 text-success"
                                  : item.confidence >= 75
                                  ? "bg-warning/10 text-warning"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {item.confidence}%
                            </span>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai-summary" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base text-card-foreground">AI Analysis Summary</CardTitle>
                    </div>
                    <CardDescription>Automated assessment of the application</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Summary Box */}
                    <div className="rounded-lg bg-primary/5 p-4">
                      <div className="grid gap-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Applicant</span>
                          <span className="font-medium text-foreground">John Michael Doe</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Household</span>
                          <span className="font-medium text-foreground">3 members</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly Income</span>
                          <span className="font-medium text-foreground">$3,200</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">FPL Level</span>
                          <span className="font-medium text-foreground">125%</span>
                        </div>
                        <div className="border-t border-border pt-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Preliminary Result</span>
                            <span className="font-semibold text-accent">Likely Eligible for CarePlus</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Confidence Meter */}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Overall Confidence</span>
                        <span className="font-medium text-foreground">89%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full w-[89%] rounded-full bg-success" />
                      </div>
                    </div>

                    {/* AI Notes */}
                    <div className="rounded-lg border border-border p-4">
                      <h4 className="mb-2 font-medium text-foreground">AI Notes</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          Identity verification passed with high confidence
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          Massachusetts residency confirmed
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                          Income verification needs review - paystub dated 45+ days ago
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                          Minor address discrepancy detected
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="warnings" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      <CardTitle className="text-base text-card-foreground">Validation Warnings</CardTitle>
                    </div>
                    <CardDescription>Issues requiring your attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {validationWarnings.map((warning, index) => (
                        <div
                          key={index}
                          className={`rounded-lg border p-4 ${
                            warning.severity === "high"
                              ? "border-destructive/50 bg-destructive/5"
                              : warning.severity === "medium"
                              ? "border-warning/50 bg-warning/5"
                              : "border-border bg-secondary/30"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <AlertCircle
                              className={`mt-0.5 h-5 w-5 shrink-0 ${
                                warning.severity === "high"
                                  ? "text-destructive"
                                  : warning.severity === "medium"
                                  ? "text-warning"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-foreground">{warning.message}</p>
                              <p className="text-sm text-muted-foreground">Field: {warning.field}</p>
                              <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                                Jump to field
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base text-card-foreground">Audit Trail</CardTitle>
                    </div>
                    <CardDescription>Complete history of case activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {auditLog.map((entry, index) => (
                        <div key={index} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <Clock className="h-4 w-4 text-primary" />
                            </div>
                            {index < auditLog.length - 1 && (
                              <div className="mt-2 h-full w-0.5 bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="font-medium text-foreground">{entry.action}</p>
                            <p className="text-sm text-muted-foreground">
                              {entry.user} • {entry.timestamp}
                            </p>
                            <p className="text-sm text-muted-foreground">{entry.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>

            {/* Decision Panel - Fixed at bottom */}
            <div className="border-t border-border bg-card p-4">
              <Card className="border-border bg-secondary/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-base text-card-foreground">Decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {/* Approve */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="gap-2 bg-success text-success-foreground hover:bg-success/90">
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Approve Application</DialogTitle>
                          <DialogDescription>
                            Confirm approval for MH-2024-ABC12
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Program Assignment</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select program" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="careplus">MassHealth CarePlus</SelectItem>
                                <SelectItem value="standard">MassHealth Standard</SelectItem>
                                <SelectItem value="family">Family Assistance</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Textarea placeholder="Add any notes..." />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline">Cancel</Button>
                          <Button className="bg-success text-success-foreground hover:bg-success/90">
                            Confirm Approval
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Deny */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
                          <XCircle className="h-4 w-4" />
                          Deny
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Deny Application</DialogTitle>
                          <DialogDescription>
                            Provide reason for denial
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Denial Reason</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Income Over Limit</SelectItem>
                                <SelectItem value="residency">Not MA Resident</SelectItem>
                                <SelectItem value="citizenship">Citizenship Ineligible</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Explanation</Label>
                            <Textarea placeholder="Provide detailed explanation..." />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline">Cancel</Button>
                          <Button variant="destructive">Confirm Denial</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Request Info */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <Send className="h-4 w-4" />
                          Request Info
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Request Additional Information</DialogTitle>
                          <DialogDescription>
                            Select documents or information needed
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-3">
                            <Label>Required Documents</Label>
                            {[
                              "Recent Paystub (within 30 days)",
                              "Proof of Address",
                              "Updated Tax Return",
                              "Birth Certificate",
                              "Immigration Documents",
                            ].map((doc, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <Checkbox id={`doc-${index}`} />
                                <Label htmlFor={`doc-${index}`} className="text-sm font-normal">
                                  {doc}
                                </Label>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <Label>Additional Notes</Label>
                            <Textarea placeholder="Explain what's needed..." />
                          </div>
                          <div className="space-y-2">
                            <Label>Response Deadline</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select deadline" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="7">7 days</SelectItem>
                                <SelectItem value="14">14 days</SelectItem>
                                <SelectItem value="30">30 days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline">Cancel</Button>
                          <Button>Send Request</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Escalate */}
                    <Button variant="outline" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Escalate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
