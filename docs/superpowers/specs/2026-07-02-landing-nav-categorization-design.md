# Landing page nav categorization

Date: 2026-07-02 (revised)

## Problem

Landing page header nav ([app/page.tsx:282](../../../app/page.tsx#L282)) only ever linked to in-page anchors (Problem, How It Works, Why Us, Live Assistance, Appeal Help) plus one static Resources link. Real product surface has grown (programs pages, eligibility checker, benefit stack tool, AI appeal letters, help center) but the nav was never updated to surface it — those pages are currently only reachable from the footer ([app/page.constants.tsx:161](../../../app/page.constants.tsx#L161)) or direct URL.

## Scope

Desktop nav only (`hidden md:flex`). No mobile menu exists today and none is added — separate follow-up if wanted.

## Design

`NavigationMenu` (shadcn, [components/ui/navigation-menu.tsx](../../../components/ui/navigation-menu.tsx)) with 4 dropdown categories, replacing the previous 3-category version:

1. **Programs** ▾
   - MassHealth → `/programs/masshealth`
   - SNAP / Food Assistance → `/programs/snap`
   - EITC Tax Credits → `/programs/eitc`
   - LIHEAP Energy Aid → `/programs/liheap`
   - WIC → `/programs/wic` (added after a follow-up review found `program-content.ts` has 5 real program pages, not the 4 the original `FOOTER_PROGRAMS` constant listed)
   - View All Programs → `/programs`
2. **Tools** ▾
   - Eligibility Checker → `/prescreener`
   - Benefit Stack Tool → `/benefit-stack`
   - AI Appeal Letters → `/masshealth-appeals` (AI badge)
3. **About** ▾ (unchanged from prior revision)
   - The Problem → `#problems`
   - How It Works → `#how-it-works`
   - Why Us → `#why-us`
4. **Resources** ▾ (was a plain link, now a dropdown)
   - Live Assistance → `#live-assistance` (NEW badge)
   - Help Center → `/help`
   - Knowledge Center → `/knowledge-center`

Sign in / Get Started buttons and `LanguageSwitcher` stay outside the nav, unchanged.

Programs/Tools link targets and English labels are taken from the existing (unlocalized) `FOOTER_PROGRAMS` / `FOOTER_PLATFORM` constants in `app/page.constants.tsx` for consistency, but nav labels are localized in `page.copy.ts` (footer itself stays out of scope — it's hardcoded English today and not part of this change).

## Copy changes

In `LandingCopy` ([app/page.copy.ts](../../../app/page.copy.ts)):

- Remove: `navGetHelp`, `navAppealHelp` (superseded — "Get Help" category is gone, appeal item moved to Tools as "AI Appeal Letters")
- Keep as-is: `navAbout`, `navProblem`, `navHowItWorks`, `navWhyUs`, `navLiveAssistance`, `navResources` (repurposed as the Resources dropdown *trigger* label — same English text "Resources", no translation changes needed), `newLabel`, `aiLabel`
- Add: `navPrograms`, `navProgramsAll`, `navProgramMasshealth`, `navProgramSnap`, `navProgramEitc`, `navProgramLiheap`, `navTools`, `navEligibilityChecker`, `navBenefitStackTool`, `navAiAppealLetters`, `navHelpCenter`, `navKnowledgeCenter`

All additions/removals applied across all 6 languages (EN, ES, ZH_CN, HT, PT_BR, VI).

## Testing

- Visual check in browser: all 4 dropdowns open, program/tool links navigate to real pages, anchor links still scroll correctly, badges (NEW/AI) render.
- No unit tests exist for `app/page.tsx` nav; none added — presentational, covered by manual browser check per project convention for the landing page.
