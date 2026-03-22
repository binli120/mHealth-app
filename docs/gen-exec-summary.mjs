import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, HeadingLevel, LevelFormat, ExternalHyperlink,
  TabStopType, TabStopPosition
} from "docx";
import { writeFileSync } from "fs";

// ── Brand colors ──────────────────────────────────────────────────────────────
const NAVY   = "1A3A5C";   // primary dark blue
const TEAL   = "0D7B6E";   // accent teal / green
const STEEL  = "3A7FC1";   // mid-blue for highlights
const LIGHT  = "EAF3FB";   // very light blue fill
const GRAY   = "F4F6F8";   // neutral section bg
const DGRAY  = "555E6B";   // body text gray
const WHITE  = "FFFFFF";
const RULE   = "C8D8E8";   // divider line color

// ── Helper: horizontal rule via paragraph border ──────────────────────────────
const hr = (color = RULE, space = 1, size = 6) =>
  new Paragraph({
    spacing: { before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size, color, space } },
    children: [],
  });

// ── Helper: spacer paragraph ──────────────────────────────────────────────────
const sp = (pt = 80) =>
  new Paragraph({ spacing: { before: 0, after: pt }, children: [] });

// ── Helper: section title ─────────────────────────────────────────────────────
const sectionTitle = (text, color = NAVY) =>
  new Paragraph({
    spacing: { before: 260, after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color })],
  });

// ── Helper: body paragraph ────────────────────────────────────────────────────
const body = (text, opts = {}) =>
  new Paragraph({
    spacing: { before: 60, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: DGRAY, ...opts })],
  });

// ── Helper: bullet ────────────────────────────────────────────────────────────
const bullet = (text, bold = false) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: DGRAY, bold })],
  });

// ── Helper: KPI card row (2-col table used as card grid) ─────────────────────
const kpiRow = (items) => {
  // items: [{label, value, sub}]
  const cells = items.map(({ label, value, sub }) => {
    const brd = { style: BorderStyle.NONE, size: 0, color: WHITE };
    return new TableCell({
      borders: { top: brd, bottom: brd, left: brd, right: brd },
      width: { size: 4680, type: WidthType.DXA },
      shading: { fill: LIGHT, type: ShadingType.CLEAR },
      margins: { top: 160, bottom: 160, left: 200, right: 200 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 40 },
          children: [new TextRun({ text: value, font: "Arial", size: 52, bold: true, color: NAVY })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 20 },
          children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: STEEL })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: sub, font: "Arial", size: 16, color: DGRAY, italics: true })],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [new TableRow({ children: cells })],
  });
};

// ── Helper: 2-col feature table ───────────────────────────────────────────────
const featureTable = (rows) => {
  const brd  = { style: BorderStyle.SINGLE, size: 1, color: RULE };
  const borders = { top: brd, bottom: brd, left: brd, right: brd };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders, width: { size: 4000, type: WidthType.DXA },
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: "Feature", font: "Arial", size: 20, bold: true, color: WHITE })] })],
      }),
      new TableCell({
        borders, width: { size: 5360, type: WidthType.DXA },
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: "Description", font: "Arial", size: 20, bold: true, color: WHITE })] })],
      }),
    ],
  });

  const dataRows = rows.map(([feat, desc], i) => new TableRow({
    children: [
      new TableCell({
        borders, width: { size: 4000, type: WidthType.DXA },
        shading: { fill: i % 2 === 0 ? GRAY : WHITE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: feat, font: "Arial", size: 20, bold: true, color: NAVY })] })],
      }),
      new TableCell({
        borders, width: { size: 5360, type: WidthType.DXA },
        shading: { fill: i % 2 === 0 ? GRAY : WHITE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: desc, font: "Arial", size: 20, color: DGRAY })] })],
      }),
    ],
  }));

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4000, 5360],
    rows: [headerRow, ...dataRows],
  });
};

