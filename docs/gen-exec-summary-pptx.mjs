import pptxgen from "pptxgenjs";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Codex";
pptx.company = "HealthCompass MA";
pptx.subject = "Executive summary investor deck refresh";
pptx.title = "HealthCompass MA Investor Deck";

const OUT_PATH = "docs/HealthCompassMA_Investor_Deck.pptx";

const C = {
  navy: "10263F",
  ink: "1D3557",
  teal: "137C71",
  aqua: "5DB7DE",
  coral: "E8825E",
  gold: "F2C14E",
  mint: "DFF5F1",
  sky: "E9F5FB",
  sand: "F7F2EA",
  panel: "FFFDFC",
  slate: "556677",
  text: "233142",
  white: "FFFFFF",
  line: "D9E3EA",
  soft: "EEF4F7",
  danger: "C7605A",
};

const FONT_HEAD = "Aptos Display";
const FONT_BODY = "Aptos";
const SW = 13.333;
const SH = 7.5;

function addBg(slide, mode = "light") {
  if (mode === "dark") {
    slide.background = { color: C.navy };
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.9, y: -0.6, w: 4.2, h: 3.8,
      fill: { color: C.teal, transparency: 82 },
      line: { color: C.teal, transparency: 100 },
      rotate: 16,
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: -0.8, y: 5.7, w: 3.4, h: 2.4,
      fill: { color: C.coral, transparency: 80 },
      line: { color: C.coral, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.6, y: 1.1, w: 12.1, h: 0,
      line: { color: C.aqua, transparency: 60, width: 1.4 },
    });
    return;
  }

  slide.background = { color: C.sand };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SW, h: 0.18,
    fill: { color: C.teal },
    line: { color: C.teal },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 10.4, y: -0.7, w: 3.2, h: 2.2,
    fill: { color: C.sky, transparency: 35 },
    line: { color: C.sky, transparency: 100 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: -0.8, y: 5.7, w: 2.6, h: 1.9,
    fill: { color: C.mint, transparency: 30 },
    line: { color: C.mint, transparency: 100 },
  });
}

function addFooter(slide, dark = false) {
  slide.addText("HealthCompass MA  |  Executive Summary  |  April 2026", {
    x: 0.6, y: 7.06, w: 5.4, h: 0.18,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 9.5,
    color: dark ? "C7D6E5" : C.slate,
  });
  slide.addText("Confidential", {
    x: 11.45, y: 7.06, w: 1.2, h: 0.18,
    margin: 0,
    align: "right",
    fontFace: FONT_BODY,
    fontSize: 9.5,
    color: dark ? "C7D6E5" : C.slate,
  });
}

function addTitle(slide, eyebrow, title, subtitle, opts = {}) {
  const dark = opts.dark ?? false;
  slide.addText(eyebrow, {
    x: 0.7, y: 0.48, w: 3.8, h: 0.22,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 10.5,
    bold: true,
    color: dark ? "9FDDF1" : C.teal,
    charSpace: 1.2,
    textTransform: "uppercase",
  });
  slide.addText(title, {
    x: 0.7, y: 0.82, w: opts.titleW ?? 7.6, h: opts.titleH ?? 0.78,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: opts.titleSize ?? 24,
    bold: true,
    color: dark ? C.white : C.ink,
    breakLine: false,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.72, y: 1.62, w: opts.subW ?? 7.2, h: opts.subH ?? 0.56,
      margin: 0,
      fontFace: FONT_BODY,
      fontSize: opts.subSize ?? 11.5,
      color: dark ? "D5E4F2" : C.slate,
    });
  }
}

function addPill(slide, text, x, y, w, fill, textColor = C.ink) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.34,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(text, {
    x: x + 0.1, y: y + 0.04, w: w - 0.2, h: 0.18,
    margin: 0,
    align: "center",
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    color: textColor,
  });
}

