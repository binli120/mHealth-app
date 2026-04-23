import pptxgen from "pptxgenjs";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Codex";
pptx.company = "HealthCompass MA";
pptx.subject = "High-level architecture deck for investors";
pptx.title = "HealthCompass MA Architecture - Investor View";

const OUT_PATH = "docs/HealthCompassMA_Architecture_Investor_Deck.pptx";
const SW = 13.333;
const SH = 7.5;

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
  white: "FFFFFF",
  line: "D9E3EA",
  soft: "EEF4F7",
  darkPanel: "17304B",
};

const FONT_HEAD = "Aptos Display";
const FONT_BODY = "Aptos";

function addBg(slide, mode = "light") {
  slide.background = { color: mode === "dark" ? C.navy : C.sand };
  if (mode === "dark") {
    slide.addShape(pptx.ShapeType.rect, {
      x: 9.75, y: -0.55, w: 4.4, h: 3.2, rotate: 14,
      fill: { color: C.teal, transparency: 78 },
      line: { color: C.teal, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: -0.6, y: 5.75, w: 2.8, h: 1.8,
      fill: { color: C.coral, transparency: 82 },
      line: { color: C.coral, transparency: 100 },
    });
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: SW, h: 0.18,
      fill: { color: C.teal },
      line: { color: C.teal },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 10.65, y: -0.72, w: 3.0, h: 2.0,
      fill: { color: C.sky, transparency: 30 },
      line: { color: C.sky, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: -0.75, y: 5.65, w: 2.3, h: 1.65,
      fill: { color: C.mint, transparency: 25 },
      line: { color: C.mint, transparency: 100 },
    });
  }
}

function addFooter(slide, dark = false) {
  slide.addText("HealthCompass MA | Architecture Investor View | April 2026", {
    x: 0.62, y: 7.06, w: 5.7, h: 0.18,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 9.4,
    color: dark ? "C7D6E5" : C.slate,
  });
  slide.addText("Confidential", {
    x: 11.5, y: 7.06, w: 1.15, h: 0.18,
    margin: 0,
    align: "right",
    fontFace: FONT_BODY,
    fontSize: 9.4,
    color: dark ? "C7D6E5" : C.slate,
  });
}

function addTitle(slide, eyebrow, title, subtitle, opts = {}) {
  const dark = opts.dark ?? false;
  slide.addText(eyebrow, {
    x: 0.7, y: 0.48, w: 4.8, h: 0.22,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 10.5,
    bold: true,
    color: dark ? "9FDDF1" : C.teal,
    charSpace: 1.1,
  });
  slide.addText(title, {
    x: 0.7, y: 0.82, w: opts.titleW ?? 7.7, h: opts.titleH ?? 0.82,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: opts.titleSize ?? 26,
    bold: true,
    color: dark ? C.white : C.ink,
    fit: "shrink",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.72, y: opts.subY ?? 1.68, w: opts.subW ?? 7.35, h: opts.subH ?? 0.58,
      margin: 0,
      fontFace: FONT_BODY,
      fontSize: opts.subSize ?? 11.4,
      color: dark ? "D5E4F2" : C.slate,
      fit: "shrink",
      breakLine: false,
    });
  }
}

function addCard(slide, x, y, w, h, title, body, opts = {}) {
  const fill = opts.dark ? C.darkPanel : C.panel;
  const line = opts.dark ? "36536F" : C.line;
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: line, width: 1 },
    shadow: opts.shadow === false ? undefined : {
      type: "outer",
      color: "B7C8D5",
      blur: 1,
      angle: 45,
      distance: 1,
      opacity: 0.12,
    },
  });
  if (opts.accent) {
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.12, h,
      fill: { color: opts.accent },
      line: { color: opts.accent },
    });
  }
  slide.addText(title, {
    x: x + 0.24, y: y + 0.18, w: w - 0.48, h: 0.34,
    margin: 0,
    fontFace: FONT_HEAD,
    fontSize: opts.titleSize ?? 15,
    bold: true,
    color: opts.dark ? C.white : C.ink,
    fit: "shrink",
  });
  slide.addText(body, {
    x: x + 0.24, y: y + 0.58, w: w - 0.48, h: h - 0.78,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: opts.bodySize ?? 10.3,
    color: opts.dark ? "DCE8F2" : C.slate,
    valign: "top",
    fit: "shrink",
    breakLine: false,
  });
}

function addMetric(slide, x, y, w, value, label, fill = C.sky) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 1.03,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(value, {
    x: x + 0.12, y: y + 0.15, w: w - 0.24, h: 0.34,
    margin: 0,
    align: "center",
    fontFace: FONT_HEAD,
    fontSize: 23,
    bold: true,
    color: C.ink,
    fit: "shrink",
  });
  slide.addText(label, {
    x: x + 0.14, y: y + 0.58, w: w - 0.28, h: 0.28,
    margin: 0,
    align: "center",
    fontFace: FONT_BODY,
    fontSize: 9.1,
    bold: true,
    color: C.teal,
    fit: "shrink",
  });
}

