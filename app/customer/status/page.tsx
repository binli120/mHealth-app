"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Heart, 
  ArrowLeft, 
  Search,
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Filter
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const applications = [
  {
    id: "MH-2024-ABC12",
    type: "New Application",
    status: "under_review",
    submittedDate: "2024-02-15",
    lastUpdated: "2024-02-18",
    applicant: "John Doe",
    householdSize: 3,
  },
  {
    id: "MH-2024-DEF34",
    type: "Renewal",
    status: "rfi",
    submittedDate: "2024-02-10",
    lastUpdated: "2024-02-16",
    applicant: "John Doe",
    householdSize: 3,
  },
  {
    id: "MH-2023-XYZ99",
    type: "Renewal",
    status: "approved",
    submittedDate: "2023-08-10",
    lastUpdated: "2023-08-20",
    applicant: "John Doe",
    householdSize: 2,
  },
  {
    id: "MH-2023-LMN77",
    type: "Add Household Member",
    status: "approved",
    submittedDate: "2023-06-05",
    lastUpdated: "2023-06-12",
    applicant: "John Doe",
    householdSize: 3,
  },
]

const statusConfig = {
  draft: { label: "Draft", color: "bg-secondary text-secondary-foreground", icon: FileText },
  submitted: { label: "Submitted", color: "bg-primary/10 text-primary", icon: Clock },
  under_review: { label: "Under Review", color: "bg-accent/10 text-accent", icon: Clock },
  rfi: { label: "Info Needed", color: "bg-warning/10 text-warning", icon: AlertCircle },
  approved: { label: "Approved", color: "bg-success/10 text-success", icon: CheckCircle2 },
  denied: { label: "Denied", color: "bg-destructive/10 text-destructive", icon: AlertCircle },
}

export default function StatusListPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/customer/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Dashboard</span>
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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">My Applications</h1>
          <p className="mt-1 text-muted-foreground">Track and manage all your MassHealth applications</p>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search by Case ID..." 
                  className="border-input bg-background pl-9 text-foreground"
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-full border-input bg-background text-foreground sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="rfi">Info Needed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
        <div className="space-y-4">
          {applications.map((app) => {
            const status = statusConfig[app.status as keyof typeof statusConfig]
            const StatusIcon = status.icon
            const needsAction = app.status === "rfi"

            return (
              <Link key={app.id} href={`/customer/status/${app.id}`}>
                <Card className={`border-border bg-card transition-all hover:border-primary/50 hover:shadow-md ${needsAction ? "ring-2 ring-warning" : ""}`}>
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Status Indicator */}
                      <div className={`flex items-center justify-center p-4 sm:w-32 ${status.color}`}>
                        <div className="text-center">
                          <StatusIcon className="mx-auto h-6 w-6" />
                          <p className="mt-1 text-xs font-medium">{status.label}</p>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 items-center justify-between p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{app.type}</h3>
                            {needsAction && (
                              <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-warning-foreground">
                                Action Required
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-sm text-muted-foreground">{app.id}</p>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>Submitted: {app.submittedDate}</span>
                            <span>Household: {app.householdSize}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Help Section */}
        <Card className="mt-8 border-border bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-card-foreground">Need Help?</CardTitle>
            <CardDescription>
              {"Can't find your application or have questions about your status?"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Contact Support: 1-800-841-2900</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
