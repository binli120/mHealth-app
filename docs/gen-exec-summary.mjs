import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TabStopPosition,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { writeFileSync } from "fs";

const OUT_PATH = "docs/HealthCompassMA_Executive_Summary_2026.docx";

const C = {
  navy: "10263F",
  ink: "1D3557",
  teal: "137C71",
  aqua: "5DB7DE",
  coral: "E8825E",
  gold: "F2C14E",
  line: "D9E3EA",
  sky: "E9F5FB",
  mint: "DFF5F1",
  sand: "F7F2EA",
  panel: "FFFDFC",
  text: "233142",
  slate: "556677",
  white: "FFFFFF",
};

const FONT_HEAD = "Aptos Display";
const FONT_BODY = "Aptos";

const spacer = (after = 120) => new Paragraph({ spacing: { after } });

const rule = (color = C.line, size = 6) =>
  new Paragraph({
    spacing: { before: 60, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, color, size, space: 1 } },
  });

const para = (text, opts = {}) =>
  new Paragraph({
    spacing: { before: 20, after: opts.after ?? 90 },
    alignment: opts.alignment ?? AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        font: FONT_BODY,
        size: opts.size ?? 22,
        color: opts.color ?? C.text,
        bold: opts.bold ?? false,
        italics: opts.italics ?? false,
      }),
    ],
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 20, after: 40 },
    children: [
      new TextRun({
        text,
        font: FONT_BODY,
        size: 21,
        color: C.text,
      }),
    ],
  });

const sectionTitle = (index, title) =>
  new Paragraph({
    spacing: { before: 220, after: 80 },
    children: [
      new TextRun({
        text: `${index}  ${title}`,
        font: FONT_HEAD,
        size: 29,
        bold: true,
        color: C.ink,
      }),
    ],
  });

function twoColTable(rows, widths = [3200, 6160]) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.line };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: widths[0], type: WidthType.DXA },
            borders: { top: border, bottom: border, left: border, right: border },
            shading: { type: ShadingType.CLEAR, fill: C.navy },
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [para("Focus Area", { size: 20, color: C.white, bold: true, after: 0 })],
          }),
          new TableCell({
            width: { size: widths[1], type: WidthType.DXA },
            borders: { top: border, bottom: border, left: border, right: border },
            shading: { type: ShadingType.CLEAR, fill: C.navy },
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [para("Executive Summary", { size: 20, color: C.white, bold: true, after: 0 })],
          }),
        ],
      }),
      ...rows.map(([left, right], index) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: widths[0], type: WidthType.DXA },
              borders: { top: border, bottom: border, left: border, right: border },
              shading: { type: ShadingType.CLEAR, fill: index % 2 === 0 ? C.sky : C.panel },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              verticalAlign: VerticalAlign.CENTER,
              children: [para(left, { size: 19, color: C.ink, bold: true, after: 0 })],
            }),
            new TableCell({
              width: { size: widths[1], type: WidthType.DXA },
              borders: { top: border, bottom: border, left: border, right: border },
              shading: { type: ShadingType.CLEAR, fill: index % 2 === 0 ? C.sky : C.panel },
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [para(right, { size: 19, color: C.text, after: 0 })],
            }),
          ],
        }),
      ),
    ],
  });
}

