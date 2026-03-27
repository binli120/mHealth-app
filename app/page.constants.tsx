/**
 * Static data for the landing page — programs, steps, features, testimonials, etc.
 * Kept in a separate file to keep page.tsx focused on layout and behaviour.
 * @author Bin Lee
 */

import {
  AlertCircle,
  Bot,
  ClipboardList,
  FileCheck,
  Globe,
  Languages,
  Layers,
  Lock,
  MessageCircle,
  Mic,
  Monitor,
  Scale,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react"

import type {
  AppealCard,
  FeatureItem,
  FooterLink,
  PreviewProgram,
  ProblemItem,
  StatConfig,
  Step,
  Testimonial,
} from "@/app/page.types"

// ── Hero ──────────────────────────────────────────────────────────────────────

export const PREVIEW_PROGRAMS: PreviewProgram[] = [
  { label: "MassHealth Standard", badge: "Eligible", color: "text-primary", bg: "bg-primary/10",  delay: 400  },
  { label: "SNAP Benefits",       badge: "Eligible", color: "text-accent",  bg: "bg-accent/10",   delay: 900  },
  { label: "EITC Tax Credit",     badge: "Eligible", color: "text-success", bg: "bg-success/10",  delay: 1400 },
  { label: "LIHEAP Energy Aid",   badge: "Eligible", color: "text-warning", bg: "bg-warning/10",  delay: 1900 },
]

export const HERO_TAGS = ["Free to use", "9+ programs", "6 languages", "Voice messaging", "~15 min to apply"]

// ── How It Works ──────────────────────────────────────────────────────────────

export const STEPS: Step[] = [
  { icon: <Search className="h-6 w-6" />,      title: "Answer a few questions",     body: "Tell us about your household size, income, and situation — takes about 5 minutes." },
  { icon: <Sparkles className="h-6 w-6" />,    title: "See programs you qualify for", body: "Our AI instantly checks your profile against MassHealth, SNAP, EITC, LIHEAP, WIC, and more." },
  { icon: <ClipboardList className="h-6 w-6" />, title: "Apply with guided steps",   body: "We walk you through each application with plain-language explanations and a document checklist." },
  { icon: <Zap className="h-6 w-6" />,         title: "Track everything in one place", body: "Monitor application status, renewal deadlines, and benefit amounts from your dashboard." },
]

// ── The Problem ───────────────────────────────────────────────────────────────

export const PROBLEM_ITEMS: ProblemItem[] = [
  {
    icon:  <Search className="h-6 w-6 text-destructive" />,
    bg:    "bg-destructive/10",
    title: "You don't know what you qualify for",
    body:  "With 30+ state and federal programs, each with different income limits and rules, most people have no idea which benefits they're entitled to.",
    delay: 0,
  },
  {
    icon:  <ClipboardList className="h-6 w-6 text-warning" />,
    bg:    "bg-warning/10",
    title: "Every program has separate paperwork",
    body:  "Applying for MassHealth, SNAP, and LIHEAP separately means filling out the same information three times, on three different websites.",
    delay: 150,
  },
  {
    icon:  <AlertCircle className="h-6 w-6 text-accent" />,
    bg:    "bg-accent/10",
    title: "Benefits slip through the cracks",
    body:  "The average Massachusetts family misses $4,800/year in unclaimed benefits — not because they don't qualify, but because they never knew to apply.",
    delay: 300,
  },
]

// ── Why Choose Us ─────────────────────────────────────────────────────────────

export const FEATURE_ITEMS: FeatureItem[] = [
  { icon: <Sparkles />, color: "text-primary", bg: "bg-primary/10", title: "AI Eligibility Engine",  body: "Cross-check your profile against 9+ state and federal programs in seconds — no paperwork required.", delay: 0   },
  { icon: <Layers />,   color: "text-accent",  bg: "bg-accent/10",  title: "Benefit Stacking",       body: "Most programs can be combined. We show every program you qualify for, not just one — maximizing your total benefit.", delay: 100 },
  { icon: <FileCheck />,color: "text-success", bg: "bg-success/10", title: "Guided Applications",    body: "Step-by-step walkthroughs with plain-language explanations, document checklists, and real-time validation.", delay: 200 },
  { icon: <Bot />,      color: "text-primary", bg: "bg-primary/10", title: "AI Chat Assistant",      body: "Ask questions any time. Our MassHealth assistant explains programs, deadlines, and next steps in plain language.", delay: 300 },
  { icon: <Globe />,    color: "text-accent",  bg: "bg-accent/10",  title: "6 Languages",            body: "Full support for English, 简体中文, Español, Português, Kreyòl ayisyen, and Tiếng Việt.", delay: 400 },
  { icon: <Lock />,     color: "text-success", bg: "bg-success/10", title: "Private & Secure",       body: "Your data is encrypted end-to-end and never sold. You control what you share and with whom.", delay: 500 },
  { icon: <Scale />,    color: "text-accent",  bg: "bg-accent/10",  title: "Appeal Assistance",      body: "Denied? Our AI helps you draft appeal letters, prep for hearings, and track deadlines — turning a 'no' into a 'yes'.", delay: 600, isNew: true },
  { icon: <Users />,    color: "text-primary", bg: "bg-primary/10", title: "Live Social Worker Chat", body: "Connect directly with a licensed social worker via real-time messaging, screen sharing, and secure voice notes.", delay: 700, isNew: true },
  { icon: <Mic />,      color: "text-accent",  bg: "bg-accent/10",  title: "Voice Messaging",         body: "Send voice messages to your social worker — automatically transcribed on delivery so nothing gets lost in translation.", delay: 800, isNew: true },
  { icon: <Languages />,color: "text-success", bg: "bg-success/10", title: "Auto-Translation",        body: "Speak in any language. Voice messages are instantly transcribed and translated to English using AI — no interpreter needed.", delay: 900, isNew: true },
]

// ── Stats ─────────────────────────────────────────────────────────────────────

export const STATS_CONFIG: StatConfig[] = [
  { target: 9,    suffix: "+",    prefix: "",  label: "Benefit programs checked"    },
  { target: 6,    suffix: "",     prefix: "",  label: "Languages supported"          },
  { target: 15,   suffix: " min", prefix: "~", label: "Average time to apply"        },
  { target: 2400, suffix: "/mo",  prefix: "$", label: "Max combined monthly benefit", duration: 2200 },
]

// ── Live Assistance ───────────────────────────────────────────────────────────

export const LIVE_ASSISTANCE_CHECKLIST: string[] = [
  "Real-time direct messaging with your assigned social worker",
  "Voice messages with automatic AI transcription on delivery",
  "Instant auto-translation — speak any language, read in English",
  "Screen sharing for guided, step-by-step application walkthroughs",
  "Secure in-chat file and image sharing",
]

export const LIVE_ASSISTANCE_CARDS = [
  { icon: <MessageCircle className="h-5 w-5" />, color: "text-primary",  bg: "bg-primary/10",  title: "Direct Messaging",  body: "Secure, real-time chat between patients and social workers — no phone tag, no wait rooms." },
  { icon: <Mic className="h-5 w-5" />,           color: "text-accent",   bg: "bg-accent/10",   title: "Voice Notes",        body: "Record and send voice messages — automatically transcribed so the other side can read or listen." },
  { icon: <Languages className="h-5 w-5" />,     color: "text-success",  bg: "bg-success/10",  title: "Auto-Translation",   body: "Whisper detects the language; Ollama translates to English — instantly, without a human interpreter." },
  { icon: <Monitor className="h-5 w-5" />,       color: "text-warning",  bg: "bg-warning/10",  title: "Screen Sharing",     body: "Social workers can share their screen to walk patients through complex forms in real time." },
]

// ── Appeal Assistance ─────────────────────────────────────────────────────────

export const APPEAL_CHECKLIST: string[] = [
  "Plain-language explanation of your denial reason",
  "Personalized appeal letter drafting",
  "Document checklist for your hearing",
  "Deadline tracking so you never miss a filing window",
]

export const APPEAL_CARDS: AppealCard[] = [
  { icon: <Scale className="h-5 w-5" />,       color: "text-accent",   bg: "bg-accent/10",   title: "Know Your Rights",    body: "Understand exactly why you were denied and what grounds you can appeal on." },
  { icon: <FileCheck className="h-5 w-5" />,   color: "text-primary",  bg: "bg-primary/10",  title: "AI-Drafted Letters",  body: "Generate a compelling, personalized appeal letter in minutes." },
  { icon: <ClipboardList className="h-5 w-5" />, color: "text-success", bg: "bg-success/10", title: "Hearing Prep",        body: "Get a tailored checklist of documents and tips for your fair hearing." },
  { icon: <Zap className="h-5 w-5" />,         color: "text-warning",  bg: "bg-warning/10",  title: "Deadline Alerts",     body: "You have 30 days to appeal. We track it and remind you before time runs out." },
]

// ── Testimonials ──────────────────────────────────────────────────────────────

export const TESTIMONIALS: Testimonial[] = [
  { quote: "I had no idea I qualified for SNAP on top of MassHealth. HealthCompass MA found $600/month I was leaving on the table.", name: "Maria S.", location: "Worcester, MA", delay: 0   },
  { quote: "The step-by-step guidance made the whole process so much less intimidating. I finished everything in under 20 minutes.",   name: "James T.", location: "Boston, MA",    delay: 150 },
  { quote: "As a social worker, I recommend this to every client. It surfaces programs I wouldn't have thought to check.",             name: "Priya K.", location: "Springfield, MA", delay: 300 },
]

// ── Footer ────────────────────────────────────────────────────────────────────

export const FOOTER_PROGRAMS: FooterLink[] = [
  { label: "MassHealth",            href: "#" },
  { label: "SNAP / Food Assistance", href: "#" },
  { label: "EITC Tax Credits",      href: "#" },
  { label: "LIHEAP Energy Aid",     href: "#" },
]

export const FOOTER_PLATFORM: FooterLink[] = [
  { label: "Eligibility Checker",  href: "/prescreener"     },
  { label: "Benefit Stack Tool",   href: "/benefit-stack"   },
  { label: "Live Assistance",      href: "/auth/register"   },
  { label: "Appeal Assistance",    href: "/auth/register"   },
  { label: "Knowledge Center",     href: "/knowledge-center" },
  { label: "Create Account",       href: "/auth/register"   },
]
