"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Heart, 
  ArrowLeft, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Upload,
  Download,
  MessageSquare,
  Calendar,
  User,
  Users,
  DollarSign
} from "lucide-react"

interface PageProps {
  params: { id: string }
}

const timelineSteps = [
  {
    status: "completed",
    title: "Application Submitted",
    date: "Feb 15, 2024 - 10:30 AM",
    description: "Your application was successfully submitted.",
  },
  {
    status: "completed",
    title: "Documents Received",
    date: "Feb 15, 2024 - 10:32 AM",
    description: "All uploaded documents have been received.",
  },
  {
    status: "completed",
    title: "AI Data Extraction",
    date: "Feb 15, 2024 - 10:45 AM",
    description: "Information extracted from your documents.",
  },
  {
    status: "current",
    title: "Under Review",
    date: "Feb 18, 2024",
    description: "A caseworker is reviewing your application.",
  },
  {
    status: "pending",
    title: "Decision",
    date: "Estimated: Feb 25, 2024",
    description: "Final decision on your application.",
  },
]

export default function StatusDetailPage({ params }: PageProps) {
  const { id } = params

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/customer/status" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Applications</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">MassHealth</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">New Application</h1>
                <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
                  <Clock className="mr-1.5 h-4 w-4" />
                  Under Review
                </span>
              </div>
              <p className="mt-1 font-mono text-muted-foreground">{id}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Status Timeline */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-card-foreground">Application Timeline</CardTitle>
                <CardDescription>Track your application progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {timelineSteps.map((step, index) => (
                    <div key={index} className="relative flex gap-4 pb-8 last:pb-0">
                      {/* Line */}
                      {index < timelineSteps.length - 1 && (
                        <div
                          className={`absolute left-[15px] top-8 h-full w-0.5 ${
                            step.status === "completed" ? "bg-success" : "bg-border"
                          }`}
                        />
                      )}

                      {/* Icon */}
                      <div
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          step.status === "completed"
                            ? "bg-success text-success-foreground"
                            : step.status === "current"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {step.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : step.status === "current" ? (
                          <Clock className="h-5 w-5" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-current" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <h4
                            className={`font-medium ${
                              step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {step.title}
                          </h4>
                          <span className="text-sm text-muted-foreground">{step.date}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Request for Information (if applicable) */}
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-card-foreground">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  Additional Documents Requested
                </CardTitle>
                <CardDescription>
                  Please upload the following documents by March 1, 2024
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Recent Paystub", status: "missing" },
                    { name: "Proof of Address", status: "missing" },
                  ].map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span className="text-foreground">{doc.name}</span>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Upload
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Deadline: <strong className="text-foreground">March 1, 2024</strong>
                </p>
              </CardContent>
            </Card>

            {/* Uploaded Documents */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-card-foreground">Uploaded Documents</CardTitle>
                <CardDescription>Documents submitted with your application</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Driver's License", date: "Feb 15, 2024", status: "verified" },
                    { name: "Tax Return 2023", date: "Feb 15, 2024", status: "verified" },
                    { name: "Immigration Document", date: "Feb 15, 2024", status: "pending" },
                  ].map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.date}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          doc.status === "verified"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {doc.status === "verified" ? "Verified" : "Pending Review"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Application Summary */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Application Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Applicant</p>
                    <p className="text-sm font-medium text-foreground">John Doe</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                    <Users className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Household Size</p>
                    <p className="text-sm font-medium text-foreground">3 members</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                    <DollarSign className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Income</p>
                    <p className="text-sm font-medium text-foreground">$3,200</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
                    <Calendar className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Submitted</p>
                    <p className="text-sm font-medium text-foreground">Feb 15, 2024</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preliminary Result */}
            <Card className="border-accent/50 bg-accent/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Preliminary Screening</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Based on information provided, you may qualify for:
                </p>
                <p className="mt-2 text-lg font-semibold text-accent">MassHealth CarePlus</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Final determination made by MassHealth after complete review.
                </p>
              </CardContent>
            </Card>

            {/* Help */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Questions about your application?
                </p>
                <Button variant="outline" className="w-full">
                  1-800-841-2900
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
