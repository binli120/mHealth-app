"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Heart, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Bell, 
  User, 
  LogOut,
  ChevronRight,
  Calendar,
  Phone
} from "lucide-react"

const applications = [
  {
    id: "MH-2024-ABC12",
    type: "New Application",
    status: "under_review",
    submittedDate: "2024-02-15",
    lastUpdated: "2024-02-18",
  },
  {
    id: "MH-2023-XYZ99",
    type: "Renewal",
    status: "approved",
    submittedDate: "2023-08-10",
    lastUpdated: "2023-08-20",
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

export default function CustomerDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">MassHealth</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/customer/dashboard" className="text-sm font-medium text-foreground">
              Dashboard
            </Link>
            <Link href="/customer/status" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              My Applications
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Documents
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Messages
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                2
              </span>
            </Button>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
            <Link href="/">
              <Button variant="ghost" size="icon">
                <LogOut className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Welcome back, John</h1>
          <p className="mt-1 text-muted-foreground">Manage your MassHealth applications and coverage</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/application/new">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">New Application</p>
                  <p className="text-sm text-muted-foreground">Start a new application</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/customer/status">
            <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <Clock className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-card-foreground">Track Status</p>
                  <p className="text-sm text-muted-foreground">View application status</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <Upload className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">Upload Documents</p>
                <p className="text-sm text-muted-foreground">Submit required docs</p>
              </div>
            </CardContent>
          </Card>
          <Card className="h-full cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                <Phone className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-medium text-card-foreground">Get Help</p>
                <p className="text-sm text-muted-foreground">Contact support</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Applications List */}
          <div className="lg:col-span-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-card-foreground">My Applications</CardTitle>
                    <CardDescription>Your recent applications and their status</CardDescription>
                  </div>
                  <Link href="/customer/status">
                    <Button variant="ghost" size="sm" className="gap-1">
                      View All
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.map((app) => {
                    const status = statusConfig[app.status as keyof typeof statusConfig]
                    const StatusIcon = status.icon
                    return (
                      <Link key={app.id} href={`/customer/status/${app.id}`}>
                        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50">
                          <div className="flex items-center gap-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${status.color}`}>
                              <StatusIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{app.type}</p>
                              <p className="text-sm text-muted-foreground">ID: {app.id}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Updated {app.lastUpdated}
                            </p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Required */}
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  Action Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  Your application MH-2024-ABC12 requires additional documents.
                </p>
                <Button size="sm" className="w-full gap-2 bg-warning text-warning-foreground hover:bg-warning/90">
                  <Upload className="h-4 w-4" />
                  Upload Documents
                </Button>
              </CardContent>
            </Card>

            {/* Upcoming */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      28
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Coverage Renewal</p>
                      <p className="text-xs text-muted-foreground">March 28, 2024</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent">
                      15
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Document Deadline</p>
                      <p className="text-xs text-muted-foreground">April 15, 2024</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Our support team is available Monday-Friday, 8am-5pm.
                </p>
                <div className="text-sm">
                  <p className="font-medium text-foreground">1-800-841-2900</p>
                  <p className="text-muted-foreground">TTY: 1-800-497-4648</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