function addCard(slide, {
  x, y, w, h, title, body, tone = "light", titleSize = 15, bodySize = 10.5, accent,
}) {
  const fill = tone === "dark" ? "17304B" : C.panel;
  const line = tone === "dark" ? "35516A" : C.line;
  const titleColor = tone === "dark" ? C.white : C.ink;
  const bodyColor = tone === "dark" ? "D9E5F0" : C.slate;

  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: line, width: 1.1 },
    shadow: tone === "light"
      ? { type: "outer", color: "B7C8D5", blur: 1, angle: 45, distance: 1, opacity: 0.12 }
      : undefined,
  });

  if (accent) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.18, y: y + 0.18, w: 0.18, h: h - 0.36,
      rectRadius: 0.08,
      fill: { color: accent },
      line: { color: accent },
    });
  }

  slide.addText(title, {
    x: x + (accent ? 0.48 : 0.24),
    y: y + 0.18,
    w: w - (accent ? 0.66 : 0.4),
    h: 0.3,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: titleSize,
    bold: true,
    color: titleColor,
  });

  slide.addText(body, {
    x: x + (accent ? 0.48 : 0.24),
    y: y + 0.56,
    w: w - (accent ? 0.66 : 0.4),
    h: h - 0.76,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: bodySize,
    color: bodyColor,
    valign: "top",
  });
}

function addBulletList(slide, items, x, y, w, opts = {}) {
  const gap = opts.gap ?? 0.4;
  const bulletColor = opts.bulletColor ?? C.teal;
  const textColor = opts.textColor ?? C.text;
  const fontSize = opts.fontSize ?? 11;
  items.forEach((item, index) => {
    const rowY = y + index * gap;
    slide.addShape(pptx.ShapeType.ellipse, {
      x, y: rowY + 0.07, w: 0.11, h: 0.11,
      fill: { color: bulletColor },
      line: { color: bulletColor },
    });
    slide.addText(item, {
      x: x + 0.18, y: rowY, w: w - 0.18, h: 0.26,
      margin: 0,
      fontFace: FONT_BODY,
      fontSize,
      color: textColor,
    });
  });
}

function addMetricCard(slide, x, y, w, h, value, label, note, fill = C.sky) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(value, {
    x: x + 0.18, y: y + 0.12, w: w - 0.36, h: 0.34,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: 24,
    bold: true,
    color: C.ink,
    align: "center",
  });
  slide.addText(label, {
    x: x + 0.18, y: y + 0.52, w: w - 0.36, h: 0.18,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    color: C.teal,
    align: "center",
  });
  slide.addText(note, {
    x: x + 0.18, y: y + 0.74, w: w - 0.36, h: 0.22,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 8.8,
    color: C.slate,
    align: "center",
  });
}

function addStage(slide, x, y, w, label, title, body, fill, darkText = false) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 1.6,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(label, {
    x: x + 0.16, y: y + 0.14, w: w - 0.32, h: 0.18,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 9.5,
    bold: true,
    color: darkText ? C.teal : C.white,
    charSpace: 1.1,
  });
  slide.addText(title, {
    x: x + 0.16, y: y + 0.4, w: w - 0.32, h: 0.3,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: 16,
    bold: true,
    color: darkText ? C.ink : C.white,
  });
  slide.addText(body, {
    x: x + 0.16, y: y + 0.78, w: w - 0.32, h: 0.62,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 9.6,
    color: darkText ? C.slate : "DCE8F2",
  });
}

