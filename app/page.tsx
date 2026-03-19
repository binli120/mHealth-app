/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAppSelector } from "@/lib/redux/hooks"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import {
  AlertCircle, Bot, CheckCircle2, ChevronRight, ClipboardList,
  FileCheck, Globe, Layers, Lock, Scale, Search, Sparkles, Zap,
} from "lucide-react"
import { ShieldHeartIcon } from "@/lib/icons"

// ─── Scroll-trigger hook ──────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true) },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ─── Animated counter hook ────────────────────────────────────────────────────
function useCounter(end: number, inView: boolean, duration = 1600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!inView) return
    let n = 0
    const step = end / (duration / 16)
    const id = setInterval(() => {
      n += step
      if (n >= end) { setValue(end); clearInterval(id) } else setValue(Math.floor(n))
    }, 16)
    return () => clearInterval(id)
  }, [end, inView, duration])
  return value
}

// ─── Hero benefit-stack preview ───────────────────────────────────────────────
const PREVIEW_PROGRAMS = [
  { label: "MassHealth Standard", badge: "Eligible", color: "text-primary",  bg: "bg-primary/10",  delay: 400  },
  { label: "SNAP Benefits",       badge: "Eligible", color: "text-accent",   bg: "bg-accent/10",   delay: 900  },
  { label: "EITC Tax Credit",     badge: "Eligible", color: "text-success",  bg: "bg-success/10",  delay: 1400 },
  { label: "LIHEAP Energy Aid",   badge: "Eligible", color: "text-warning",  bg: "bg-warning/10",  delay: 1900 },
]

