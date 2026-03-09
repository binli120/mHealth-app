"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Search,
  Bell,
  LogOut,
  Filter,
  Download,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  Edit3,
  Send,
  Eye,
  Shield
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShieldHeartIcon, UserBadgeIcon } from "@/lib/icons"

const auditLogs = [
  {
    id: "LOG-001",
    timestamp: "Feb 18, 2024 - 3:45 PM",
    action: "Application Approved",
    caseId: "MH-2024-JKL78",
    user: "Sarah Johnson",
    role: "Reviewer",
    details: "Approved for MassHealth CarePlus",
    icon: CheckCircle2,
    iconColor: "text-success",
  },
  {
    id: "LOG-002",
    timestamp: "Feb 18, 2024 - 3:30 PM",
    action: "Field Updated",
    caseId: "MH-2024-ABC12",
    user: "Sarah Johnson",
    role: "Reviewer",
    details: "Monthly Income: $3,200 → $3,400",
    icon: Edit3,
    iconColor: "text-primary",
  },
  {
    id: "LOG-003",
    timestamp: "Feb 18, 2024 - 2:15 PM",
    action: "Case Opened",
    caseId: "MH-2024-ABC12",
    user: "Sarah Johnson",
    role: "Reviewer",
    details: "Initial review started",
    icon: Eye,
    iconColor: "text-primary",
  },
  {
    id: "LOG-004",
    timestamp: "Feb 18, 2024 - 1:00 PM",
    action: "RFI Sent",
    caseId: "MH-2024-DEF34",
    user: "Mike Chen",
    role: "Reviewer",
    details: "Requested: Recent Paystub, Proof of Address",
    icon: Send,
    iconColor: "text-warning",
  },
  {
    id: "LOG-005",
    timestamp: "Feb 18, 2024 - 11:30 AM",
    action: "Application Denied",
    caseId: "MH-2024-STU34",
    user: "Sarah Johnson",
    role: "Reviewer",
    details: "Reason: Income Over Limit",
    icon: XCircle,
    iconColor: "text-destructive",
  },
  {
    id: "LOG-006",
    timestamp: "Feb 18, 2024 - 10:00 AM",
    action: "Case Escalated",
    caseId: "MH-2024-GHI56",
    user: "Mike Chen",
    role: "Reviewer",
    details: "Escalated to supervisor for high asset review",
    icon: Shield,
    iconColor: "text-destructive",
  },
  {
    id: "LOG-007",
    timestamp: "Feb 17, 2024 - 4:30 PM",
    action: "Document Verified",
    caseId: "MH-2024-MNO90",
    user: "System (AI)",
    role: "Automated",
    details: "Driver's License verified - 98% confidence",
    icon: FileText,
    iconColor: "text-success",
  },
  {
    id: "LOG-008",
    timestamp: "Feb 17, 2024 - 3:00 PM",
    action: "AI Extraction Complete",
    caseId: "MH-2024-VWX56",
    user: "System (AI)",
    role: "Automated",
    details: "78% overall confidence - Manual review required",
    icon: Clock,
    iconColor: "text-warning",
  },
]

export default function AuditLogPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-sidebar">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
                <ShieldHeartIcon color="currentColor" className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <span className="text-lg font-semibold text-sidebar-foreground">MassHealth</span>
                <span className="ml-2 rounded-full bg-sidebar-accent px-2 py-0.5 text-xs font-medium text-sidebar-accent-foreground">
                  Reviewer Portal
                </span>
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/reviewer/dashboard" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
              Dashboard
            </Link>
            <Link href="/reviewer/cases" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
              Cases
            </Link>
            <Link href="/reviewer/audit" className="text-sm font-medium text-sidebar-foreground">
              Audit Log
            </Link>
            <Link href="/reviewer/reports" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
              Reports
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative text-sidebar-foreground">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <UserBadgeIcon color="currentColor" className="h-5 w-5" />
            </Button>
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <LogOut className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Audit Log</h1>
            <p className="mt-1 text-muted-foreground">
              Complete activity history for HIPAA compliance
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Log
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search by Case ID, or Action..." 
                  className="border-input bg-background pl-9 text-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[140px] border-input bg-background text-foreground">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="rfi">RFI Sent</SelectItem>
                    <SelectItem value="updated">Field Updated</SelectItem>
                    <SelectItem value="viewed">Case Viewed</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[140px] border-input bg-background text-foreground">
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="sarah">Sarah Johnson</SelectItem>
                    <SelectItem value="mike">Mike Chen</SelectItem>
                    <SelectItem value="system">System (AI)</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="7">
                  <SelectTrigger className="w-[140px] border-input bg-background text-foreground">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {auditLogs.map((log) => {
                const Icon = log.icon
                return (
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-secondary/30">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary ${log.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{log.action}</p>
                        <Link href={`/reviewer/case/${log.caseId}`}>
                          <span className="font-mono text-sm text-primary hover:underline">
                            {log.caseId}
                          </span>
                        </Link>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{log.details}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <UserBadgeIcon color="currentColor" className="h-3 w-3" />
                          {log.user}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                          {log.role}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {log.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-{auditLogs.length} of {auditLogs.length} entries
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled>Previous</Button>
            <Button variant="outline" disabled>Next</Button>
          </div>
        </div>
      </main>
    </div>
  )
}