// Slide 1
{
  const slide = pptx.addSlide();
  addBg(slide, "dark");

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.72, y: 0.74, w: 0.84, h: 0.5,
    rectRadius: 0.08,
    fill: { color: C.teal },
    line: { color: C.teal },
  });
  slide.addText("HC", {
    x: 0.9, y: 0.87, w: 0.46, h: 0.18,
    margin: 0,
    align: "center",
    fontFace: FONT_HEAD,
    fontSize: 16,
    bold: true,
    color: C.white,
  });

  slide.addText("HealthCompass MA", {
    x: 0.72, y: 1.42, w: 6.2, h: 0.5,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: 28,
    bold: true,
    color: C.white,
  });
  slide.addText("Executive Summary  |  AI Infrastructure for Benefits Access", {
    x: 0.74, y: 1.97, w: 6.8, h: 0.28,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 13,
    color: "A8D7EA",
  });
  slide.addText(
    "Turning fragmented public-benefits intake into a guided, multilingual, AI-supported care navigation system for patients, social workers, and facilities.",
    {
      x: 0.74, y: 2.55, w: 6.35, h: 1.18,
      margin: 0,
      fontFace: FONT_BODY,
      fontSize: 18,
      bold: true,
      color: "EDF5FB",
      valign: "mid",
    },
  );

  addPill(slide, "10-program orchestration", 0.76, 4.08, 1.92, "E3FAF6", C.teal);
  addPill(slide, "6 supported languages", 2.84, 4.08, 1.7, "EAF5FC", C.ink);
  addPill(slide, "Local AI + policy RAG", 4.68, 4.08, 1.72, "FFF3D2", C.ink);

  slide.addText(
    "Focus of this refresh\n• technical secret sauce and defensibility\n• patient and facility impact\n• language, disability, and application support\n• future blueprint",
    {
      x: 0.76, y: 4.65, w: 4.8, h: 1.46,
      margin: 0,
      fontFace: FONT_BODY,
      fontSize: 12.2,
      color: "D3E2EF",
    },
  );

  addMetricCard(slide, 8.02, 1.38, 2.05, 1.18, "10", "Programs evaluated", "MassHealth + cross-program stack", "DFF5F1");
  addMetricCard(slide, 10.28, 1.38, 2.05, 1.18, "6", "Languages live", "English, Chinese, Haitian Creole, Portuguese, Spanish, Vietnamese", "E9F5FB");
  addMetricCard(slide, 8.02, 2.82, 2.05, 1.18, "4", "AI support modes", "Advisor, intake, form assist, appeal", "FFF3D2");
  addMetricCard(slide, 10.28, 2.82, 2.05, 1.18, "24/7", "Guided help", "Chat, notifications, social-worker collaboration", "FDE9E2");

  addCard(slide, {
    x: 7.92, y: 4.4, w: 4.42, h: 1.48,
    title: "What changed since the older deck",
    body:
      "The platform now extends beyond screening into application assistance, appeal support, multilingual communication, reviewer workflows, notifications, and direct patient-to-social-worker collaboration.",
    tone: "dark",
    accent: C.coral,
  });

  addFooter(slide, true);
}

// Slide 2
{
  const slide = pptx.addSlide();
  addBg(slide, "light");
  addTitle(
    slide,
    "PLATFORM TODAY",
    "HealthCompass MA is now a workflow system, not just a screener",
    "The live product combines deterministic eligibility, AI support, document handling, messaging, and staff operations in one stack.",
    { titleW: 8.2, subW: 7.7 },
  );

  addCard(slide, {
    x: 0.72, y: 2.2, w: 2.8, h: 1.5,
    title: "1. Discover",
    body: "Deterministic pre-screener plus benefit orchestration across 10 Massachusetts and federal programs with household/FPL logic.",
    accent: C.teal,
  });
  addCard(slide, {
    x: 3.72, y: 2.2, w: 2.8, h: 1.5,
    title: "2. Apply",
    body: "MassHealth flows, ACA-3-AP rules, document uploads, form guidance, eligibility findings, and required-document tracking.",
    accent: C.aqua,
  });
  addCard(slide, {
    x: 0.72, y: 3.95, w: 2.8, h: 1.5,
    title: "3. Support",
    body: "Benefit advisor chat, form assistant, appeal assistant, knowledge-center content, multilingual guidance, and notifications.",
    accent: C.gold,
  });
  addCard(slide, {
    x: 3.72, y: 3.95, w: 2.8, h: 1.5,
    title: "4. Coordinate",
    body: "Social-worker messaging, voice-note transcription, translation, screen-share sessions, reviewer portal, cases, audit, and reports.",
    accent: C.coral,
  });

  addCard(slide, {
    x: 7.0, y: 2.2, w: 5.58, h: 3.42,
    title: "Core live capabilities grounded in the repo",
    body:
      "• Deterministic rule engines for MassHealth screening and ACA-3-AP case additions\n" +
      "• Cross-program orchestrator for MassHealth, MSP, SNAP, EITC, Section 8, Child Care, LIHEAP, WIC, TAFDC, and EAEDC\n" +
      "• Policy RAG on pgvector for task-specific prompts\n" +
      "• Appeal analysis with structured JSON output and document extraction\n" +
      "• Patient dashboard, profile, notifications, document storage, and case status views\n" +
      "• Social-worker and reviewer operating surfaces",
    accent: C.teal,
    bodySize: 10.2,
  });

  addPill(slide, "Deterministic where decisions matter", 7.02, 5.86, 2.34, "DFF5F1", C.teal);
  addPill(slide, "LLM where language and documents matter", 9.52, 5.86, 3.02, "E9F5FB", C.ink);

  addFooter(slide);
}