function metricRow(items) {
  const border = { style: BorderStyle.NONE, size: 0, color: C.white };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [
      new TableRow({
        children: items.map(({ value, label, note }, index) =>
          new TableCell({
            width: { size: 3120, type: WidthType.DXA },
            borders: { top: border, bottom: border, left: border, right: border },
            shading: {
              type: ShadingType.CLEAR,
              fill: [C.mint, C.sky, "FFF3D2"][index % 3],
            },
            margins: { top: 160, bottom: 160, left: 180, right: 180 },
            children: [
              para(value, { size: 34, color: C.ink, bold: true, alignment: AlignmentType.CENTER, after: 20 }),
              para(label, { size: 18, color: C.teal, bold: true, alignment: AlignmentType.CENTER, after: 20 }),
              para(note, { size: 16, color: C.slate, alignment: AlignmentType.CENTER, after: 0 }),
            ],
          }),
        ),
      }),
    ],
  });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: "bullet",
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 280 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: 22, color: C.text },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.teal, space: 1 } },
              spacing: { after: 80 },
              children: [
                new TextRun({ text: "HealthCompass MA", font: FONT_HEAD, size: 18, bold: true, color: C.ink }),
                new TextRun({ text: "\tExecutive Summary  |  April 2026", font: FONT_BODY, size: 16, color: C.slate }),
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
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 1 } },
              spacing: { before: 80 },
              children: [
                new TextRun({ text: "Confidential", font: FONT_BODY, size: 16, italics: true, color: C.slate }),
                new TextRun({ text: "\tPage ", font: FONT_BODY, size: 16, color: C.slate }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 16, color: C.slate }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: C.navy },
                  margins: { top: 380, bottom: 380, left: 480, right: 480 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 12, color: C.teal },
                    bottom: { style: BorderStyle.SINGLE, size: 12, color: C.teal },
                    left: { style: BorderStyle.NONE, size: 0, color: C.white },
                    right: { style: BorderStyle.NONE, size: 0, color: C.white },
                  },
                  children: [
                    para("HealthCompass MA", { size: 46, color: C.white, bold: true, after: 40 }),
                    para("Executive Summary  |  AI Infrastructure for Benefits Access", {
                      size: 24,
                      color: "B7DBEC",
                      after: 80,
                    }),
                    para(
                      "Turning fragmented public-benefits intake into a guided, multilingual, AI-supported care navigation system for patients, social workers, and facilities.",
                      { size: 28, color: C.white, bold: true, after: 140 },
                    ),
                    para(
                      "This Word version tracks the refreshed investor narrative: technology secret sauce, technical barriers and AI support, patient and facility impact, language and disability support, and the future blueprint.",
                      { size: 20, color: "DAE8F3", after: 0 },
                    ),
                  ],
                }),
              ],
            }),
          ],
        }),

        spacer(180),
        metricRow([
          { value: "10", label: "Programs evaluated", note: "MassHealth plus cross-program benefit stack" },
          { value: "6", label: "Languages live", note: "Chinese, Haitian Creole, Portuguese, Spanish, Vietnamese, English" },
          { value: "4", label: "AI support modes", note: "Advisor, intake, form assistance, and appeals" },
        ]),

        sectionTitle("01", "Platform Today"),
        rule(),
        para(
          "HealthCompass MA is no longer just a screener. The live product now combines deterministic eligibility logic, application workflows, AI support, document handling, multilingual guidance, staff collaboration, and reviewer operations in one stack.",
        ),
        twoColTable([
          [
            "Discover",
            "Deterministic pre-screening plus benefit orchestration across MassHealth, MSP, SNAP, EITC, Section 8, Child Care, LIHEAP, WIC, TAFDC, and EAEDC.",
          ],
          [
            "Apply",
            "MassHealth application flows, ACA-3-AP rules, required-document tracking, document uploads, and guided form completion support.",
          ],
          [
            "Support",
            "Benefit advisor chat, form assistant, appeal assistant, policy RAG, knowledge-center content, and notifications.",
          ],
          [
            "Coordinate",
            "Social-worker messaging, voice-note transcription, translation, screen-share sessions, reviewer dashboards, case management, and audit workflows.",
          ],
        ]),

        sectionTitle("02", "Technology Secret Sauce"),
        rule(),
        para(
          "The core technology decision is to separate deterministic decisions from AI support. LLMs are used where language, extraction, summarization, translation, and drafting matter. Deterministic code remains responsible for eligibility, routing, document requirements, and workflow state.",
        ),
        bullet("Plain-language intake lowers the policy and literacy barrier at the very first interaction."),
        bullet("Structured extraction converts open-ended patient input into typed household, income, relationship, and document signals."),
        bullet("Rule engines decide coverage pathways, required documents, and next-step routing using code rather than model guesswork."),
        bullet("Actionable workflow output powers applications, notifications, staff review, and appeal support."),

        sectionTitle("03", "Technical Barriers, Training, and AI Support"),
        rule(),
        twoColTable([
          [
            "Technical barriers",
            "Massachusetts-specific rule code, benefit orchestration logic, narrow task-specific prompts, policy retrieval, and staff workflow tooling create a compound moat that is much harder to copy than a standalone chatbot.",
          ],
          [
            "Prompt design",
            "Prompts are mode-specific: intake, benefit advising, form assistance, and appeals. Structured outputs are validated before the product acts on them.",
          ],
          [
            "Retrieval strategy",
            "Task-specific pgvector retrieval uses policy chunks selected from the current denial reason, top candidate program, or active form section rather than the full conversation.",
          ],
          [
            "Training path",
            "Current assets include curated policy corpus, denial categories, domain prompts, multilingual interactions, and workflow data. The future training path includes benchmark suites, denial-outcome datasets, reviewer feedback loops, and document-AI labeling.",
          ],
          [
            "Evaluation metrics",
            "Key evals should include parse success, factual grounding, multilingual consistency, extraction precision, completion time, reviewer override rate, and appeal readiness.",
          ],
        ]),

        sectionTitle("04", "How the Technology Helps Patients"),
        rule(),
        para(
          "The patient value is practical rather than abstract: help people discover more benefits, complete more applications, avoid missed deadlines, and recover faster after denials.",
        ),
        bullet("One intake can surface a fuller benefit stack instead of leaving households to discover programs one by one."),
        bullet("Guided form assistance reduces blank-page paralysis and clarifies what information or proof is still missing."),
        bullet("Appeal support turns a denial notice into a structured evidence checklist and a first-pass appeal draft."),
        bullet("Notifications reduce renewal lapses, response delays, and forgotten next steps."),
        bullet("The experience is built for patients with low time, limited English proficiency, low digital confidence, or difficulty writing complex forms on their own."),

        sectionTitle("05", "How the Technology Helps Facilities and Care Teams"),
        rule(),
        para(
          "HealthCompass MA is also a care-operations platform for social workers, reviewers, and partner organizations. Patient value and facility value improve together.",
        ),
        bullet("Secure direct messaging, voice notes with transcription, translation, and screen-share sessions reduce the back-and-forth required to move cases forward."),
        bullet("Reviewer dashboards, case queues, status views, reports, and audit surfaces provide operational visibility for staff workflows."),
        bullet("Facilities gain less repeated intake work, faster document follow-up, better patient engagement outside business hours, and a foundation for provider-facing deployments."),

        sectionTitle("06", "Language, Accessibility, and Disability Support"),
        rule(),
        para(
          "The product is intentionally built for people who do not fit the default assumption of strong English, high literacy, or easy form completion.",
        ),
        twoColTable([
          ["Languages live today", "English, Simplified Chinese, Haitian Creole, Brazilian Portuguese, Spanish, and Vietnamese."],
          ["Accessibility preferences", "Reading assistance, translation support, and voice assistant preferences are already modeled at the profile level and can shape the app experience."],
          ["Support when writing is hard", "Guided chat, voice-note workflows, and plain-language assistance help users who cannot easily complete dense forms by typing alone."],
          ["Disability-aware logic", "The platform already captures disability / SSI / SSDI context and identifies when medical verification or disability supplements are required so people can get their applications ready earlier."],
        ]),

        sectionTitle("07", "Future Blueprint"),
        rule(),
        para(
          "The next phase is about compounding the rule engine with document AI, retention workflows, provider tooling, and a stronger learning loop.",
        ),
        twoColTable([
          ["Now", "Workflow platform for screening, benefit stacking, applications, appeals, messaging, notifications, and reviewer operations."],
          ["Next", "Document AI to classify paystubs, IDs, and supporting proofs, normalize extracted fields, and flag mismatches before submission."],
          ["Next", "Retention engine for renewal automation, proactive reminders, and monitoring for changes that could threaten coverage."],
          ["Later", "Provider operating system with provider portals, staff copilot workflows, analytics, policy learning loops, and state-by-state rule-pack architecture."],
        ]),

        sectionTitle("08", "Why This Is Hard to Copy"),
        rule(),
        para(
          "The defensibility comes from the combination of domain rules, workflow data, and trusted operational surfaces. The more the platform touches intake, support, and review, the more proprietary the system becomes.",
        ),
        bullet("Policy depth: MassHealth-specific prompts, rules, and document logic accumulate domain knowledge faster than generic SaaS tooling."),
        bullet("Workflow graph: patients, documents, messages, deadlines, reviewer actions, and appeals create a richer operating dataset over time."),
        bullet("Trust posture: local/private AI, typed outputs, deterministic decisions, and auditable staff workflows matter in high-stakes benefits access."),
        bullet("Expansion path: the architecture can evolve into configurable state rule packs rather than one-off scripts for each new market."),

        sectionTitle("09", "Executive Takeaway"),
        rule(C.teal, 8),
        para(
          "HealthCompass MA has the ingredients for a real technology moat: deterministic benefit logic, policy-grounded AI support, multilingual engagement, and facility workflows that produce durable proprietary data. The future blueprint compounds all four.",
          { size: 24, bold: true, color: C.ink, after: 120 },
        ),
        para(
          "Contact: contact@healthcompassma.com  |  healthcompassma.com",
          { size: 18, color: C.teal, bold: true, after: 0 },
        ),
      ],
    },
  ],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT_PATH, buf);
console.log(`Wrote ${OUT_PATH}`);