function addNode(slide, x, y, w, h, label, fill, color = C.ink) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(label, {
    x: x + 0.1, y: y + 0.15, w: w - 0.2, h: h - 0.2,
    margin: 0,
    align: "center",
    valign: "mid",
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    color,
    fit: "shrink",
  });
}

function addArrow(slide, x1, y1, x2, y2, color = C.teal) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 1.5, beginArrowType: "none", endArrowType: "triangle" },
  });
}

function slide1() {
  const slide = pptx.addSlide();
  addBg(slide, "dark");
  addTitle(
    slide,
    "ARCHITECTURE",
    "HealthCompass MA is a MassHealth operating layer",
    "A unified intake, verification, benefit, collaboration, and AI-assistance platform built for regulated healthcare workflows.",
    { dark: true, titleW: 7.8, titleH: 1.35, titleSize: 34, subY: 2.25, subW: 6.9, subH: 0.75, subSize: 13.2 },
  );

  addMetric(slide, 0.78, 3.55, 2.35, "1", "deployable platform", C.mint);
  addMetric(slide, 3.38, 3.55, 2.35, "6+", "regulated workflows", C.sky);
  addMetric(slide, 5.98, 3.55, 2.35, "AI + rules", "deterministic core", "F9E795");

  addNode(slide, 9.05, 1.45, 2.7, 0.72, "Applicants", C.white);
  addNode(slide, 9.05, 2.45, 2.7, 0.72, "Social workers", C.white);
  addNode(slide, 9.05, 3.45, 2.7, 0.72, "Reviewers", C.white);
  addNode(slide, 9.05, 4.45, 2.7, 0.72, "Admins", C.white);
  addShapeStack(slide, 8.32, 1.05);
  addFooter(slide, true);
}

function addShapeStack(slide, x, y) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 3.95, h: 4.55,
    rectRadius: 0.08,
    fill: { color: "FFFFFF", transparency: 92 },
    line: { color: "FFFFFF", transparency: 80 },
  });
  slide.addText("Platform surface", {
    x: x + 0.32, y: y + 0.18, w: 2.4, h: 0.22,
    margin: 0,
    fontFace: FONT_BODY,
    fontSize: 10,
    bold: true,
    color: "BFEAF4",
  });
}

function slide2() {
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(
    slide,
    "INVESTOR VIEW",
    "The architecture compounds workflow data into product leverage",
    "Each completed workflow improves the platform's understanding of applicant journeys, evidence gaps, and policy touchpoints.",
    { titleW: 8.6, titleH: 1.0, subY: 1.92, subW: 8.15, subH: 0.46, subSize: 10.4 },
  );

  addCard(slide, 0.75, 2.58, 3.72, 2.85, "Intake",
    "Guided ACA-3 / ACA-3-AP workflows convert fragmented applicant data into reusable structured state.", { accent: C.teal });
  addCard(slide, 4.8, 2.58, 3.72, 2.85, "Verification",
    "Identity, income, document, and eligibility checks separate model extraction from legal sufficiency decisions.", { accent: C.gold });
  addCard(slide, 8.85, 2.58, 3.72, 2.85, "Assistance",
    "RAG-backed assistants and appeals turn policy content into explainable, workflow-specific guidance.", { accent: C.coral });

  addArrow(slide, 4.46, 3.98, 4.78, 3.98);
  addArrow(slide, 8.52, 3.98, 8.84, 3.98);
  addFooter(slide);
}