// Slide 3
{
  const slide = pptx.addSlide();
  addBg(slide, "dark");
  addTitle(
    slide,
    "TECHNOLOGY SECRET SAUCE",
    "A hybrid architecture that separates deterministic decisions from AI support",
    "This is the core design choice that makes the platform trustworthy, extensible, and hard to replicate.",
    { dark: true, titleW: 8.3, subW: 7.7 },
  );

  const chain = [
    ["Plain-language intake", "Users can type or speak naturally instead of navigating policy jargon first."],
    ["Structured extraction", "AI pulls household, income, relationship, and document signals into typed fields."],
    ["Deterministic evaluation", "Rule engines decide eligibility, required documents, and routing using code, not model guesswork."],
    ["Actionable workflow", "Outputs drive applications, notifications, staff review, appeal drafting, and next-step guidance."],
  ];

  chain.forEach(([title, body], index) => {
    const x = 0.72 + index * 3.08;
    addCard(slide, {
      x,
      y: 2.25,
      w: 2.72,
      h: 2.0,
      title,
      body,
      tone: "dark",
      accent: [C.teal, C.aqua, C.gold, C.coral][index],
      bodySize: 9.8,
    });
    if (index < chain.length - 1) {
      slide.addShape(pptx.ShapeType.chevron, {
        x: x + 2.78, y: 2.98, w: 0.22, h: 0.42,
        fill: { color: "6BA6C4" },
        line: { color: "6BA6C4" },
      });
    }
  });

  addCard(slide, {
    x: 0.72, y: 4.65, w: 5.9, h: 1.45,
    title: "Why this architecture matters",
    body:
      "Competitors can copy a chatbot. They cannot easily copy the combined asset: policy-specific rules, benefit-orchestration logic, structured extraction, workflow triggers, and staff tooling all operating on the same user graph.",
    tone: "dark",
    accent: C.teal,
    bodySize: 10.4,
  });
  addCard(slide, {
    x: 6.92, y: 4.65, w: 5.42, h: 1.45,
    title: "System boundary",
    body:
      "LLMs explain, extract, summarize, translate, and draft. Deterministic code decides eligibility, document requirements, routing, and final workflow state.",
    tone: "dark",
    accent: C.gold,
    bodySize: 10.4,
  });

  addFooter(slide, true);
}

// Slide 4
{
  const slide = pptx.addSlide();
  addBg(slide, "light");
  addTitle(
    slide,
    "TECHNICAL BARRIERS, TRAINING, AND AI SUPPORT",
    "The moat is not one model. It is a domain-tuned support system with a learning flywheel.",
    "This is the executive view of prompt design, retrieval strategy, reliability, and future training expansion.",
    { titleW: 8.8, subW: 8.2 },
  );

  addCard(slide, {
    x: 0.72, y: 2.18, w: 3.55, h: 3.92,
    title: "Current technical barriers",
    body:
      "• Massachusetts-specific rule code for screening, household logic, FPL calculations, and document requirements\n" +
      "• Multiple AI modes with narrow prompts instead of a single generic assistant\n" +
      "• Staff workflow surfaces that create durable operational switching costs\n" +
      "• Local/private inference posture for sensitive health and benefits data",
    accent: C.teal,
    bodySize: 10.3,
  });

  addCard(slide, {
    x: 4.5, y: 2.18, w: 2.55, h: 1.58,
    title: "Prompt design",
    body: "Mode-specific prompts for intake, benefit advising, form assistance, and appeals. Structured outputs are validated before the product acts on them.",
    accent: C.aqua,
    bodySize: 9.4,
  });
  addCard(slide, {
    x: 7.18, y: 2.18, w: 2.55, h: 1.58,
    title: "Retrieval strategy",
    body: "Task-specific pgvector retrieval from policy chunks. Queries are derived from denial reason, top program, or current form step, not full chat history.",
    accent: C.gold,
    bodySize: 9.4,
  });
  addCard(slide, {
    x: 9.86, y: 2.18, w: 2.5, h: 1.58,
    title: "Eval signals",
    body: "Parse success, factual grounding, multilingual consistency, extraction precision, reviewer override rate, completion time, and appeal readiness.",
    accent: C.coral,
    bodySize: 9.4,
  });

  addCard(slide, {
    x: 4.5, y: 4.05, w: 7.86, h: 2.05,
    title: "Training and learning flywheel",
    body:
      "Current: curated policy corpus, denial categories, domain prompts, reviewer-facing workflow data, and real multilingual interactions.\n" +
      "Next: benchmark suites for benefits Q&A and extraction, denial-outcome datasets, reviewer feedback loops, document-AI labeling, and fine-tuned or adapter-based models for high-value tasks like appeal generation and document normalization.",
    accent: C.teal,
    bodySize: 10.1,
  });

  addFooter(slide);
}