function BenefitPreview() {
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
          <span className="text-sm font-semibold text-foreground">Analyzing your eligibility…</span>
        </div>
        <div className="space-y-2.5">
          {PREVIEW_PROGRAMS.map((p, i) => (
            <div
              key={p.label}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5"
              style={{
                opacity: visible.includes(i) ? 1 : 0,
                transform: visible.includes(i) ? "translateY(0)" : "translateY(8px)",
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
            opacity: done ? 1 : 0,
            transform: done ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <p className="text-center text-sm font-semibold text-primary">
            🎉 4 programs found — up to $2,400/mo in benefits
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── FadeUp wrapper ────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const { ref, inView } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ─── How It Works steps ───────────────────────────────────────────────────────
const STEPS = [
  { icon: <Search className="h-6 w-6" />, title: "Answer a few questions", body: "Tell us about your household size, income, and situation — takes about 5 minutes." },
  { icon: <Sparkles className="h-6 w-6" />, title: "See programs you qualify for", body: "Our AI instantly checks your profile against MassHealth, SNAP, EITC, LIHEAP, WIC, and more." },
  { icon: <ClipboardList className="h-6 w-6" />, title: "Apply with guided steps", body: "We walk you through each application with plain-language explanations and a document checklist." },
  { icon: <Zap className="h-6 w-6" />, title: "Track everything in one place", body: "Monitor application status, renewal deadlines, and benefit amounts from your dashboard." },
]

function HowItWorksSteps() {
  const { ref, inView } = useInView(0.2)
  return (
    <div ref={ref} className="relative">
      {/* connecting line (desktop) */}
      <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-border md:block">
        <div
          className="h-full origin-left bg-primary"
          style={{
            transform: inView ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 1.4s ease-out 0.3s",
          }}
        />
      </div>
      <div className="relative grid gap-8 md:grid-cols-4">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="flex flex-col items-center text-center"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(24px)",
              transition: `opacity 0.5s ease ${i * 200 + 300}ms, transform 0.5s ease ${i * 200 + 300}ms`,
            }}
          >
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-card shadow-md">
              <span className="text-primary">{step.icon}</span>
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
            </div>
            <h3 className="mb-2 font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const selectedLanguage = useAppSelector((state) => state.app.language)

  // animated stats
  const { ref: statsRef, inView: statsInView } = useInView(0.3)
  const programs  = useCounter(9,    statsInView)
  const languages = useCounter(6,    statsInView)
  const minutes   = useCounter(15,   statsInView)
  const savings   = useCounter(2400, statsInView, 2200)

  return (
    <>
      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-12px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .float-1 { animation: float 4s ease-in-out infinite; }
        .float-2 { animation: float 5s ease-in-out 0.8s infinite; }
        .float-3 { animation: float 3.5s ease-in-out 1.5s infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, oklch(0.45 0.15 260) 0%, oklch(0.65 0.2 220) 50%, oklch(0.45 0.15 260) 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

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
            <nav className="hidden items-center gap-6 md:flex">
              <a href="#problems"     className="text-sm text-muted-foreground transition-colors hover:text-foreground">The Problem</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How It Works</a>
              <a href="#why-us"       className="text-sm text-muted-foreground transition-colors hover:text-foreground">Why Us</a>
              <a href="#appeal" className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80">
                Appeal Help
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span>
              </a>
              <Link href="/knowledge-center" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Resources</Link>
            </nav>
            <div className="flex items-center gap-3">
              <LanguageSwitcher className="w-[160px] border-border bg-card text-foreground" />
              <Link href="/auth/login">
                <Button variant="outline" size="sm" className="hidden sm:flex">Sign In</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Get Started</Button>
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
                  AI-powered benefit navigation for Massachusetts
                </div>
                <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                  Find every benefit{" "}
                  <span className="shimmer-text">you deserve</span>
                </h1>
                <p className="max-w-lg text-pretty text-lg text-muted-foreground md:text-xl">
                  Massachusetts residents miss thousands in annual benefits because the system is too complex.
                  HealthCompass MA checks 9+ programs at once and guides you through every application — for free.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {["Free to use", "9+ programs", "6 languages", "~15 min to apply"].map((tag) => (
                    <span key={tag} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-accent" />{tag}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/prescreener">
                    <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      Check My Eligibility
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button size="lg" variant="outline">Start Application</Button>
                  </Link>
                </div>
              </div>

              {/* right – animated preview */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="float-1 absolute -left-6 top-4 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg lg:flex">
                  <span className="text-xs font-medium text-foreground">💡 Missed benefit detected</span>
                </div>
                <div className="float-2 absolute -right-4 bottom-8 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg lg:flex">
                  <span className="text-xs font-medium text-foreground">✅ Application saved</span>
                </div>
                <div className="float-3 absolute -right-2 top-2 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg xl:flex">
                  <span className="text-xs font-medium text-foreground">🌐 6 languages supported</span>
                </div>
                <BenefitPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── The Problem ─────────────────────────────────────────────────────── */}
        <section id="problems" className="bg-card px-4 py-20 md:py-28">
          <div className="mx-auto max-w-7xl">
            <FadeUp className="mb-14 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">The Problem</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                Benefits exist — but they&apos;re nearly impossible to navigate
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Massachusetts offers billions in annual aid across dozens of programs. Yet most eligible
                residents miss out because the process is fragmented, confusing, and time-consuming.
              </p>
            </FadeUp>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: <Search className="h-6 w-6 text-destructive" />,
                  bg: "bg-destructive/10",
                  title: "You don't know what you qualify for",
                  body: "With 30+ state and federal programs, each with different income limits and rules, most people have no idea which benefits they're entitled to.",
                  delay: 0,
                },
                {
                  icon: <ClipboardList className="h-6 w-6 text-warning" />,
                  bg: "bg-warning/10",
                  title: "Every program has separate paperwork",
                  body: "Applying for MassHealth, SNAP, and LIHEAP separately means filling out the same information three times, on three different websites.",
                  delay: 150,
                },
                {
                  icon: <AlertCircle className="h-6 w-6 text-accent" />,
                  bg: "bg-accent/10",
                  title: "Benefits slip through the cracks",
                  body: "The average Massachusetts family misses $4,800/year in unclaimed benefits — not because they don't qualify, but because they never knew to apply.",
                  delay: 300,
                },
              ].map((item) => (
                <FadeUp key={item.title} delay={item.delay}>
                  <Card className="h-full border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <CardContent className="p-6">
                      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}>
                        {item.icon}
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
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
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">How It Works</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                From confusion to coverage in 4 steps
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                We eliminate the guesswork at every stage — from figuring out what you qualify for,
                to submitting applications and tracking outcomes.
              </p>
            </FadeUp>
            <HowItWorksSteps />
          </div>
        </section>

        {/* ── Why Choose Us ───────────────────────────────────────────────────── */}
        <section id="why-us" className="bg-card px-4 py-20 md:py-28">
          <div className="mx-auto max-w-7xl">
            <FadeUp className="mb-14 text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Why HealthCompass MA</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                Built for real Massachusetts families
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Every feature was designed around one goal: make sure eligible residents receive every
                dollar they&apos;re entitled to, with as little friction as possible.
              </p>
            </FadeUp>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: <Sparkles />, color: "text-primary", bg: "bg-primary/10", title: "AI Eligibility Engine",  body: "Cross-check your profile against 9+ state and federal programs in seconds — no paperwork required.", delay: 0   },
                { icon: <Layers />,   color: "text-accent",  bg: "bg-accent/10",  title: "Benefit Stacking",      body: "Most programs can be combined. We show every program you qualify for, not just one — maximizing your total benefit.", delay: 100 },
                { icon: <FileCheck />,color: "text-success", bg: "bg-success/10", title: "Guided Applications",   body: "Step-by-step walkthroughs with plain-language explanations, document checklists, and real-time validation.", delay: 200 },
                { icon: <Bot />,      color: "text-primary", bg: "bg-primary/10", title: "AI Chat Assistant",     body: "Ask questions any time. Our MassHealth assistant explains programs, deadlines, and next steps in plain language.", delay: 300 },
                { icon: <Globe />,    color: "text-accent",  bg: "bg-accent/10",  title: "6 Languages",           body: "Full support for English, 简体中文, Español, Português, Kreyòl ayisyen, and Tiếng Việt.", delay: 400 },
                { icon: <Lock />,     color: "text-success", bg: "bg-success/10", title: "Private & Secure",      body: "Your data is encrypted end-to-end and never sold. You control what you share and with whom.", delay: 500 },
                { icon: <Scale />,    color: "text-accent",  bg: "bg-accent/10",  title: "Appeal Assistance",    body: "Denied? Our AI helps you draft appeal letters, prep for hearings, and track deadlines — turning a 'no' into a 'yes'.", delay: 600, isNew: true },
              ].map((item) => (
                <FadeUp key={item.title} delay={item.delay}>
                  <Card className="group h-full border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                    <CardContent className="p-6">
                      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${item.bg}`}>
                        <span className={`[&>svg]:h-6 [&>svg]:w-6 ${item.color}`}>{item.icon}</span>
                      </div>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        {"isNew" in item && item.isNew && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">NEW</span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
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
              {[
                { value: programs,  suffix: "+",    prefix: "",  label: "Benefit programs checked"  },
                { value: languages, suffix: "",     prefix: "",  label: "Languages supported"        },
                { value: minutes,   suffix: " min", prefix: "~", label: "Average time to apply"      },
                { value: savings,   suffix: "/mo",  prefix: "$", label: "Max combined monthly benefit" },
              ].map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="text-4xl font-bold text-primary-foreground md:text-5xl">
                    {stat.prefix}{stat.value.toLocaleString()}{stat.suffix}
                  </div>
                  <div className="text-sm text-primary-foreground/70">{stat.label}</div>
                </div>
              ))}
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
                  New Feature
                </div>
                <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  Got denied? We&apos;ll help you{" "}
                  <span className="text-accent">fight back</span>
                </h2>
                <p className="max-w-lg text-pretty text-lg text-muted-foreground">
                  A denial isn&apos;t the end. Our AI-powered Appeal Assistance guides you through the
                  MassHealth appeal process step-by-step — helping you build a stronger case, meet
                  deadlines, and understand your rights.
                </p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {[
                    "Plain-language explanation of your denial reason",
                    "Personalized appeal letter drafting",
                    "Document checklist for your hearing",
                    "Deadline tracking so you never miss a filing window",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/auth/register">
                    <Button size="lg" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                      Start My Appeal
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/knowledge-center">
                    <Button size="lg" variant="outline">Learn About Appeals</Button>
                  </Link>
                </div>
              </FadeUp>

              {/* right – feature cards */}
              <FadeUp delay={200}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { icon: <Scale className="h-5 w-5" />, color: "text-accent", bg: "bg-accent/10", title: "Know Your Rights", body: "Understand exactly why you were denied and what grounds you can appeal on." },
                    { icon: <FileCheck className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10", title: "AI-Drafted Letters", body: "Generate a compelling, personalized appeal letter in minutes." },
                    { icon: <ClipboardList className="h-5 w-5" />, color: "text-success", bg: "bg-success/10", title: "Hearing Prep", body: "Get a tailored checklist of documents and tips for your fair hearing." },
                    { icon: <Zap className="h-5 w-5" />, color: "text-warning", bg: "bg-warning/10", title: "Deadline Alerts", body: "You have 30 days to appeal. We track it and remind you before time runs out." },
                  ].map((card) => (
                    <Card key={card.title} className="border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                      <CardContent className="p-5">
                        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
                          <span className={card.color}>{card.icon}</span>
                        </div>
                        <h3 className="mb-1.5 font-semibold text-foreground">{card.title}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{card.body}</p>
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
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Real Stories</p>
              <h2 className="text-3xl font-bold text-foreground md:text-4xl">
                Real help for real families
              </h2>
            </FadeUp>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { quote: "I had no idea I qualified for SNAP on top of MassHealth. HealthCompass MA found $600/month I was leaving on the table.", name: "Maria S.", location: "Worcester, MA", delay: 0 },
                { quote: "The step-by-step guidance made the whole process so much less intimidating. I finished everything in under 20 minutes.", name: "James T.", location: "Boston, MA", delay: 150 },
                { quote: "As a social worker, I recommend this to every client. It surfaces programs I wouldn't have thought to check.", name: "Priya K.", location: "Springfield, MA", delay: 300 },
              ].map((t) => (
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
              Stop missing benefits you&apos;ve already earned
            </h2>
            <p className="mb-8 text-lg text-primary-foreground/80">
              It takes 15 minutes. It&apos;s completely free. The average family discovers over
              $2,400/month in available benefits.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/prescreener">
                <Button size="lg" className="w-full gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-auto">
                  Check My Eligibility — Free
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="lg" variant="outline" className="w-full border-primary-foreground/40 text-primary-foreground hover:bg-white/10 sm:w-auto">
                  Sign In to Continue
                </Button>
              </Link>
            </div>
          </FadeUp>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-card px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 md:grid-cols-4">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <ShieldHeartIcon color="currentColor" className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-foreground">HealthCompass MA</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Helping Massachusetts residents discover and access the health and social benefits they deserve.
                </p>
              </div>
              <div>
                <h4 className="mb-4 font-semibold text-foreground">Programs</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="#" className="hover:text-foreground">MassHealth</Link></li>
                  <li><Link href="#" className="hover:text-foreground">SNAP / Food Assistance</Link></li>
                  <li><Link href="#" className="hover:text-foreground">EITC Tax Credits</Link></li>
                  <li><Link href="#" className="hover:text-foreground">LIHEAP Energy Aid</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 font-semibold text-foreground">Platform</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/prescreener" className="hover:text-foreground">Eligibility Checker</Link></li>
                  <li><Link href="/benefit-stack" className="hover:text-foreground">Benefit Stack Tool</Link></li>
                  <li>
                    <Link href="/auth/register" className="inline-flex items-center gap-1.5 hover:text-foreground">
                      Appeal Assistance
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">NEW</span>
                    </Link>
                  </li>
                  <li><Link href="/knowledge-center" className="hover:text-foreground">Knowledge Center</Link></li>
                  <li><Link href="/auth/register" className="hover:text-foreground">Create Account</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 font-semibold text-foreground">Support</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>1-800-841-2900</li>
                  <li>TTY: 1-800-497-4648</li>
                  <li>Mon–Fri, 8am–5pm</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
              <p>© 2026 HealthCompass MA. Not affiliated with the Commonwealth of Massachusetts. All rights reserved.</p>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
