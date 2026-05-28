# Contributing — HealthCompass MA

## File Naming Conventions

Two naming styles coexist in this codebase due to incremental migration. Follow the rules below for any new code:

### React components

| Directory | Current convention | Notes |
|-----------|-------------------|-------|
| `components/chat/` | `kebab-case.tsx` | Established standard |
| `components/application/aca3/` | `kebab-case.tsx` | Established standard |
| `components/admin/` | `kebab-case.tsx` | Established standard |
| `components/auth/` | `PascalCase.tsx` | Legacy — do not add new files |
| `components/benefit-orchestration/` | `PascalCase.tsx` | Legacy — do not add new files |
| `components/collaborative-sessions/` | `PascalCase.tsx` | Legacy — do not add new files |

**Rule:** All new component files use `kebab-case.tsx`. Named exports within those files are still PascalCase React components — only the filename uses kebab-case.

```
✅  components/admin/admin-auth-gate.tsx       → export function AdminAuthGate(...)
✅  components/chat/message-bubble.tsx         → export function MessageBubble(...)
❌  components/admin/AdminAuthGate.tsx          (do not add PascalCase files to newer modules)
```

### Non-component TypeScript files

All utility, hook, and library files use `kebab-case.ts`:

```
✅  lib/masshealth/aca3-eligibility-helpers.ts
✅  hooks/use-idle-timer.ts
✅  app/admin/users/users-csv.ts
```

### Route segments (Next.js App Router)

Next.js requires `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` — these are fixed by the framework.
Co-located route utilities use `page.utils.ts` and `page.components.tsx`.

---

## Code Style

- **TypeScript strict mode** is enabled — no `any`, no non-null assertions without a comment
- **Imports:** use `@/` path alias for all project imports (never relative `../../`)
- **FPL thresholds:** use named constants from `lib/masshealth/constants.ts` — do not hardcode `138`, `300`, `500`, etc.
- **Eligibility types:** `Aca3CitizenshipStatus` for ACA-3 engine; `CitizenshipStatus` for prescreener; `BenefitEligibilityStatus` for benefit orchestration — do not conflate

---

## Tests

- Unit tests live in `__tests__/` subdirectories next to the module under test
- E2E tests live in `e2e/tests/` and follow the `NN-feature-name.spec.ts` numbering scheme
- Run `pnpm test` before opening a PR; ensure `pnpm tsc --noEmit` passes with zero errors