// Slide 5
{
  const slide = pptx.addSlide();
  addBg(slide, "light");
  addTitle(
    slide,
    "HOW THE TECHNOLOGY HELPS PATIENTS",
    "The patient value is practical: discover more benefits, finish more applications, and recover faster after denials.",
    "Every workflow is designed to lower literacy, language, and process friction.",
    { titleW: 8.2, subW: 7.3 },
  );

  addCard(slide, {
    x: 0.72, y: 2.28, w: 3.88, h: 3.34,
    title: "Find more support",
    body:
      "• One intake can surface MassHealth plus other programs a household may qualify for\n" +
      "• Estimated value and next steps are explained in plain language\n" +
      "• Households see the full stack, not one program at a time",
    accent: C.teal,
    bodySize: 10.8,
  });
  addCard(slide, {
    x: 4.72, y: 2.28, w: 3.88, h: 3.34,
    title: "Finish the application",
    body:
      "• Guided form assistance reduces blank-page paralysis\n" +
      "• Required documents are identified and tracked\n" +
      "• Voice, translation, and reading assistance help users who struggle with writing or typing",
    accent: C.gold,
    bodySize: 10.8,
  });
  addCard(slide, {
    x: 8.72, y: 2.28, w: 3.62, h: 3.34,
    title: "Recover when things go wrong",
    body:
      "• Appeal support drafts arguments and evidence checklists\n" +
      "• Notifications reduce missed deadlines and renewal lapses\n" +
      "• Social-worker collaboration gives patients live help without leaving the platform",
    accent: C.coral,
    bodySize: 10.8,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.72, y: 5.95, w: 11.62, h: 0.66,
    rectRadius: 0.08,
    fill: { color: C.ink },
    line: { color: C.ink },
  });
  slide.addText(
    "Designed for patients with low time, limited English proficiency, low digital confidence, or difficulty writing complex forms on their own.",
    {
      x: 1.02, y: 6.14, w: 11.02, h: 0.2,
      margin: 0,
      align: "center",
      fontFace: FONT_BODY,
      fontSize: 12,
      bold: true,
      color: C.white,
    },
  );

  addFooter(slide);
}

// Slide 6
{
  const slide = pptx.addSlide();
  addBg(slide, "light");
  addTitle(
    slide,
    "HOW THE TECHNOLOGY HELPS FACILITIES AND CARE TEAMS",
    "The platform is also a care-operations product for social workers, reviewers, and partner organizations.",
    "Patient value and facility value are linked: fewer dropped cases, faster clarification, and better visibility.",
    { titleW: 8.6, subW: 7.9 },
  );

  addCard(slide, {
    x: 0.72, y: 2.22, w: 3.82, h: 3.72,
    title: "Care-team coordination",
    body:
      "• Secure direct messaging between patient and social worker\n" +
      "• Voice notes with automatic transcription\n" +
      "• Instant translation to reduce interpreter friction\n" +
      "• Screen-share sessions for guided application walkthroughs",
    accent: C.teal,
    bodySize: 10.6,
  });
  addCard(slide, {
    x: 4.74, y: 2.22, w: 3.82, h: 3.72,
    title: "Operational visibility",
    body:
      "• Reviewer dashboard with pending, RFI, auto-approved, and flagged queues\n" +
      "• Case lists, audit views, reports, and status tracking\n" +
      "• Notifications and workflow triggers across application state changes",
    accent: C.aqua,
    bodySize: 10.6,
  });
  addCard(slide, {
    x: 8.76, y: 2.22, w: 3.58, h: 3.72,
    title: "Facility-level ROI",
    body:
      "• Less repeated intake work\n" +
      "• Faster document follow-up and deadline management\n" +
      "• Better patient engagement outside business hours\n" +
      "• A foundation for provider portals, analytics, and white-label deployments",
    accent: C.coral,
    bodySize: 10.6,
  });

  addFooter(slide);
}

