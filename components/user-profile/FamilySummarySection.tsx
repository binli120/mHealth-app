"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoBox } from "@/components/shared/InfoBox"
import { Users, ArrowRight } from "lucide-react"
import type { FamilyProfileSummary } from "@/lib/user-profile/types"

interface Props {
  summary: FamilyProfileSummary | null
}

export function FamilySummarySection({ summary }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Family &amp; Income</CardTitle>
        <CardDescription>
          Household composition and income details used to evaluate benefit eligibility.
          Managed through the Benefit Stack wizard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary ? (
          <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-card-foreground">
                {summary.householdSize} household member{summary.householdSize !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                Last updated{" "}
                {new Date(summary.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <Link href="/benefit-stack">
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                Edit
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <InfoBox variant="neutral">
            <p className="text-sm">
              You haven&apos;t completed a family profile yet. The Benefit Stack wizard collects
              household size, income, and expenses to find programs you qualify for.
            </p>
          </InfoBox>
        )}

        <Link href="/benefit-stack">
          <Button className="gap-2">
            {summary ? "Update family &amp; income" : "Set up family profile"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