function slide3() {
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(
    slide,
    "PLATFORM MAP",
    "One product surface, four stakeholder views",
    "The same application record supports applicants, social workers, reviewers, and administrators without duplicating workflow systems.",
    { titleW: 7.8, subW: 7.4 },
  );

  addNode(slide, 0.92, 2.38, 2.1, 0.68, "Applicant", C.sky);
  addNode(slide, 0.92, 3.35, 2.1, 0.68, "Social worker", C.mint);
  addNode(slide, 0.92, 4.32, 2.1, 0.68, "Reviewer", "F9E795");
  addNode(slide, 0.92, 5.29, 2.1, 0.68, "Admin", "FDE4D8");

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 4.12, y: 2.35, w: 4.0, h: 3.5,
    rectRadius: 0.08,
    fill: { color: C.navy },
    line: { color: C.navy },
  });
  slide.addText("HealthCompass MA platform", {
    x: 4.45, y: 2.62, w: 3.34, h: 0.36,
    margin: 0,
    align: "center",
    fontFace: FONT_HEAD,
    fontSize: 18,
    bold: true,
    color: C.white,
    fit: "shrink",
  });
  addNode(slide, 4.55, 3.28, 3.14, 0.48, "Application record", C.white);
  addNode(slide, 4.55, 3.9, 3.14, 0.48, "Policy knowledge", C.white);
  addNode(slide, 4.55, 4.52, 3.14, 0.48, "Verification state", C.white);

  addNode(slide, 9.25, 2.38, 2.65, 0.58, "Supabase + RLS", C.sky);
  addNode(slide, 9.25, 3.18, 2.65, 0.58, "pgvector RAG", C.mint);
  addNode(slide, 9.25, 3.98, 2.65, 0.58, "Ollama AI", "F9E795");
  addNode(slide, 9.25, 4.78, 2.65, 0.58, "OpenObserve", "FDE4D8");

  [2.72, 3.69, 4.66, 5.63].forEach((y) => addArrow(slide, 3.04, y, 4.1, 4.1, C.teal));
  [2.67, 3.47, 4.27, 5.07].forEach((y) => addArrow(slide, 8.13, 4.1, 9.22, y, C.coral));
  addFooter(slide);
}

function slide4() {
  const slide = pptx.addSlide();
  addBg(slide, "dark");
  addTitle(
    slide,
    "DEFENSIBLE AI",
    "Models assist; rules decide",
    "Eligibility thresholds, FPL math, income sufficiency, and identity scoring stay deterministic. LLMs handle extraction, explanation, translation, and drafting.",
    { dark: true, titleW: 8.15, titleH: 0.88, subW: 7.6, subH: 0.7 },
  );

  addCard(slide, 0.88, 2.3, 3.65, 2.65, "Deterministic core",
    "Eligibility engines, benefit program evaluators, income evidence checks, identity match scoring, application submission gates.", { dark: true, accent: C.gold, bodySize: 10.6 });
  addCard(slide, 4.86, 2.3, 3.65, 2.65, "Policy grounding",
    "MassHealth policy documents are chunked, embedded, stored in pgvector, and retrieved with focused task queries.", { dark: true, accent: C.aqua, bodySize: 10.6 });
  addCard(slide, 8.84, 2.3, 3.65, 2.65, "LLM workbench",
    "Ollama powers chat, form assistance, appeals, translation, and document extraction with narrow prompt contracts.", { dark: true, accent: C.coral, bodySize: 10.6 });

  addArrow(slide, 4.55, 3.63, 4.84, 3.63, C.aqua);
  addArrow(slide, 8.53, 3.63, 8.82, 3.63, C.aqua);
  addFooter(slide, true);
}

function slide5() {
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(
    slide,
    "DATA BACKBONE",
    "A single governed record across intake, evidence, and collaboration",
    "Supabase/PostgreSQL anchors the workflow; RLS and role-aware access functions keep ownership explicit.",
    { titleW: 8.8, titleH: 1.08, subY: 1.98, subW: 7.55, subH: 0.42, subSize: 10.4 },
  );

  const groups = [
    ["Identity", "users, roles, applicants, identity attempts", C.sky],
    ["Applications", "applications, household, incomes, assets, documents", C.mint],
    ["Verification", "income cases, requirements, extractions, decisions, RFI", "F9E795"],
    ["Collaboration", "sessions, messages, social worker access, DMs", "FDE4D8"],
    ["Knowledge", "policy documents, pgvector chunks, embeddings", C.sky],
    ["Audit", "notifications, review actions, audit logs", C.mint],
  ];

  groups.forEach(([title, body, fill], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    addCard(slide, 0.82 + col * 4.08, 2.5 + row * 1.62, 3.55, 1.2, title, body, {
      accent: col === 0 ? C.teal : col === 1 ? C.gold : C.coral,
      bodySize: 9.4,
      titleSize: 14,
      shadow: true,
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 3.78 + col * 4.08, y: 2.72 + row * 1.62, w: 0.34, h: 0.34,
      fill: { color: fill },
      line: { color: fill },
    });
  });

  slide.addText("Core pattern: transactional state + private object storage + vector policy memory", {
    x: 1.55, y: 5.88, w: 10.2, h: 0.33,
    margin: 0,
    align: "center",
    fontFace: FONT_HEAD,
    fontSize: 16,
    bold: true,
    color: C.ink,
    fit: "shrink",
  });
  addFooter(slide);
}