// Slide 7
{
  const slide = pptx.addSlide();
  addBg(slide, "dark");
  addTitle(
    slide,
    "LANGUAGE, ACCESSIBILITY, AND DISABILITY SUPPORT",
    "Built for language, accessibility, and disability needs",
    "For users who do not fit the default assumption of strong English, high literacy, or easy form completion.",
    { dark: true, titleW: 8.2, subW: 7.5, titleSize: 21.5 },
  );

  addCard(slide, {
    x: 0.72, y: 2.26, w: 3.26, h: 3.82,
    title: "Languages live today",
    body:
      "English\n简体中文\nKreyòl ayisyen\nPortuguês, Brasil\nEspañol\nTiếng Việt",
    tone: "dark",
    accent: C.teal,
    titleSize: 16,
    bodySize: 13.2,
  });

  addCard(slide, {
    x: 4.24, y: 2.26, w: 3.86, h: 1.66,
    title: "Accessibility preferences already modeled",
    body: "Reading assistance, translation support, and voice assistant preferences can be saved at the profile level and applied across the app experience.",
    tone: "dark",
    accent: C.aqua,
    bodySize: 10,
  });
  addCard(slide, {
    x: 4.24, y: 4.12, w: 3.86, h: 1.96,
    title: "Support when writing is hard",
    body: "Users can work through guided chat, speak via voice notes, and receive plain-language assistance instead of being forced into dense form fields from the start.",
    tone: "dark",
    accent: C.gold,
    bodySize: 10,
  });
  addCard(slide, {
    x: 8.34, y: 2.26, w: 4.0, h: 3.82,
    title: "Disability-aware application logic",
    body:
      "The platform already captures disability / SSI / SSDI context, routes cases through disability-related rules, and identifies when medical verification or disability supplements are required. That is exactly where software can help people get an application ready instead of failing late in the process.",
    tone: "dark",
    accent: C.coral,
    bodySize: 10.3,
  });

  addFooter(slide, true);
}

// Slide 8
{
  const slide = pptx.addSlide();
  addBg(slide, "light");
  addTitle(
    slide,
    "FUTURE BLUEPRINT",
    "The next phase is about compounding the rule engine with document AI, renewals, provider tooling, and a stronger learning loop.",
    "Each stage increases both user value and the difficulty of replication.",
    { titleW: 8.2, subW: 7.6 },
  );

  addStage(slide, 0.72, 2.35, 2.76, "NOW", "Workflow platform", "Screening, benefit stack, applications, appeals, messaging, notifications, reviewer operations.", C.ink);
  addStage(slide, 3.62, 2.35, 2.76, "NEXT", "Document AI", "Classify paystubs, IDs, and proofs; normalize extracted fields; flag mismatches before submission.", C.teal);
  addStage(slide, 6.52, 2.35, 2.76, "NEXT", "Retention engine", "Renewal automation, proactive deadline reminders, and monitoring for coverage-risk changes.", C.aqua, true);
  addStage(slide, 9.42, 2.35, 2.92, "LATER", "Provider operating system", "Provider portal, staff copilot, analytics, policy learning loops, and state-by-state rule packs.", C.coral);

  slide.addShape(pptx.ShapeType.line, {
    x: 1.1, y: 4.44, w: 10.9, h: 0,
    line: { color: C.line, width: 1.2 },
  });

  addCard(slide, {
    x: 0.72, y: 4.76, w: 3.76, h: 1.22,
    title: "Roadmap priority 1",
    body: "Automate more of the document and renewal burden without moving final eligibility decisions out of deterministic code.",
    accent: C.teal,
    bodySize: 9.8,
  });
  addCard(slide, {
    x: 4.78, y: 4.76, w: 3.76, h: 1.22,
    title: "Roadmap priority 2",
    body: "Turn facility workflows into a stronger moat with collaboration, queueing, audit, and reviewer intelligence.",
    accent: C.aqua,
    bodySize: 9.8,
  });
  addCard(slide, {
    x: 8.84, y: 4.76, w: 3.5, h: 1.22,
    title: "Roadmap priority 3",
    body: "Build the evaluation and training assets needed for more specialized domain models over time.",
    accent: C.coral,
    bodySize: 9.8,
  });

  addFooter(slide);
}

