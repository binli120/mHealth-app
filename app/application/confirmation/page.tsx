/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Download, Mail, Calendar, ArrowRight } from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"

const submittedDate = new Date().toLocaleDateString()
const caseId = `MH-2024-${crypto.randomUUID().slice(0, 5).toUpperCase()}`

export default function ConfirmationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">HealthCompass MA</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">
          {/* Success Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
            Application Submitted!
          </h1>
          <p className="mb-8 text-muted-foreground">
            Your MassHealth application has been successfully submitted.
          </p>

          {/* Case Details Card */}
          <Card className="mb-6 border-border bg-card text-left">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-card-foreground">Application Details</CardTitle>
              <CardDescription>Save this information for your records</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-primary/5 p-4">
                <span className="text-sm text-muted-foreground">Case ID</span>
                <span className="font-mono text-lg font-semibold text-primary">{caseId}</span>
              </div>
              
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Submitted:</span>
                  <span className="text-foreground">{submittedDate}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Confirmation sent to:</span>
                  <span className="text-foreground">your@email.com</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Calendar className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Estimated Processing Time</p>
                    <p className="text-sm text-muted-foreground">5-10 business days</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      You will receive updates via email and in your dashboard
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Download className="h-4 w-4" />
              Download Confirmation (PDF)
            </Button>
            <Link href="/customer/status" className="block">
              <Button variant="outline" className="w-full gap-2">
                Track Application Status
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full">
                Return to Home
              </Button>
            </Link>
          </div>

          {/* Help Text */}
          <p className="mt-8 text-sm text-muted-foreground">
            Questions? Contact us at{" "}
            <span className="font-medium text-foreground">1-800-841-2900</span>
          </p>
        </div>
      </main>
    </div>
  )
}
