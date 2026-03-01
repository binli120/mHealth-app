"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Heart, 
  Search,
  Clock, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  FileText,
  Users,
  Bell,
  User,
  LogOut,
  Filter,
  ChevronRight,
  ArrowUpRight,
  TrendingUp,
  Calendar
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const stats = [
  { 
    label: "Pending Review", 
    value: 47, 
    change: "+12%", 
    icon: Clock, 
    color: "bg-primary/10 text-primary",
    href: "/reviewer/cases?status=pending"
  },
  { 
    label: "RFI Required", 
    value: 15, 
    change: "-5%", 
    icon: AlertCircle, 
    color: "bg-warning/10 text-warning",
    href: "/reviewer/cases?status=rfi"
  },
  { 
    label: "Auto-Approved", 
    value: 23, 
    change: "+8%", 
    icon: CheckCircle2, 
    color: "bg-success/10 text-success",
    href: "/reviewer/cases?status=auto-approved"
  },
  { 
    label: "Flagged (High Risk)", 
    value: 8, 
    change: "+2", 
    icon: AlertTriangle, 
    color: "bg-destructive/10 text-destructive",
    href: "/reviewer/cases?status=flagged"
  },
]

const recentCases = [
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
]

const statusConfig = {
  pending: { label: "Pending", color: "bg-primary/10 text-primary border-primary/20" },
  rfi: { label: "RFI Required", color: "bg-warning/10 text-warning border-warning/20" },
  flagged: { label: "Flagged", color: "bg-destructive/10 text-destructive border-destructive/20" },
  "auto-approved": { label: "Auto-Approved", color: "bg-success/10 text-success border-success/20" },
  approved: { label: "Approved", color: "bg-success/10 text-success border-success/20" },
  denied: { label: "Denied", color: "bg-destructive/10 text-destructive border-destructive/20" },
}

export default function ReviewerDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-sidebar">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
                <Heart className="h-5 w-5 text-sidebar-primary-foreground" />
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
            <Link href="/reviewer/dashboard" className="text-sm font-medium text-sidebar-foreground">
              Dashboard
            </Link>
            <Link href="/reviewer/cases" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
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
              <User className="h-5 w-5" />
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
        {/* Welcome */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">Good morning, Sarah</h1>
            <p className="mt-1 text-muted-foreground">You have 47 cases awaiting review</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Link key={stat.label} href={stat.href}>
                <Card className="border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="text-success">{stat.change}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Aging Alert */}
        <Card className="mb-8 border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">5 cases aging over 7 days</p>
              <p className="text-sm text-muted-foreground">These cases require immediate attention</p>
            </div>
            <Link href="/reviewer/cases?aging=7">
              <Button variant="outline" size="sm" className="gap-2">
                View Cases
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Cases Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-card-foreground">Recent Cases</CardTitle>
                <CardDescription>Cases requiring your review</CardDescription>
              </div>
              <Link href="/reviewer/cases">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search by Case ID or Name..." 
                  className="border-input bg-background pl-9 text-foreground"
                />
              </div>
              <div className="flex gap-2">
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
              </div>
            </div>

            {/* Cases List */}
            <div className="space-y-3">
              {recentCases.map((caseItem) => {
                const status = statusConfig[caseItem.status as keyof typeof statusConfig]
                return (
                  <Link key={caseItem.id} href={`/reviewer/case/${caseItem.id}`}>
                    <div className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{caseItem.applicant}</p>
                            <Badge variant="outline" className={`text-xs ${status.color}`}>
                              {status.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="font-mono">{caseItem.id}</span>
                            <span>{caseItem.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {/* Confidence */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Confidence:</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
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
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{caseItem.householdSize}</span>
                        </div>

                        {/* Income */}
                        <span className="text-muted-foreground">{caseItem.income}</span>

                        {/* Aging */}
                        <span className={`text-xs ${caseItem.aging > 5 ? "text-destructive" : "text-muted-foreground"}`}>
                          {caseItem.aging}d old
                        </span>

                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