// Slide 9
{
  const slide = pptx.addSlide();
  addBg(slide, "light");
  addTitle(
    slide,
    "WHY THIS IS HARD TO COPY",
    "The defensibility is the combination of domain rules, workflow data, and trusted operational surfaces.",
    "The more the product touches intake, support, and review, the more proprietary the system becomes.",
    { titleW: 7.6, subW: 7.3 },
  );

  addCard(slide, {
    x: 0.72, y: 2.28, w: 2.72, h: 1.86,
    title: "Policy depth",
    body: "Rule code, document requirements, and MassHealth-specific prompts accumulate domain knowledge faster than generic SaaS tooling.",
    accent: C.teal,
    bodySize: 9.8,
  });
  addCard(slide, {
    x: 3.62, y: 2.28, w: 2.72, h: 1.86,
    title: "Workflow graph",
    body: "Patients, documents, messages, deadlines, reviewer actions, and appeals create a richer operating dataset over time.",
    accent: C.aqua,
    bodySize: 9.8,
  });
  addCard(slide, {
    x: 6.52, y: 2.28, w: 2.72, h: 1.86,
    title: "Trust posture",
    body: "Local/private AI, typed outputs, deterministic decisions, and auditable staff workflows matter in high-stakes benefits access.",
    accent: C.gold,
    bodySize: 9.8,
  });
  addCard(slide, {
    x: 9.42, y: 2.28, w: 2.92, h: 1.86,
    title: "Expansion path",
    body: "The architecture can evolve into configurable state rule packs rather than one-off program scripts for every new market.",
    accent: C.coral,
    bodySize: 9.8,
  });

  addCard(slide, {
    x: 0.72, y: 4.52, w: 11.62, h: 1.56,
    title: "Executive takeaway",
    body:
      "HealthCompass MA has the ingredients for a real technology moat: deterministic benefit logic, policy-grounded AI support, multilingual engagement, and facility workflows that produce durable proprietary data. The future blueprint compounds all four.",
    accent: C.ink,
    bodySize: 11.2,
  });

  addFooter(slide);
}

// Slide 10
{
  const slide = pptx.addSlide();
  addBg(slide, "dark");

  slide.addText("HealthCompass MA", {
    x: 0.72, y: 1.05, w: 5.4, h: 0.46,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: 26,
    bold: true,
    color: C.white,
  });
  slide.addText("A more human way to get benefits access right", {
    x: 0.74, y: 1.62, w: 6.0, h: 0.34,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 14,
    color: "A8D7EA",
  });
  slide.addText(
    "The opportunity is to become the operating system for benefits access: trusted by patients, useful to facilities, and increasingly defensible as the workflow and learning system deepens.",
    {
      x: 0.74, y: 2.3, w: 6.2, h: 1.18,
      margin: 0,
      fontFace: FONT_BODY,
      fontSize: 19,
      bold: true,
      color: "EEF6FB",
    },
  );

  addBulletList(slide, [
    "Deterministic decisions with AI support, not AI guesswork",
    "Stronger outcomes for patients who struggle with language, literacy, or forms",
    "Operational leverage for social workers, reviewers, and partner facilities",
    "A credible path to document AI, renewals, provider tooling, and state-scale expansion",
  ], 0.82, 4.18, 6.2, {
    gap: 0.46,
    bulletColor: C.gold,
    textColor: "DDEAF4",
    fontSize: 11.6,
  });

  addCard(slide, {
    x: 8.02, y: 1.45, w: 4.28, h: 3.84,
    title: "Next-phase acceleration",
    body:
      "Document AI\nRenewal automation\nProvider / facility portal\nReviewer intelligence\nPolicy learning loop\nMulti-state rule-pack architecture",
    tone: "dark",
    accent: C.coral,
    titleSize: 17,
    bodySize: 13,
  });

  slide.addText("contact@healthcompassma.com\nhealthcompassma.com", {
    x: 8.08, y: 5.55, w: 3.1, h: 0.5,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 12,
    bold: true,
    color: C.white,
  });

  addFooter(slide, true);
}

await pptx.writeFile({ fileName: OUT_PATH, compression: true });
console.log(`Wrote ${OUT_PATH}`);
