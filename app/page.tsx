"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import { isSupportedLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages"
import { getMessage, type AppMessageKey } from "@/lib/i18n/messages"
import { Shield, FileText, Clock, Phone, ChevronRight, Heart, Users, CheckCircle2 } from "lucide-react"

export default function LandingPage() {
  const dispatch = useAppDispatch()
  const selectedLanguage = useAppSelector((state) => state.app.language)
  const t = (key: AppMessageKey) => getMessage(selectedLanguage, key)

  const handleLanguageChange = (value: string) => {
    if (isSupportedLanguage(value)) {
      dispatch(setLanguage(value))
    }
  }

  useEffect(() => {
    document.documentElement.lang = selectedLanguage
  }, [selectedLanguage])

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
              {t("navPrograms")}
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {t("navEligibility")}
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {t("navResources")}
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {t("navContact")}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-[190px] border-border bg-card text-foreground">
                <SelectValue placeholder={t("language")} />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <SelectItem key={language.code} value={language.code}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/auth/login">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                {t("signIn")}
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
                {t("trustedByResidents")}
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                {t("heroTitle")}
              </h1>
              <p className="text-pretty text-lg text-muted-foreground md:text-xl">
                {t("heroDescription")}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/application/new">
                  <Button size="lg" className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                    {t("applyForMassHealth")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/customer/status">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    {t("continueSavedApplication")}
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  {t("freeToApply")}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  {t("quickOnlineProcess")}
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
              <Card className="relative border-border bg-card shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-card-foreground">{t("checkYourStatus")}</CardTitle>
                  <CardDescription>{t("alreadyAppliedTrack")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
                      <span className="text-sm font-medium text-secondary-foreground">{t("applicationId")}</span>
                      <span className="text-sm text-muted-foreground">MH-2024-XXXXX</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-accent/10 p-3">
                      <span className="text-sm font-medium text-foreground">{t("status")}</span>
                      <span className="inline-flex items-center rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent">
                        {t("underReview")}
                      </span>
                    </div>
                  </div>
                  <Link href="/customer/status">
                    <Button variant="secondary" className="w-full">
                      {t("viewFullStatus")}
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
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">{t("quickActionNewApplication")}</h3>
                    <p className="text-sm text-muted-foreground">{t("quickActionStartApplication")}</p>
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
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">{t("quickActionRenewal")}</h3>
                    <p className="text-sm text-muted-foreground">{t("quickActionRenewCoverage")}</p>
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
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">{t("quickActionAddMember")}</h3>
                    <p className="text-sm text-muted-foreground">{t("quickActionAddHouseholdMember")}</p>
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
                    <h3 className="font-semibold text-card-foreground group-hover:text-primary">{t("quickActionGetHelp")}</h3>
                    <p className="text-sm text-muted-foreground">{t("quickActionContactSupport")}</p>
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
              {t("whyChooseMassHealth")}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {t("featureLead")}
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">{t("featureComprehensiveTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("featureComprehensiveBody")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <Clock className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">{t("featureQuickTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("featureQuickBody")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-card-foreground">{t("featureFamilyTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("featureFamilyBody")}
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
              <div className="mt-1 text-sm text-muted-foreground">{t("statMembersCovered")}</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">98%</div>
              <div className="mt-1 text-sm text-muted-foreground">{t("statSatisfactionRate")}</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">24/7</div>
              <div className="mt-1 text-sm text-muted-foreground">{t("statSupportAvailable")}</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">5 Days</div>
              <div className="mt-1 text-sm text-muted-foreground">{t("statAverageProcessing")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            {t("ctaBody")}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/application/new">
              <Button size="lg" className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto">
                {t("ctaStartApplication")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {t("ctaSignInToContinue")}
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
                {t("footerLead")}
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">{t("footerPrograms")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">{t("footerProgramStandard")}</Link></li>
                <li><Link href="#" className="hover:text-foreground">{t("footerProgramCarePlus")}</Link></li>
                <li><Link href="#" className="hover:text-foreground">{t("footerProgramFamilyAssistance")}</Link></li>
                <li><Link href="#" className="hover:text-foreground">{t("footerProgramLongTermCare")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">{t("footerResources")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground">{t("footerEligibilityGuide")}</Link></li>
                <li><Link href="#" className="hover:text-foreground">{t("footerDocumentChecklist")}</Link></li>
                <li><Link href="#" className="hover:text-foreground">{t("footerFaqs")}</Link></li>
                <li><Link href="#" className="hover:text-foreground">{t("footerContactUs")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">{t("footerContact")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>1-800-841-2900</li>
                <li>TTY: 1-800-497-4648</li>
                <li>{t("footerHours")}</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>{t("footerRights")}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