function slide6() {
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(
    slide,
    "WORKFLOW FLYWHEEL",
    "Each workflow strengthens the next one",
    "The platform links guided intake, evidence verification, benefit recommendations, appeals, and assisted collaboration around one applicant journey.",
    { titleW: 8.2, subW: 7.9 },
  );

  const stages = [
    ["1", "Intake", "Collect structured facts"],
    ["2", "Verify", "Confirm identity and income"],
    ["3", "Recommend", "Rank benefits and next actions"],
    ["4", "Assist", "Use RAG-backed guidance"],
    ["5", "Review", "Resolve RFI and decisions"],
  ];
  stages.forEach(([num, title, body], i) => {
    const x = 0.86 + i * 2.47;
    slide.addShape(pptx.ShapeType.ellipse, {
      x, y: 2.45, w: 1.18, h: 1.18,
      fill: { color: i % 2 === 0 ? C.teal : C.coral },
      line: { color: i % 2 === 0 ? C.teal : C.coral },
    });
    slide.addText(num, {
      x, y: 2.72, w: 1.18, h: 0.32,
      margin: 0,
      align: "center",
      fontFace: FONT_HEAD,
      fontSize: 22,
      bold: true,
      color: C.white,
    });
    slide.addText(title, {
      x: x - 0.33, y: 3.9, w: 1.86, h: 0.28,
      margin: 0,
      align: "center",
      fontFace: FONT_HEAD,
      fontSize: 15,
      bold: true,
      color: C.ink,
    });
    slide.addText(body, {
      x: x - 0.5, y: 4.33, w: 2.16, h: 0.48,
      margin: 0,
      align: "center",
      fontFace: FONT_BODY,
      fontSize: 9.5,
      color: C.slate,
      fit: "shrink",
    });
    if (i < stages.length - 1) addArrow(slide, x + 1.26, 3.03, x + 2.28, 3.03, C.teal);
  });
  addFooter(slide);
}

function slide7() {
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(
    slide,
    "SCALABILITY",
    "Modular monolith now; extracted workers when volume demands it",
    "The architecture keeps product velocity high while leaving clean extraction points for compute-heavy services.",
    { titleW: 8.75, titleH: 1.18, subY: 2.08, subW: 7.4, subH: 0.42, subSize: 10.4 },
  );

  addCard(slide, 0.82, 2.72, 3.55, 2.55, "Now",
    "Next.js App Router, Supabase/PostgreSQL, pgvector, private storage, self-hosted Ollama, OpenObserve.", { accent: C.teal, titleSize: 16 });
  addCard(slide, 4.89, 2.72, 3.55, 2.55, "Next",
    "Feature modules, route-thin use cases, AI parse metrics, background extraction jobs, RAG quality evaluation.", { accent: C.gold, titleSize: 16 });
  addCard(slide, 8.96, 2.72, 3.55, 2.55, "Later",
    "Dedicated extraction workers, ingestion pipelines, notification dispatchers, analytics service, state-specific rule packs.", { accent: C.coral, titleSize: 16 });

  slide.addText("Investor signal: the system is built to expand by workflow and state without rebuilding the core.", {
    x: 1.12, y: 5.95, w: 11.05, h: 0.4,
    margin: 0,
    align: "center",
    fontFace: FONT_HEAD,
    fontSize: 16,
    bold: true,
    color: C.ink,
    fit: "shrink",
  });
  addFooter(slide);
}

function slide8() {
  const slide = pptx.addSlide();
  addBg(slide, "dark");
  addTitle(
    slide,
    "WHY IT MATTERS",
    "HealthCompass MA is positioned as workflow infrastructure, not a point tool",
    "The moat is the combination of governed data, deterministic eligibility logic, policy-grounded AI, and collaboration workflows.",
    { dark: true, titleW: 8.65, titleH: 1.05, titleSize: 28, subY: 1.92, subW: 7.55, subH: 0.68 },
  );

  addCard(slide, 0.88, 3.0, 3.65, 1.75, "Trust layer",
    "RLS, audit trails, private storage, and deterministic decision boundaries.", { dark: true, accent: C.aqua, bodySize: 10.2 });
  addCard(slide, 4.86, 3.0, 3.65, 1.75, "AI leverage",
    "Models handle language-heavy workflows while code owns rules and sufficiency.", { dark: true, accent: C.gold, bodySize: 10.2 });
  addCard(slide, 8.84, 3.0, 3.65, 1.75, "Expansion path",
    "Provider portals, reviewer operations, analytics, and state-specific policy packs.", { dark: true, accent: C.coral, bodySize: 10.2 });

  slide.addText("Designed for the workflows that make healthcare access expensive: intake, evidence, policy, review, and follow-up.", {
    x: 1.35, y: 5.75, w: 10.6, h: 0.42,
    margin: 0,
    align: "center",
    fontFace: FONT_HEAD,
    fontSize: 15.5,
    bold: true,
    color: C.white,
    fit: "shrink",
  });
  addFooter(slide, true);
}

slide1();
slide2();
slide3();
slide4();
slide5();
slide6();
slide7();
slide8();

await pptx.writeFile({ fileName: OUT_PATH });
console.log(`Wrote ${OUT_PATH}`);
