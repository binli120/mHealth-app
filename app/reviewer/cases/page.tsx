/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Search,
  Clock, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Users,
  Bell,
  LogOut,
  Filter,
  ChevronRight,
  SlidersHorizontal
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShieldHeartIcon, UserBadgeIcon } from "@/lib/icons"

const allCases = [
  {
    id: "MH-2024-ABC12",
    applicant: "John Doe",
    type: "New Application",
    status: "pending",
    confidence: 89,
    householdSize: 3,
    income: "$3,200/mo",
    submittedDate: "Feb 15, 2024",
    aging: 3,
    flags: ["Income Verification"],
  },
  {
    id: "MH-2024-DEF34",
    applicant: "Jane Smith",
    type: "Renewal",
    status: "rfi",
    confidence: 72,
    householdSize: 2,
    income: "$2,800/mo",
    submittedDate: "Feb 14, 2024",
    aging: 4,
    flags: ["Missing Documents", "Address Mismatch"],
  },
  {
    id: "MH-2024-GHI56",
    applicant: "Robert Johnson",
    type: "Long-Term Care",
    status: "flagged",
    confidence: 65,
    householdSize: 1,
    income: "$1,500/mo",
    submittedDate: "Feb 12, 2024",
    aging: 6,
    flags: ["High Asset Value", "Incomplete Information"],
  },
  {
    id: "MH-2024-JKL78",
    applicant: "Maria Garcia",
    type: "Add Household Member",
    status: "auto-approved",
    confidence: 96,
    householdSize: 4,
    income: "$4,100/mo",
    submittedDate: "Feb 16, 2024",
    aging: 2,
    flags: [],
  },
  {
    id: "MH-2024-MNO90",
    applicant: "David Lee",
    type: "New Application",
    status: "pending",
    confidence: 84,
    householdSize: 2,
    income: "$2,600/mo",
    submittedDate: "Feb 13, 2024",
    aging: 5,
    flags: ["SSN Verification"],
  },
  {
    id: "MH-2024-PQR12",
    applicant: "Sarah Williams",
    type: "Renewal",
    status: "approved",
    confidence: 97,
    householdSize: 3,
    income: "$3,800/mo",
    submittedDate: "Feb 10, 2024",
    aging: 8,
    flags: [],
  },
  {
    id: "MH-2024-STU34",
    applicant: "Michael Brown",
    type: "New Application",
    status: "denied",
    confidence: 91,
    householdSize: 1,
    income: "$6,200/mo",
    submittedDate: "Feb 8, 2024",
    aging: 10,
    flags: ["Income Over Limit"],
  },
  {
    id: "MH-2024-VWX56",
    applicant: "Emily Chen",
    type: "Long-Term Care",
    status: "pending",
    confidence: 78,
    householdSize: 2,
    income: "$2,100/mo",
    submittedDate: "Feb 11, 2024",
    aging: 7,
    flags: ["Asset Review Required"],
  },
]

const statusConfig = {
  pending: { label: "Pending", color: "bg-primary/10 text-primary border-primary/20" },
  rfi: { label: "RFI Required", color: "bg-warning/10 text-warning border-warning/20" },
  flagged: { label: "Flagged", color: "bg-destructive/10 text-destructive border-destructive/20" },
  "auto-approved": { label: "Auto-Approved", color: "bg-success/10 text-success border-success/20" },
  approved: { label: "Approved", color: "bg-success/10 text-success border-success/20" },
  denied: { label: "Denied", color: "bg-destructive/10 text-destructive border-destructive/20" },
}

export default function CasesListPage() {
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
                <span className="text-lg font-semibold text-sidebar-foreground">HealthCompass MA</span>
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
            <Link href="/reviewer/cases" className="text-sm font-medium text-sidebar-foreground">
              Cases
            </Link>
            <Link href="/reviewer/audit" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
              Audit Log
            </Link>
            <Link href="/reviewer/reports" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
              Reports
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative text-sidebar-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                5
              </span>
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
      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">All Cases</h1>
            <p className="mt-1 text-muted-foreground">
              {allCases.length} total cases • {allCases.filter(c => c.status === "pending").length} pending review
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Advanced Filters
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search by Case ID, Name, or SSN..." 
                  className="border-input bg-background pl-9 text-foreground"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-[140px] border-input bg-background text-foreground">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rfi">RFI Required</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="auto-approved">Auto-Approved</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[150px] border-input bg-background text-foreground">
                    <SelectValue placeholder="Application Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="new">New Application</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                    <SelectItem value="ltc">Long-Term Care</SelectItem>
                    <SelectItem value="household">Add Member</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[140px] border-input bg-background text-foreground">
                    <SelectValue placeholder="Confidence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Confidence</SelectItem>
                    <SelectItem value="high">High (90%+)</SelectItem>
                    <SelectItem value="medium">Medium (75-89%)</SelectItem>
                    <SelectItem value="low">Low (&lt;75%)</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[120px] border-input bg-background text-foreground">
                    <SelectValue placeholder="Aging" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ages</SelectItem>
                    <SelectItem value="3">{"<"} 3 days</SelectItem>
                    <SelectItem value="7">3-7 days</SelectItem>
                    <SelectItem value="14">7+ days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases List */}
        <div className="space-y-3">
          {allCases.map((caseItem) => {
            const status = statusConfig[caseItem.status as keyof typeof statusConfig]
            return (
              <Link key={caseItem.id} href={`/reviewer/case/${caseItem.id}`}>
                <Card className="border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row lg:items-center">
                      {/* Main Info */}
                      <div className="flex flex-1 items-center gap-4 p-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <UserBadgeIcon color="currentColor" className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{caseItem.applicant}</p>
                            <Badge variant="outline" className={`text-xs ${status.color}`}>
                              {status.label}
                            </Badge>
                            {caseItem.flags.map((flag, index) => (
                              <Badge key={index} variant="outline" className="text-xs bg-secondary/50">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="font-mono">{caseItem.id}</span>
                            <span>{caseItem.type}</span>
                            <span>Submitted: {caseItem.submittedDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap items-center gap-6 border-t border-border p-4 lg:border-l lg:border-t-0">
                        {/* Confidence */}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-sm font-semibold ${
                              caseItem.confidence >= 90
                                ? "bg-success/10 text-success"
                                : caseItem.confidence >= 75
                                ? "bg-warning/10 text-warning"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {caseItem.confidence}%
                          </span>
                        </div>

                        {/* Household */}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Household</p>
                          <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {caseItem.householdSize}
                          </div>
                        </div>

                        {/* Income */}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Income</p>
                          <p className="text-sm font-medium text-foreground">{caseItem.income}</p>
                        </div>

                        {/* Aging */}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Age</p>
                          <p className={`text-sm font-medium ${caseItem.aging > 7 ? "text-destructive" : caseItem.aging > 5 ? "text-warning" : "text-foreground"}`}>
                            {caseItem.aging}d
                          </p>
                        </div>

                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Pagination */}
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-{allCases.length} of {allCases.length} cases
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
