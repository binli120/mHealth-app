/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import Link from "next/link"
import { Bell, BarChart2, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldHeartIcon, UserBadgeIcon } from "@/lib/icons"

export default function ReviewerReportsPage() {
  return (
    <div className="min-h-screen bg-background">
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
            <Link href="/reviewer/cases" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
              Cases
            </Link>
            <Link href="/reviewer/audit" className="text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground">
              Audit Log
            </Link>
            <Link href="/reviewer/reports" className="text-sm font-medium text-sidebar-foreground">
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

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Reports</h1>
          <p className="mt-1 text-muted-foreground">Analytics and compliance reporting</p>
        </div>

        <Card className="flex flex-col items-center py-20 text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BarChart2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">Reports coming soon</CardTitle>
            <CardDescription>
              Case outcome summaries, processing-time analytics, and HIPAA audit exports are
              in development and will be available in an upcoming release.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/reviewer/audit">View Audit Log</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