// ── Helper: program badge row ─────────────────────────────────────────────────
const programBadgeTable = (programs) => {
  // 3-column grid
  const colW = 3120;
  const brd  = { style: BorderStyle.NONE, size: 0, color: WHITE };
  const rows = [];
  for (let i = 0; i < programs.length; i += 3) {
    const slice = programs.slice(i, i + 3);
    while (slice.length < 3) slice.push(null);
    rows.push(new TableRow({
      children: slice.map((p) =>
        new TableCell({
          borders: { top: brd, bottom: brd, left: brd, right: brd },
          width: { size: colW, type: WidthType.DXA },
          shading: { fill: p ? TEAL : WHITE, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: p
            ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p, font: "Arial", size: 18, bold: true, color: WHITE })] })]
            : [new Paragraph({ children: [] })],
        })
      ),
    }));
  }
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [colW, colW, colW],
    rows,
  });
};

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 280 } } },
        }],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 21, color: DGRAY } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: STEEL, space: 1 } },
            spacing: { before: 0, after: 100 },
            children: [
              new TextRun({ text: "HealthCompass MA", font: "Arial", size: 18, bold: true, color: NAVY }),
              new TextRun({ text: "\tExecutive Summary — Investor Briefing  |  March 2026", font: "Arial", size: 16, color: DGRAY }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 1 } },
            spacing: { before: 80, after: 0 },
            children: [
              new TextRun({ text: "Confidential — Not for Distribution", font: "Arial", size: 16, color: DGRAY, italics: true }),
              new TextRun({ text: "\tPage ", font: "Arial", size: 16, color: DGRAY }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: DGRAY }),
            ],
          }),
        ],
      }),
    },
    children: [

      // ── COVER BLOCK ─────────────────────────────────────────────────────────
      new Table({
        width: { size: 10080, type: WidthType.DXA },
        columnWidths: [10080],
        rows: [new TableRow({
          children: [new TableCell({
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 12, color: TEAL },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL },
              left:   { style: BorderStyle.NONE,   size: 0,  color: WHITE },
              right:  { style: BorderStyle.NONE,   size: 0,  color: WHITE },
            },
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 400, bottom: 400, left: 480, right: 480 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "HealthCompass MA", font: "Arial", size: 64, bold: true, color: WHITE })],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 120 },
                children: [new TextRun({ text: "AI-Powered Public Benefits Navigation Platform", font: "Arial", size: 28, color: "9ECFF4", italics: true })],
              }),
              hr(TEAL, 2, 8),
              sp(60),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 60, after: 0 },
                children: [new TextRun({ text: "Executive Summary  —  Investor Briefing", font: "Arial", size: 22, color: "C8E6F8", bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: "March 2026  |  Confidential", font: "Arial", size: 19, color: "8BBDD9" })],
              }),
            ],
          })],
        })],
      }),

      sp(200),

      // ── 01 MISSION ─────────────────────────────────────────────────────────
      sectionTitle("01  Mission & Problem"),
      hr(),

      body(
        "Massachusetts offers more than a dozen overlapping public benefit programs — " +
        "MassHealth, SNAP, WIC, LIHEAP, Section 8, EITC, and others — yet the majority of " +
        "eligible residents never receive the full stack of benefits they qualify for. " +
        "Applications are siloed, eligibility rules are opaque, and the process demands " +
        "time and document literacy that many families simply do not have."
      ),
      sp(40),
      body("HealthCompass MA solves this with a single, conversational AI platform that:", { bold: false }),
      bullet("Instantly screens eligibility across all major Massachusetts programs"),
      bullet("Guides applicants through an AI-assisted, voice-enabled application workflow"),
      bullet("Automatically orchestrates the optimal benefit stack for each family profile"),
      bullet("Keeps applicants informed via a real-time, multi-channel notification system"),

      sp(160),

      // ── 02 PRODUCT ─────────────────────────────────────────────────────────
      sectionTitle("02  Product — Live Features"),
      hr(),

      featureTable([
        [
          "Eligibility Pre-Screener",
          "Rule-based, instant eligibility check across all MassHealth tracks. No LLM latency — pure deterministic engine. Results in under 2 seconds.",
        ],
        [
          "Benefit Stack Orchestrator",
          "Evaluates 9 federal and state programs simultaneously (MassHealth, MSP, SNAP, EITC, Section 8, Child Care, LIHEAP, WIC, TAFDC, EAEDC) and produces an optimized, ranked benefit bundle tailored to the household's income, size, and residency.",
        ],
        [
          "AI Application Assistant",
          "Chat-guided form completion with voice input, live progress sidebar, and RAG-powered Q&A. The LLM extracts structured fields from natural language, validates addresses in real-time, and prompts for inline document uploads at the right moment.",
        ],
        [
          "Notification Pipeline",
          "Full end-to-end notification system: database events → Resend transactional email + in-app notification feed → Redux state → real-time bell indicator and inbox UI.",
        ],
        [
          "Customer Dashboard",
          "Unified landing experience with quick-access cards to all four workflows, application status tracking, and benefit stack summary.",
        ],
      ]),

      sp(160),

      // ── 03 PROGRAMS ────────────────────────────────────────────────────────
      sectionTitle("03  Programs Covered"),
      hr(),

      body("HealthCompass MA evaluates eligibility for all major Massachusetts benefit programs:"),
      sp(80),

      programBadgeTable([
        "MassHealth", "Medicare Savings (MSP)", "SNAP",
        "EITC", "Section 8 / HCV", "Child Care (CCFA)",
        "LIHEAP", "WIC", "TAFDC",
        "EAEDC",
      ]),

      sp(120),
      body(
        "Benefit amounts use FY2026 program constants: $15,060 FPL base (1-person, +$5,380/additional), " +
        "Boston AMI $141,300, and MA SMI $109,615 for a family of four. Rules are updated annually " +
        "and maintained in a centralized eligibility engine."
      ),

      sp(160),

      // ── 04 KPIs ─────────────────────────────────────────────────────────────
      sectionTitle("04  Traction & Key Metrics"),
      hr(),
      sp(80),

      kpiRow([
        { value: "9",   label: "Benefit Programs",  sub: "Evaluated simultaneously" },
        { value: "4",   label: "Core Features",     sub: "Live in production" },
      ]),
      sp(80),
      kpiRow([
        { value: "<2s", label: "Pre-screener Speed", sub: "No-LLM rule engine" },
        { value: "AI",  label: "Voice + Chat Input", sub: "RAG-powered Q&A" },
      ]),

      sp(160),

      // ── 05 TECHNOLOGY ──────────────────────────────────────────────────────
      sectionTitle("05  Technology Architecture"),
      hr(),

      featureTable([
        ["Frontend",     "Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI — server-first architecture with targeted client components."],
        ["AI Layer",     "Ollama / llama3.2 for conversational chat. Rule-based eligibility engine for deterministic screening. RAG pipeline for mid-application Q&A."],
        ["State",        "Redux Toolkit with feature-sliced architecture (notifications, benefit orchestration, active application, auth)."],
        ["Database",     "Supabase PostgreSQL with Row-Level Security (RLS). Raw SQL via pg Pool for performance-critical queries. Schema covers applicants, benefit profiles, notifications, and draft applications."],
        ["Email",        "Resend transactional email with React Email templates integrated into the notification pipeline."],
        ["Security",     "RLS functions (can_access_applicant, is_staff), requireAuthenticatedUser middleware pattern across all API routes, session-based auth via Supabase."],
        ["Infrastructure", "pnpm monorepo, Node.js v20 LTS, designed for Vercel edge deployment."],
      ]),

      sp(160),

      // ── 06 MARKET ──────────────────────────────────────────────────────────
      sectionTitle("06  Market Opportunity"),
      hr(),

      body(
        "Massachusetts has ~6.9 million residents. An estimated 1 in 4 households is eligible " +
        "for at least one public benefit program and does not receive it — a participation gap " +
        "that HealthCompass MA directly addresses."
      ),
      sp(40),
      bullet("~$3B in unclaimed Massachusetts benefit value annually (estimated)"),
      bullet("State and federal government agencies increasingly fund digital navigation tools"),
      bullet("Health plans, ACOs, and community health centers are active payers for social determinants (SDOH) platforms"),
      bullet("Medicaid managed care organizations (MCOs) face financial incentives to close coverage gaps"),

      sp(160),

      // ── 07 BUSINESS MODEL ──────────────────────────────────────────────────
      sectionTitle("07  Business Model"),
      hr(),

      featureTable([
        ["B2G — Agency SaaS",      "License to MassHealth, DTA, and other state agencies replacing paper-based intake workflows."],
        ["B2B — Health Plan API",  "Per-member-per-month API access for MCOs and ACOs to embed benefit navigation inside member portals."],
        ["B2B — CHC / Navigator",  "White-label deployment for Community Health Centers and Certified Application Counselors (CACs)."],
        ["Grant / Value-Based",    "CMMI and state innovation grants targeting Medicaid re-enrollment and benefits uptake improvement."],
      ]),

      sp(160),

      // ── 08 ROADMAP ─────────────────────────────────────────────────────────
      sectionTitle("08  Roadmap"),
      hr(),

      featureTable([
        ["Q2 2026 — Document AI",       "Automated document classification and extraction (pay stubs, ID, birth certificates) to complete the application pipeline end-to-end."],
        ["Q2 2026 — Re-enrollment",     "Proactive eligibility monitoring with automated renewal reminders tied to Supabase scheduled functions."],
        ["Q3 2026 — Multi-language",    "Spanish, Portuguese, Haitian Creole — MA's top three non-English populations — using LLM translation with locale-aware form rendering."],
        ["Q3 2026 — Provider Portal",   "Staff-facing dashboard for case workers with bulk action, override, and audit trail capabilities."],
        ["Q4 2026 — Statewide Expand",  "Expand benefit evaluators to cover federal programs (SSI, Medicare Part D LIS) and remaining MA-specific programs (Emergency Aid, HomeBASE)."],
        ["2027 — National Scale",       "Configurable state-by-state eligibility engine — same platform, pluggable rule packs for any US state."],
      ]),

      sp(160),

      // ── 09 ASK ─────────────────────────────────────────────────────────────
      sectionTitle("09  The Ask"),
      hr(),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
          children: [new TableCell({
            borders: {
              top:    { style: BorderStyle.SINGLE, size: 8, color: TEAL },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
              left:   { style: BorderStyle.SINGLE, size: 8, color: TEAL },
              right:  { style: BorderStyle.NONE,   size: 0, color: WHITE },
            },
            shading: { fill: LIGHT, type: ShadingType.CLEAR },
            margins: { top: 240, bottom: 240, left: 320, right: 320 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 100 },
                children: [new TextRun({ text: "Seed Round — $1.5M", font: "Arial", size: 40, bold: true, color: NAVY })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 120 },
                children: [new TextRun({ text: "18-month runway to first government contract and 10,000 active users", font: "Arial", size: 22, color: TEAL, italics: true })],
              }),
              bullet("40%  —  Engineering: Document AI, multi-language, re-enrollment engine"),
              bullet("30%  —  Go-to-Market: Agency pilots, CHC partnerships, grant writing"),
              bullet("20%  —  Infrastructure & Compliance: HIPAA BAA, SOC 2 Type II"),
              bullet("10%  —  Operations & Legal"),
            ],
          })],
        })],
      }),

      sp(160),

      // ── 10 TEAM / CONTACT ───────────────────────────────────────────────────
      sectionTitle("10  Team & Contact"),
      hr(),

      body("HealthCompass MA is built by a team with deep experience in healthcare policy, product engineering, and Massachusetts public programs."),
      sp(60),
      body("For partnership and investment inquiries:", { bold: true }),
      body("contact@healthcompassma.com  |  healthcompassma.com", { color: STEEL }),
      sp(60),
      new Paragraph({
        spacing: { before: 60, after: 0 },
        children: [
          new TextRun({ text: "© 2026 HealthCompass MA  —  ", font: "Arial", size: 18, color: DGRAY, italics: true }),
          new TextRun({ text: "Confidential & Proprietary. Not for distribution without written consent.", font: "Arial", size: 18, color: DGRAY, italics: true }),
        ],
      }),
    ],
  }],
});

// ── Write file ────────────────────────────────────────────────────────────────
const outPath = "docs/HealthCompassMA_Executive_Summary_2026.docx";
Packer.toBuffer(doc).then((buf) => {
  writeFileSync(outPath, buf);
  console.log(`✅  Written → ${outPath}`);
});
