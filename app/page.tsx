"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, FileText, Clock, Phone, ChevronRight, Heart, Users, CheckCircle2 } from "lucide-react"

export default function LandingPage() {
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
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Programs
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Eligibility
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Resources
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Select defaultValue="en">
              <SelectTrigger className="w-[100px] border-border bg-card text-foreground">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="vi">Tiếng Việt</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/auth/login">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Shield className="mr-2 h-4 w-4" />
                Trusted by millions of Massachusetts residents
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Health Coverage for Every Massachusetts Resident
              </h1>
              <p className="text-pretty text-lg text-muted-foreground md:text-xl">
                Apply for MassHealth coverage online. Get access to quality healthcare, 
                prescriptions, and medical services at little to no cost.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/application/new">
                  <Button size="lg" className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    Apply for MassHealth
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/customer/status">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Continue Saved Application
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Free to apply
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Quick online process
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
              <Card className="relative border-border bg-card shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-card-foreground">Check Your Status</CardTitle>
                  <CardDescription>Already applied? Track your application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
                      <span className="text-sm font-medium text-secondary-foreground">Application ID</span>
                      <span className="text-sm text-muted-foreground">MH-2024-XXXXX</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-accent/10 p-3">
                      <span className="text-sm font-medium text-foreground">Status</span>
                      <span className="inline-flex items-center rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent">
                        Under Review
                      </span>
                    </div>
                  </div>
                  <Link href="/customer/status">
                    <Button variant="secondary" className="w-full">
                      View Full Status
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="border-b border-border bg-card px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/application/new" className="group">
              <Card className="h-full border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">New Application</h3>
                    <p className="text-sm text-muted-foreground">Start your application</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/application/renewal" className="group">
              <Card className="h-full border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <Clock className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">Renewal</h3>
                    <p className="text-sm text-muted-foreground">Renew your coverage</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/application/household" className="group">
              <Card className="h-full border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
                    <Users className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">Add Member</h3>
                    <p className="text-sm text-muted-foreground">Add household member</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/contact" className="group">
              <Card className="h-full border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                    <Phone className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">Get Help</h3>
                    <p className="text-sm text-muted-foreground">Contact support</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Why Choose MassHealth?
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Comprehensive health coverage designed to meet the needs of Massachusetts residents
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">Comprehensive Coverage</h3>
                <p className="text-sm text-muted-foreground">
                  Access to doctors, hospitals, prescriptions, mental health services, and more at little to no cost.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <Clock className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">Quick Processing</h3>
                <p className="text-sm text-muted-foreground">
                  Our streamlined application process uses AI to help review your documents faster than ever.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">Family Coverage</h3>
                <p className="text-sm text-muted-foreground">
                  Cover your entire household with a single application. Programs for all ages and circumstances.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-primary/5 px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 text-center md:grid-cols-4">
            <div>
              <div className="text-4xl font-bold text-primary">2M+</div>
              <div className="mt-1 text-sm text-muted-foreground">Members Covered</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">98%</div>
              <div className="mt-1 text-sm text-muted-foreground">Satisfaction Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">24/7</div>
              <div className="mt-1 text-sm text-muted-foreground">Support Available</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">5 Days</div>
              <div className="mt-1 text-sm text-muted-foreground">Average Processing</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Ready to Get Started?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Apply for MassHealth coverage today and get access to quality healthcare for you and your family.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/application/new">
              <Button size="lg" className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                Start Application
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign In to Continue
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Heart className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">MassHealth</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Providing quality health coverage to Massachusetts residents since 1997.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Programs</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">Standard</Link></li>
                <li><Link href="#" className="hover:text-foreground">CarePlus</Link></li>
                <li><Link href="#" className="hover:text-foreground">Family Assistance</Link></li>
                <li><Link href="#" className="hover:text-foreground">Long-Term Care</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">Eligibility Guide</Link></li>
                <li><Link href="#" className="hover:text-foreground">Document Checklist</Link></li>
                <li><Link href="#" className="hover:text-foreground">FAQs</Link></li>
                <li><Link href="#" className="hover:text-foreground">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>1-800-841-2900</li>
                <li>TTY: 1-800-497-4648</li>
                <li>Mon-Fri: 8am-5pm</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Commonwealth of Massachusetts. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
