# Landing page nav categorization

Date: 2026-07-02

## Problem

Landing page header nav ([app/page.tsx:282-295](../../../app/page.tsx#L282)) has 6 flat top-level items (Problem, How It Works, Why Us, Live Assistance, Appeal Help, Resources). Inspired by bioford.ai's cleaner header (About / Features▾ / Pricing / Blog + CTA, one dropdown), we're consolidating to fewer top-level items with dropdowns for related content.

## Scope

Desktop nav only (`hidden md:flex`, `md:` breakpoint+). No mobile menu exists today and none is added — out of scope, flagged as a separate follow-up if wanted.

## Design

Replace the flat `<nav>` with shadcn's `NavigationMenu` (already present, unused, at [components/ui/navigation-menu.tsx](../../../components/ui/navigation-menu.tsx)).

Grouping:

1. **About** (dropdown trigger) → panel with 3 links: The Problem (`#problems`), How It Works (`#how-it-works`), Why Us (`#why-us`)
2. **Get Help** (dropdown trigger) → panel with 2 links: Live Assistance (`#live-assistance`, keeps NEW badge), Appeal Help (`#appeal`, keeps AI badge)
3. **Resources** — unchanged plain `Link` to `/knowledge-center`

Sign in / Get Started buttons and `LanguageSwitcher` stay outside the nav, unchanged.

## Copy changes

Add 2 keys to `LandingCopy` in [app/page.copy.ts](../../../app/page.copy.ts): `navAbout`, `navGetHelp`. Populate for all 6 languages already in the file (en, es, zh, ht, pt, + remaining locale). Existing 6 `nav*` keys are kept as-is and reused as dropdown item labels — no copy changes to their text.

## Testing

- Visual check in browser: both dropdowns open on hover/click, links scroll to correct anchor, badges render inside dropdown rows.
- Existing anchor targets (`#problems`, `#how-it-works`, `#why-us`, `#live-assistance`, `#appeal`) are unchanged, so no changes needed elsewhere on the page.
- No unit tests exist for `app/page.tsx` nav currently; none added (behavior is presentational, covered by manual browser check per project convention for landing page).
