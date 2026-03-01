"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Heart, ArrowLeft, FileText, RefreshCw, Building2, UserPlus, ChevronRight } from "lucide-react"

const applicationTypes = [
  {
    id: "new",
    title: "New Application",
    description: "Apply for MassHealth coverage for the first time",
    icon: FileText,
    href: "/application/new",
    recommended: true,
  },
  {
    id: "renewal",
    title: "Renewal",
    description: "Renew your existing MassHealth coverage",
    icon: RefreshCw,
    href: "/application/renewal",
    recommended: false,
  },
  {
    id: "ltc",
    title: "Long-Term Care",
    description: "Apply for nursing home or long-term care coverage",
    icon: Building2,
    href: "/application/ltc",
    recommended: false,
  },
  {
    id: "household",
    title: "Add Household Member",
    description: "Add a new member to your existing coverage",
    icon: UserPlus,
    href: "/application/household",
    recommended: false,
  },
]

export default function ApplicationTypePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Home</span>
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
      <main className="flex flex-1 flex-col px-4 py-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              What would you like to do?
            </h1>
            <p className="mt-2 text-muted-foreground">
              Select the type of application you need
            </p>
          </div>

          {/* Application Types */}
          <div className="space-y-4">
            {applicationTypes.map((type) => {
              const Icon = type.icon
              return (
                <Link key={type.id} href={type.href}>
                  <Card className={`border-border bg-card transition-all hover:border-primary/50 hover:shadow-md ${type.recommended ? "ring-2 ring-primary" : ""}`}>
                    <CardContent className="flex items-center gap-4 p-6">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${type.recommended ? "bg-primary" : "bg-primary/10"}`}>
                        <Icon className={`h-6 w-6 ${type.recommended ? "text-primary-foreground" : "text-primary"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-card-foreground">{type.title}</h3>
                          {type.recommended && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Most Common
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {/* Help Section */}
          <Card className="mt-8 border-border bg-secondary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-card-foreground">Not sure which to choose?</CardTitle>
              <CardDescription>
                Our support team can help you determine the right application type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full sm:w-auto">
                Contact Support: 1-800-841-2900
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
