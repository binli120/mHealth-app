/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Landing page for HealthCompass MA.
 * Data lives in page.constants.tsx, hooks in page.hooks.ts,
 * types in page.types.ts, and CSS animations in page.styles.ts.
 */

"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAppSelector } from "@/lib/redux/hooks"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"

import { LANDING_STYLES } from "@/app/page.styles"
import { useInView, useCounter } from "@/app/page.hooks"
import type { FadeUpProps } from "@/app/page.types"
import {
  APPEAL_CARDS,
  FEATURE_ITEMS,
  FOOTER_PLATFORM,
  FOOTER_PROGRAMS,
  LIVE_ASSISTANCE_CARDS,
  PREVIEW_PROGRAMS,
  PROBLEM_ITEMS,
  STATS_CONFIG,
  STEPS,
  TESTIMONIALS,
} from "@/app/page.constants"
import { getLandingCopy } from "@/app/page.copy"
import type { LandingCopy } from "@/app/page.copy"

// ─── BenefitPreview ───────────────────────────────────────────────────────────

function BenefitPreview({ copy }: { copy: LandingCopy }) {
  const [visible, setVisible] = useState<number[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    PREVIEW_PROGRAMS.forEach((p, i) => {
      setTimeout(() => {
        setVisible((prev) => [...prev, i])
        if (i === PREVIEW_PROGRAMS.length - 1) setTimeout(() => setDone(true), 300)
      }, p.delay)
    })
  }, [])

  return (
    <Card className="relative w-full max-w-sm border-border bg-card shadow-2xl xl:max-w-md">
      <div className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-md">
        AI
      </div>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{copy.previewAnalyzing}</span>
        </div>
        <div className="space-y-2.5">
          {PREVIEW_PROGRAMS.map((p, i) => (
            <div
              key={p.label}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5"
              style={{
                opacity:    visible.includes(i) ? 1 : 0,
                transform:  visible.includes(i) ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${p.color}`} />
                <span className="text-sm font-medium text-foreground">{p.label}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.bg} ${p.color}`}>
                {p.badge}
              </span>
            </div>
          ))}
        </div>
        <div
          className="mt-4 rounded-lg bg-primary/10 px-3 py-2.5"
          style={{
            opacity:    done ? 1 : 0,
            transform:  done ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <p className="text-center text-sm font-semibold text-primary">
            {copy.previewResult}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── FadeUp ───────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = "" }: FadeUpProps) {
  const { ref, inView } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    inView ? 1 : 0,
        transform:  inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ─── HowItWorksSteps ──────────────────────────────────────────────────────────

function HowItWorksSteps({ copy }: { copy: LandingCopy }) {
  const { ref, inView } = useInView(0.2)
  return (
    <div ref={ref} className="relative">
      {/* connecting line (desktop) */}
      <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-border md:block">
        <div
          className="h-full origin-left bg-primary"
          style={{
            transform:  inView ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 1.4s ease-out 0.3s",
          }}
        />
      </div>
      <div className="relative grid gap-8 md:grid-cols-4">
        {STEPS.map((step, i) => (
          <div
            key={copy.steps[i].title}
            className="flex flex-col items-center text-center"
            style={{
              opacity:    inView ? 1 : 0,
              transform:  inView ? "translateY(0)" : "translateY(24px)",
              transition: `opacity 0.5s ease ${i * 200 + 300}ms, transform 0.5s ease ${i * 200 + 300}ms`,
            }}
          >
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-card shadow-md">
              <span className="text-primary">{step.icon}</span>
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
            </div>
            <h3 className="mb-2 font-semibold text-foreground">{copy.steps[i].title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{copy.steps[i].body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const language = useAppSelector((state) => state.app.language)
  const copy = useMemo(() => getLandingCopy(language), [language])

  // Animated stat counters — hooks must be called unconditionally at top level
  const { ref: statsRef, inView: statsInView } = useInView(0.3)
  const statValues = [
    useCounter(STATS_CONFIG[0].target, statsInView, STATS_CONFIG[0].duration),
    useCounter(STATS_CONFIG[1].target, statsInView, STATS_CONFIG[1].duration),
    useCounter(STATS_CONFIG[2].target, statsInView, STATS_CONFIG[2].duration),
    useCounter(STATS_CONFIG[3].target, statsInView, STATS_CONFIG[3].duration),
  ]

  return (
    <>
      <style>{LANDING_STYLES}</style>

      <div className="min-h-screen bg-background">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <ShieldHeartIcon color="currentColor" className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold text-foreground">HealthCompass MA</span>
            </div>
            <nav className="hidden items-center gap-4 md:flex">
              <a href="#problems"     className="text-sm text-muted-foreground transition-colors hover:text-foreground">{copy.navProblem}</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{copy.navHowItWorks}</a>
              <a href="#why-us"       className="text-sm text-muted-foreground transition-colors hover:text-foreground">{copy.navWhyUs}</a>
              <a href="#live-assistance" className="flex items-center gap-0.5 text-sm font-medium text-accent transition-colors hover:text-accent/80">
                {copy.navLiveAssistance}
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{copy.newLabel}</span>
              </a>
              <a href="#appeal" className="flex items-center gap-0.5 text-sm font-medium text-primary transition-colors hover:text-primary/80">
                {copy.navAppealHelp}
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{copy.aiLabel}</span>
              </a>
              <Link href="/knowledge-center" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{copy.navResources}</Link>
            </nav>
            <div className="flex items-center gap-3">
              <LanguageSwitcher className="w-[160px] border-border bg-card text-foreground" />
              <Link href="/auth/login">
                <Button variant="outline" size="sm" className="hidden sm:flex">{copy.signIn}</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">{copy.getStarted}</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-20 md:py-28">
          <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />
          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              {/* left copy */}
              <div className="space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.heroBadge}
                </div>
                <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                  {copy.heroH1Line1}{" "}
                  <span className="shimmer-text">{copy.heroH1Shimmer}</span>
                </h1>
                <p className="max-w-lg text-pretty text-lg text-muted-foreground md:text-xl">
                  {copy.heroDesc}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {copy.heroTags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-accent" />{tag}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/prescreener">
                    <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      {copy.btnCheckEligibility} <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button size="lg" variant="outline">{copy.btnStartApplication}</Button>
                  </Link>
                </div>
              </div>

              {/* right – animated preview */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="float-1 absolute -left-6 top-4 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg lg:flex">
                  <span className="text-xs font-medium text-foreground">{copy.previewMissedBenefit}</span>
                </div>
                <div className="float-2 absolute -right-4 bottom-8 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg lg:flex">
                  <span className="text-xs font-medium text-foreground">{copy.previewSaved}</span>
                </div>
                <div className="float-3 absolute -right-2 top-2 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg xl:flex">
                  <span className="text-xs font-medium text-foreground">{copy.previewLanguages}</span>
                </div>
                <div className="float-1 absolute -left-2 bottom-2 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg xl:flex">
                  <span className="text-xs font-medium text-foreground">{copy.previewVoice}</span>
                </div>
                <BenefitPreview copy={copy} />
              </div>
            </div>
          </div>
        </section>

        {/* ── The Problem ─────────────────────────────────────────────────────── */}
        <section id="problems" className="bg-card px-4 py-20 md:py-28">
          <div className="mx-auto max-w-7xl">
            <FadeUp className="mb-14 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{copy.probLabel}</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                {copy.probTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                {copy.probDesc}
              </p>
            </FadeUp>
            <div className="grid gap-6 md:grid-cols-3">
              {PROBLEM_ITEMS.map((item, i) => (
                <FadeUp key={copy.problemItems[i].title} delay={item.delay}>
                  <Card className="h-full border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <CardContent className="p-6">
                      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}>
                        {item.icon}
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-foreground">{copy.problemItems[i].title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{copy.problemItems[i].body}</p>
                    </CardContent>
                  </Card>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ────────────────────────────────────────────────────── */}
        <section id="how-it-works" className="relative overflow-hidden bg-gradient-to-b from-background to-primary/5 px-4 py-20 md:py-28">
          <div className="mx-auto max-w-7xl">
            <FadeUp className="mb-16 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{copy.howLabel}</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                {copy.howTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                {copy.howDesc}
              </p>
            </FadeUp>
            <HowItWorksSteps copy={copy} />
          </div>
        </section>

        {/* ── Why Choose Us ───────────────────────────────────────────────────── */}
        <section id="why-us" className="bg-card px-4 py-20 md:py-28">
          <div className="mx-auto max-w-7xl">
            <FadeUp className="mb-14 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{copy.whyLabel}</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                {copy.whyTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                {copy.whyDesc}
              </p>
            </FadeUp>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_ITEMS.map((item, i) => (
                <FadeUp key={copy.featureItems[i].title} delay={item.delay}>
                  <Card className="group h-full border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                    <CardContent className="p-6">
                      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${item.bg}`}>
                        <span className={`[&>svg]:h-6 [&>svg]:w-6 ${item.color}`}>{item.icon}</span>
                      </div>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{copy.featureItems[i].title}</h3>
                        {item.isNew && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">{copy.newLabel}</span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">{copy.featureItems[i].body}</p>
                    </CardContent>
                  </Card>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────────────────────────── */}
        <section className="border-y border-border bg-primary px-4 py-16">
          <div ref={statsRef} className="mx-auto max-w-7xl">
            <div className="grid gap-8 text-center md:grid-cols-4">
              {STATS_CONFIG.map((stat, i) => (
                <div key={copy.statLabels[i]} className="space-y-1">
                  <div className="text-4xl font-bold text-primary-foreground md:text-5xl">
                    {stat.prefix}{statValues[i].toLocaleString()}{stat.suffix}
                  </div>
                  <div className="text-sm text-primary-foreground/70">{copy.statLabels[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live Assistance ─────────────────────────────────────────────────── */}
        <section id="live-assistance" className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4 py-20 md:py-28">
          <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
          <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />
          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              {/* left – feature cards */}
              <FadeUp>
                <div className="grid gap-4 sm:grid-cols-2">
                  {LIVE_ASSISTANCE_CARDS.map((card, i) => (
                    <Card key={copy.liveCards[i].title} className="border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                      <CardContent className="p-5">
                        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
                          <span className={card.color}>{card.icon}</span>
                        </div>
                        <h3 className="mb-1.5 font-semibold text-foreground">{copy.liveCards[i].title}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{copy.liveCards[i].body}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </FadeUp>

              {/* right copy */}
              <FadeUp delay={200} className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.liveFeatureLabel}
                </div>
                <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {copy.liveTitleLine1}{" "}
                  <span className="text-primary">{copy.liveTitleLine2}</span>
                </h2>
                <p className="max-w-lg text-pretty text-lg text-muted-foreground">
                  {copy.liveDesc}
                </p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {copy.liveChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/auth/register">
                    <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      {copy.btnGetConnected} <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </FadeUp>
            </div>
          </div>
        </section>

        {/* ── Appeal Assistance ───────────────────────────────────────────────── */}
        <section id="appeal" className="relative overflow-hidden bg-gradient-to-br from-accent/5 via-background to-primary/5 px-4 py-20 md:py-28">
          <div className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />
          <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
          <div className="relative mx-auto max-w-7xl">
            <div className="grid items-center gap-14 lg:grid-cols-2">
              {/* left copy */}
              <FadeUp className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.appealBadge}
                </div>
                <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {copy.appealTitleLine1}{" "}
                  <span className="text-accent">{copy.appealTitleLine2}</span>
                </h2>
                <p className="max-w-lg text-pretty text-lg text-muted-foreground">
                  {copy.appealDesc}
                </p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {copy.appealChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/masshealth-appeals">
                    <Button size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                      {copy.btnTryAppealAI} <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button size="lg" variant="outline">{copy.btnCreateAccount}</Button>
                  </Link>
                </div>
              </FadeUp>

              {/* right – feature cards */}
              <FadeUp delay={200}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {APPEAL_CARDS.map((card, i) => (
                    <Card key={copy.appealCards[i].title} className="border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                      <CardContent className="p-5">
                        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
                          <span className={card.color}>{card.icon}</span>
                        </div>
                        <h3 className="mb-1.5 font-semibold text-foreground">{copy.appealCards[i].title}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{copy.appealCards[i].body}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </FadeUp>
            </div>
          </div>
        </section>

        {/* ── Testimonials ────────────────────────────────────────────────────── */}
        <section className="px-4 py-20 md:py-24">
          <div className="mx-auto max-w-7xl">
            <FadeUp className="mb-12 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{copy.testimonialsLabel}</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">{copy.testimonialsTitle}</h2>
            </FadeUp>
            <div className="grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <FadeUp key={t.name} delay={t.delay}>
                  <Card className="h-full border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <CardContent className="p-6">
                      <div className="mb-4 text-lg text-accent">★★★★★</div>
                      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.location}</p>
                      </div>
                    </CardContent>
                  </Card>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-primary to-primary/80 px-4 py-20 md:py-24">
          <FadeUp className="mx-auto max-w-3xl text-center">
            <div className="relative mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <ShieldHeartIcon color="currentColor" className="h-8 w-8 text-primary-foreground" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-30" />
                <span className="relative inline-flex h-5 w-5 rounded-full bg-primary-foreground/50" />
              </span>
            </div>
            <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
              {copy.ctaTitle}
            </h2>
            <p className="mb-8 text-lg text-primary-foreground/80">
              {copy.ctaDesc}
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/prescreener">
                <Button size="lg" className="w-full gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-auto">
                  {copy.btnCTAEligibility} <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="w-full border-primary-foreground/40 text-primary-foreground hover:bg-white/10 sm:w-auto">
                  {copy.btnCTASignIn}
                </Button>
              </Link>
            </div>
          </FadeUp>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-card px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 md:grid-cols-4">
              {/* Brand */}
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-foreground">HealthCompass MA</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {copy.footerDesc}
                </p>
              </div>

              {/* Programs */}
              <div>
                <h4 className="mb-4 font-semibold text-foreground">{copy.footerProgramsLabel}</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {FOOTER_PROGRAMS.map((l, i) => (
                    <li key={l.href + i}>
                      <Link href={l.href} className="hover:text-foreground">{copy.footerProgramLinks[i]}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Platform */}
              <div>
                <h4 className="mb-4 font-semibold text-foreground">{copy.footerPlatformLabel}</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {FOOTER_PLATFORM.map((l, i) => (
                    <li key={l.href + i}>
                      <Link href={l.href} className="inline-flex items-center gap-1.5 hover:text-foreground">
                        {copy.footerPlatformLinks[i]}
                        {l.isNew && (
                          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">{copy.newLabel}</span>
                        )}
                        {l.isAI && (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">{copy.aiLabel}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Support */}
              <div>
                <h4 className="mb-4 font-semibold text-foreground">{copy.footerSupportLabel}</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>1-800-841-2900</li>
                  <li>TTY: 1-800-497-4648</li>
                  <li>Mon–Fri, 8am–5pm</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
              <p>{copy.footerCopyright}</p>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
