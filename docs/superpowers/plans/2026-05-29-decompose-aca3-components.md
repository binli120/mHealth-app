# ACA3 Component Decomposition Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose three monolithic ACA3 components (8,875 lines total) into focused sub-files with single responsibilities, without changing any external public API.

**Architecture:** Each source file is split by responsibility — context/state, field rendering, validation, step components, etc. All existing `export`s remain accessible from their original paths (either kept in-file or re-exported via `export { X } from "./sub-file"`). Tests import from the same paths they already use.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, `pnpm`

---

## File Map — Before → After

### form-wizard.tsx (3,926 → ~600 lines)

| New file | Lines extracted | Responsibility |
|---|---|---|
| `form-wizard-context.tsx` | 141–219, 220–457 | FormContext, useFormContext, state hydration helpers |
| `form-wizard-field-renderer.tsx` | 153–160, 162–173, 878–887, 888–1917 | AddressGroupField, FieldRenderer |
| `form-wizard-validation.tsx` | 1918–2387 | validateFieldValue, validateFieldsRecursive, validateStepWithWizardRules, useStepValidation |
| `form-wizard-steps.tsx` | 2368–2881 | StepContainer, Steps 1–7 components |
| `form-wizard-review-step.tsx` | 2882–3079 | ReviewPdfStep, getEngineRuleFixTarget |
| `form-wizard-submit-step.tsx` | 882–887, 3080–3591 | sleep, ValidateAndSubmitStep |
| **Keep** in form-wizard.tsx | 458–880, 3592–3926 | FormProvider, StepContent, FormWizardBody, FormWizard |

### intake-chat.tsx (2,894 → ~500 lines)

| New file | Lines extracted | Responsibility |
|---|---|---|
| `intake-chat-types.ts` | types only | Re-export WizardData + IntakeQuestion types for tests |
| `intake-chat-question-builder.ts` | 501–1942 (logic only) | buildQuestions, readValue, writeValue, question collection |
| `intake-chat-answer-parser.ts` | 246–500, partial 841–1134 | Date parsing, NLP value parsing, parseAnswerValue |
| **Delete** duplicates | 501–667 | Functions already in wizard-reducer.ts |
| **Keep** in intake-chat.tsx | 1–240, 2052–end | IntakeChat component, constants, re-exports |

### application-assistant.tsx (2,055 → ~800 lines)

| New file | Lines extracted | Responsibility |
|---|---|---|
| `application-assistant-utils.ts` | 137–818 | All exported utilities + constants |
| `application-assistant-message-bubble.tsx` | 321–324, 1979–end | CompassIcon, MessageBubble |
| **Keep** in application-assistant.tsx | 100–136, 819–1978 | ApplicationAssistant component |

---

## Preserved Public API

These import paths must continue to work unchanged after every task:

```typescript
// External consumers (app pages + tests)
import { FormWizard } from "@/components/application/aca3/form-wizard"
import { validateStepWithWizardRules } from "@/components/application/aca3/form-wizard"
import { IntakeChat } from "@/components/application/aca3/intake-chat"
import { createInitialIntakeData, buildIntakeQuestions, computeAnsweredIntakeQuestionIds,
  findNextPendingIntakeQuestion, parseIntakeAnswerValue, writeIntakeQuestionValue }
  from "@/components/application/aca3/intake-chat"
import { ApplicationAssistant, ASSISTANT_CONNECTION_FAILURE_MESSAGE,
  getQuickRepliesForAssistantPrompt, getNextMissingApplicationQuestion,
  getImmediateFieldPatchFromAnswer, recoverImmediateFieldsFromMessages,
  hasDocumentUploadPrompt, sanitizeAssistantDraftMessages, hasPersistableAssistantDraft }
  from "@/components/application/aca3/application-assistant"
```

---

## Baseline: Run tests before starting

- [ ] **Confirm tests pass before touching any file**

```bash
cd /Users/blee/dev/masshealth-repo/mHealth-app
pnpm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass (or note existing failures to ignore).

- [ ] **Note the current line counts as a sanity reference**

```bash
wc -l components/application/aca3/form-wizard.tsx \
         components/application/aca3/intake-chat.tsx \
         components/application/aca3/application-assistant.tsx
# Expected: 3926  2894  2055
```

---

## Task 1: Extract `form-wizard-context.tsx`

**Files:**
- Create: `components/application/aca3/form-wizard-context.tsx`
- Modify: `components/application/aca3/form-wizard.tsx`

### What to extract

Move these functions from `form-wizard.tsx` to the new file:

| Symbol | Line in form-wizard.tsx |
|---|---|
| `getIncomeChecklistMemberId` | 141 |
| `getRepeatableRowDefault` | 175 |
| `getActiveSubFields` | 193 |
| `FormContext` | 220 |
| `useFormContext` | 222 |
| `normalizeHydratedState` | 232 |
| `buildPersistedStateSnapshot` | 336 |
| `buildSafeServerSnapshot` | 345 |
| `getPersistedAt` | 351 |
| `choosePreferredHydratedRaw` | 365 |
| `hasMeaningfulPhiValue` | 390 |
| `hasMeaningfulPhiData` | 414 |
| `toHydrationRecord` | 428 |
| `mergePhiDataFromRaw` | 432 |

**Note:** `isAddressCoreField` (153) and `requiresFullNameFormat` (162) are used only by `FieldRenderer` — they go in Task 2 instead.

- [ ] **Step 1: Create `form-wizard-context.tsx`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { createContext, useContext } from "react"
import type { FormContextValue, WizardState, WizardData, PersonState } from "./types"
import {
  createInitialState,
  createInitialData,
  makeDefaultPersonState,
  clampPersonCount,
  normalizeScalarFieldValue,
} from "./wizard-reducer"
import { splitWizardState } from "@/lib/phi-token/token"
import { PHI_DATA_KEYS } from "@/lib/phi-token/phi-fields"
import type { SchemaField, FieldValue } from "./types"
```

Then paste the 14 extracted functions (verbatim from form-wizard.tsx lines 141–457), followed by:

```typescript
export const FormContext = createContext<FormContextValue | null>(null)

export function useFormContext(): FormContextValue {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error("useFormContext must be used inside FormProvider")
  }
  return context
}
```

Export every function and constant so `form-wizard.tsx` can import them.

- [ ] **Step 2: Update `form-wizard.tsx` — replace extracted code with imports**

At the top of `form-wizard.tsx`, add:

```typescript
import {
  FormContext,
  useFormContext,
  normalizeHydratedState,
  buildPersistedStateSnapshot,
  buildSafeServerSnapshot,
  choosePreferredHydratedRaw,
  hasMeaningfulPhiData,
  mergePhiDataFromRaw,
  toHydrationRecord,
  getIncomeChecklistMemberId,
  getRepeatableRowDefault,
  getActiveSubFields,
} from "./form-wizard-context"
```

Delete lines 141–457 from `form-wizard.tsx` (the 14 extracted functions + the `FormContext` + `useFormContext` definitions).

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "form-wizard" | head -20
```

Expected: No errors in form-wizard files. Fix any missing imports by adding them to the new file's import block.

- [ ] **Step 4: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: Same pass/fail as baseline.

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/form-wizard-context.tsx \
        components/application/aca3/form-wizard.tsx
git commit -m "refactor(aca3): extract form-wizard-context.tsx — context + hydration helpers"
```

---

## Task 2: Extract `form-wizard-field-renderer.tsx`

**Files:**
- Create: `components/application/aca3/form-wizard-field-renderer.tsx`
- Modify: `components/application/aca3/form-wizard.tsx`

### What to extract

| Symbol | Line in form-wizard.tsx (after Task 1 deletes) |
|---|---|
| `isAddressCoreField` | ~153 |
| `requiresFullNameFormat` | ~162 |
| `digitsOnly` | ~878 |
| `sleep` | ~882 (NOT here — goes to submit-step in Task 6) |
| `AddressGroupField` | ~888 |
| `FieldRenderer` | ~1077 |

`FieldRenderer` is ~840 lines and uses: `useConditional`, `useField`, all UI primitives, calendar, format utils, `IncomeEvidenceChecklist`, `IdentityVerificationBanner`, redux dispatch for `openScanner`, `buildDependentsListValue`, `countDependentsFromRows`, `formatUsDate`, `getExclusiveCheckboxOptions`, `isFilled`, `normalizeDateInput`, `normalizeNumberInput`, `parseDependentsListValue`, `splitFullName`, `splitSpouseNameDobValue`, `toAnnualAmount`, `toBooleanYesNo`, `toMonthlyIncome`, `validateDobBounds`.

- [ ] **Step 1: Create `form-wizard-field-renderer.tsx`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CalendarIcon, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  ACA3_PERSON_SECTIONS_BY_ID,
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  FULL_NAME_FIELD_IDS,
  HOUSEHOLD_SIZE_FIELD_ID,
  HOUSEHOLD_SIZE_OPTIONS,
  MAX_DOB_AGE_YEARS,
  MAX_PERSON_COUNT,
  PERSON_SECTION_MAP,
  SSN_PATTERN,
  SUPPORTED_LANGUAGE_FIELD_IDS,
  SUPPORTED_LANGUAGE_OPTIONS,
  US_STATE_CODES,
} from "@/lib/constant"
import { cn } from "@/lib/utils"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { formatCurrency, formatPhoneNumber, formatSsn, parseCurrency } from "@/lib/utils/input-format"
import {
  buildDependentsListValue,
  computeAgeFromDob,
  countDependentsFromRows,
  formatUsDate,
  getExclusiveCheckboxOptions,
  isFilled,
  normalizeDateInput,
  normalizeNumberInput,
  parseDate,
  parseDependentsListValue,
  splitFullName,
  splitSpouseNameDobValue,
  toAnnualAmount,
  toBooleanYesNo,
  toMonthlyIncome,
  validateDobBounds,
} from "@/lib/utils/aca3-form"
import { evaluateConditionalRule, useConditional } from "@/hooks/use-conditional"
import { useField } from "@/hooks/use-field"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { IncomeEvidenceChecklist } from "@/components/application/income-verification/income-evidence-checklist"
import { IdentityVerificationBanner } from "@/components/identity/IdentityVerificationBanner"
import { openScanner } from "@/lib/redux/features/identity-verification-slice"
import { useAppDispatch } from "@/lib/redux/hooks"
import { useFormContext } from "./form-wizard-context"
import { getRepeatableRowDefault, getActiveSubFields } from "./form-wizard-context"
import type {
  AddressGroupFieldProps,
  AddressValidationResponse,
  FieldRendererProps,
  FieldValue,
  FormRecord,
  SchemaField,
} from "./types"
```

Then paste (verbatim from form-wizard.tsx):
1. `isAddressCoreField` function
2. `requiresFullNameFormat` function
3. `digitsOnly` function
4. `AddressGroupField` component
5. `FieldRenderer` component

Export all five.

- [ ] **Step 2: Update `form-wizard.tsx` — replace extracted code with imports**

Add to imports in `form-wizard.tsx`:

```typescript
import {
  AddressGroupField,
  FieldRenderer,
  digitsOnly,
} from "./form-wizard-field-renderer"
```

Delete from `form-wizard.tsx`: `isAddressCoreField`, `requiresFullNameFormat`, `digitsOnly`, `AddressGroupField`, `FieldRenderer`.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "aca3" | head -30
```

Fix any missing imports by checking what TypeScript reports and adding the missing symbol to the new file's imports.

- [ ] **Step 4: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/form-wizard-field-renderer.tsx \
        components/application/aca3/form-wizard.tsx
git commit -m "refactor(aca3): extract form-wizard-field-renderer.tsx — AddressGroupField + FieldRenderer"
```

---

## Task 3: Extract `form-wizard-validation.tsx`

**Files:**
- Create: `components/application/aca3/form-wizard-validation.tsx`
- Modify: `components/application/aca3/form-wizard.tsx`

### What to extract

| Symbol | Purpose |
|---|---|
| `validateFieldValue` | Per-field validation |
| `validateFieldsRecursive` | Recursive section validation |
| `sectionHasAnyAnswer` | Check if section has any filled field |
| `PersonTabStatus` | ✓/⚠ icon component for tabs |
| `validateStepWithWizardRules` | **Exported** — validates a full wizard step |
| `useStepValidation` | Hook that dispatches errors to context |

These are lines ~1918–2387 of the current `form-wizard.tsx` (after Tasks 1–2 have removed ~630 lines above them; actual line numbers will shift).

- [ ] **Step 1: Create `form-wizard-validation.tsx`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback } from "react"
import { AlertTriangle, CircleCheck } from "lucide-react"
import {
  ACA3_PERSON_SECTIONS_BY_ID,
  ACA3_SCHEMA,
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  MAX_DOB_AGE_YEARS,
  PERSON_SECTION_MAP,
  PERSON_STEP_SECTION_IDS,
  SSN_PATTERN,
} from "@/lib/constant"
import { evaluateConditionalRule } from "@/hooks/use-conditional"
import {
  computeAgeFromDob,
  isFilled,
  parseDate,
  validateDobBounds,
} from "@/lib/utils/aca3-form"
import { clampPersonCount } from "./wizard-reducer"
import { useFormContext } from "./form-wizard-context"
import type {
  SchemaField,
  ValidationParams,
  WizardData,
} from "./types"
```

Then paste (verbatim) the 6 extracted functions/components. Export `validateStepWithWizardRules`, `PersonTabStatus`, `validateFieldValue`, `validateFieldsRecursive`, `sectionHasAnyAnswer`, `useStepValidation`.

- [ ] **Step 2: Update `form-wizard.tsx`**

Add import:

```typescript
import {
  validateFieldValue,
  validateFieldsRecursive,
  sectionHasAnyAnswer,
  PersonTabStatus,
  validateStepWithWizardRules,
  useStepValidation,
} from "./form-wizard-validation"
```

Re-export from `form-wizard.tsx` (so `app/application/check/page.tsx` keeps working):

```typescript
export { validateStepWithWizardRules } from "./form-wizard-validation"
```

Delete the 6 functions from `form-wizard.tsx`.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "aca3\|check/page" | head -30
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/form-wizard-validation.tsx \
        components/application/aca3/form-wizard.tsx
git commit -m "refactor(aca3): extract form-wizard-validation.tsx — validation + step rules"
```

---

## Task 4: Extract `form-wizard-steps.tsx`

**Files:**
- Create: `components/application/aca3/form-wizard-steps.tsx`
- Modify: `components/application/aca3/form-wizard.tsx`

### What to extract

| Symbol | Purpose |
|---|---|
| `StepContainer` | Wrapper with title + description |
| `Step1ProgramSelection` | Pre-application program selection |
| `Step2PrimaryApplicant` | Contact + primary applicant fields |
| `PersonIdentitySummaryCard` | Summary card for person 1 in Step 3 |
| `Step3HouseholdMembers` | Household size + members 2+ |
| `PersonStepTabs` | Per-person tab UI for steps 4–7 |

These are ~lines 2368–2881 in the current file (line numbers shift as earlier tasks remove code).

- [ ] **Step 1: Create `form-wizard-steps.tsx`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import {
  ACA3_PERSON_SECTIONS_BY_ID,
  ACA3_SCHEMA,
  HOUSEHOLD_SIZE_OPTIONS,
  PERSON_SECTION_MAP,
  PERSON_STEP_SECTION_IDS,
} from "@/lib/constant"
import { cn } from "@/lib/utils"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { formatUsDate } from "@/lib/utils/aca3-form"
import { clampPersonCount } from "./wizard-reducer"
import { useFormContext } from "./form-wizard-context"
import { FieldRenderer } from "./form-wizard-field-renderer"
import { validateFieldsRecursive, PersonTabStatus } from "./form-wizard-validation"
import type { ReactNode } from "react"
import type { SchemaField } from "./types"
```

Then paste (verbatim) the 6 extracted components. Export all of them.

- [ ] **Step 2: Update `form-wizard.tsx`**

Add import:

```typescript
import {
  StepContainer,
  Step1ProgramSelection,
  Step2PrimaryApplicant,
  PersonIdentitySummaryCard,
  Step3HouseholdMembers,
  PersonStepTabs,
} from "./form-wizard-steps"
```

Delete those 6 components from `form-wizard.tsx`.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "aca3" | head -30
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/form-wizard-steps.tsx \
        components/application/aca3/form-wizard.tsx
git commit -m "refactor(aca3): extract form-wizard-steps.tsx — Steps 1-3 + PersonStepTabs"
```

---

## Task 5: Extract `form-wizard-review-step.tsx`

**Files:**
- Create: `components/application/aca3/form-wizard-review-step.tsx`
- Modify: `components/application/aca3/form-wizard.tsx`

### What to extract

| Symbol | Purpose |
|---|---|
| `getEngineRuleFixTarget` | Maps rule ID → step number + label |
| `ReviewPdfStep` | Step 8 — PDF preview + edit toggle |

- [ ] **Step 1: Create `form-wizard-review-step.tsx`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { Download, FileCheck2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"
import { ACA3_PERSON_SECTIONS_BY_ID, ACA3_SCHEMA, STEP_METADATA } from "@/lib/constant"
import { cn } from "@/lib/utils"
import { useFormContext } from "./form-wizard-context"
import { FieldRenderer } from "./form-wizard-field-renderer"
import { validateFieldsRecursive } from "./form-wizard-validation"
import { clampPersonCount } from "./wizard-reducer"
import type { ReviewPdfStepProps } from "./types"
```

Then paste `getEngineRuleFixTarget` and `ReviewPdfStep` verbatim. Export both.

- [ ] **Step 2: Update `form-wizard.tsx`**

```typescript
import { ReviewPdfStep, getEngineRuleFixTarget } from "./form-wizard-review-step"
```

Delete both functions from `form-wizard.tsx`.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "aca3" | head -20
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/form-wizard-review-step.tsx \
        components/application/aca3/form-wizard.tsx
git commit -m "refactor(aca3): extract form-wizard-review-step.tsx — ReviewPdfStep (step 8)"
```

---

## Task 6: Extract `form-wizard-submit-step.tsx`

**Files:**
- Create: `components/application/aca3/form-wizard-submit-step.tsx`
- Modify: `components/application/aca3/form-wizard.tsx`

### What to extract

| Symbol | Purpose |
|---|---|
| `sleep` | Promise-based delay for animation loop |
| `ValidateAndSubmitStep` | Step 9 — eligibility check + submission UI |

`sleep` is currently defined at line ~882 (before `AddressGroupField`) but is **only used** inside `ValidateAndSubmitStep`. Move it to this file.

- [ ] **Step 1: Create `form-wizard-submit-step.tsx`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import {
  createApplication,
  markApplicationSubmitted,
  setActiveApplication,
} from "@/lib/redux/features/application-slice"
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks"
import {
  evaluateAca3Eligibility,
  type Aca3EligibilityApplicantInput,
  type Aca3EligibilityResult,
  type EligibilityIncomeInput,
} from "@/lib/masshealth/aca3-eligibility-engine"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { mapWizardToEligibilityInput } from "./wizard-mappings"
import { useFormContext } from "./form-wizard-context"
import { useStepValidation, validateFieldValue } from "./form-wizard-validation"
import { getEngineRuleFixTarget } from "./form-wizard-review-step"
import { clampPersonCount } from "./wizard-reducer"
import type {
  AnimatedRuleResult,
  ValidateAndSubmitStepProps,
  ValidationPanelFinding,
} from "./types"
```

Then paste `sleep` and `ValidateAndSubmitStep` verbatim. Export both.

- [ ] **Step 2: Update `form-wizard.tsx`**

```typescript
import { sleep, ValidateAndSubmitStep } from "./form-wizard-submit-step"
```

Delete `sleep` and `ValidateAndSubmitStep` from `form-wizard.tsx`.

- [ ] **Step 3: Verify TypeScript — check full project**

```bash
pnpm exec tsc --noEmit 2>&1 | head -40
```

At this point `form-wizard.tsx` should be down to ~600 lines. Fix any residual import errors.

- [ ] **Step 4: Check line count**

```bash
wc -l components/application/aca3/form-wizard.tsx
# Expected: < 700 lines
```

- [ ] **Step 5: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add components/application/aca3/form-wizard-submit-step.tsx \
        components/application/aca3/form-wizard.tsx
git commit -m "refactor(aca3): extract form-wizard-submit-step.tsx — ValidateAndSubmitStep (step 9)"
```

---

## Task 7: Create `intake-chat-types.ts`

**Files:**
- Create: `components/application/aca3/intake-chat-types.ts`

`__tests__/lang-flow.test.ts` imports `WizardData` from `@/components/application/aca3/intake-chat-types` — that file doesn't exist yet, causing the test to fail. Also create the `IntakeQuestion` family of types here so `intake-chat-question-builder.ts` (Task 8) can share them.

- [ ] **Step 1: Create `intake-chat-types.ts`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Re-exports shared types used across intake-chat sub-modules and tests.
 */

// Re-export WizardData (and related types) from the canonical types file
export type {
  WizardData,
  WizardState,
  PersonState,
  PersonSectionKey,
  FormRecord,
  FieldValue,
  SchemaField,
} from "./types"

// ── IntakeQuestion types ───────────────────────────────────────────────────────

export interface RepeatableCountQuestion {
  kind: "repeatable_count"
  parentField: SchemaField
}

export interface RepeatableFieldQuestion {
  kind: "repeatable_field"
  parentField: SchemaField
  rowIndex: number
}

export interface ChecklistSelectionQuestion {
  kind: "checklist_selection"
  parentField: SchemaField
}

export interface ChecklistItemFieldQuestion {
  kind: "checklist_item_field"
  parentField: SchemaField
  itemId: string
  valueKey: string
}

export type IntakeQuestionComplex =
  | RepeatableCountQuestion
  | RepeatableFieldQuestion
  | ChecklistSelectionQuestion
  | ChecklistItemFieldQuestion

export interface IntakeQuestion {
  id: string
  field: SchemaField
  scope: "preApp" | "contact" | "assister" | "person"
  sectionKey?: PersonSectionKey
  personIndex?: number
  complex?: IntakeQuestionComplex
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "intake-chat" | head -20
```

- [ ] **Step 3: Run the previously-failing test**

```bash
pnpm test -- --reporter=verbose components/application/aca3/__tests__/lang-flow.test.ts 2>&1 | tail -20
```

Expected: now compiles (test may still fail on logic, but import errors should be gone).

- [ ] **Step 4: Commit**

```bash
git add components/application/aca3/intake-chat-types.ts
git commit -m "refactor(aca3): add intake-chat-types.ts — shared IntakeQuestion + WizardData re-exports"
```

---

## Task 8: Extract `intake-chat-question-builder.ts`

**Files:**
- Create: `components/application/aca3/intake-chat-question-builder.ts`
- Modify: `components/application/aca3/intake-chat.tsx`

### What to extract

These functions handle how the chat turns wizard schema into a flat question queue, reads/writes values, and decides which question comes next. They are the "engine" of the intake chat.

| Symbol | Line in intake-chat.tsx | Purpose |
|---|---|---|
| `getQuestionRecord` | ~911 | Gets the WizardData record for a question |
| `updateQuestionRecord` | ~936 | Returns updated WizardData after write |
| `getChecklistSelectedLabels` | ~984 | Gets human-readable checklist selections |
| `readValue` | ~1000 | Reads a question's current value from data |
| `writeValue` | ~1028 | Returns new WizardData with a value written |
| `getAddressSiblingFieldIds` | ~1128 | Finds the sibling field IDs for an address group |
| `writeFieldById` | ~1144 | Writes a single field by ID across all scopes |
| `getComplexQuestionPrefix` | ~1278 | Prefix string for repeatable/checklist questions |
| `createRepeatableCountQuestion` | ~1289 | Factory for repeatable count sub-questions |
| `createChecklistSelectionQuestion` | ~1311 | Factory for checklist selection question |
| `createChecklistItemField` | ~1336 | Factory for a checklist item field |
| `collectChecklistQuestions` | ~1370 | Expands checklist field into question list |
| `collectQuestionsFromFields` | ~1410 | Walks schema fields → IntakeQuestion list |
| `buildQuestions` | ~1535 | Top-level: builds full question list for data |
| `buildContextValuesForQuestion` | ~1829 | Context values for conditional evaluation |
| `computeAnsweredQuestionIds` | ~1850 | Set of answered question IDs |
| `shouldSkipQuestionInChat` | ~1866 | True if a question should be skipped |
| `findNextPendingQuestion` | ~1887 | Finds the next unanswered question |
| `deriveSkippedFromLastAnswered` | ~1918 | Infers skipped IDs after an answer |

- [ ] **Step 1: Create `intake-chat-question-builder.ts`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import {
  ACA3_PERSON_SECTIONS_BY_ID,
  ACA3_SCHEMA,
  PERSON_SECTION_MAP,
  PERSON_STEP_SECTION_IDS,
} from "@/lib/constant"
import { evaluateConditionalRule } from "@/hooks/use-conditional"
import {
  clampPersonCount,
  ensurePersonCount,
  getActiveSubFields,
  makeDefaultPersonState,
  normalizeScalarFieldValue,
} from "./wizard-reducer"
import {
  type IntakeQuestion,
  type IntakeQuestionComplex,
  type RepeatableCountQuestion,
  type RepeatableFieldQuestion,
  type ChecklistSelectionQuestion,
  type ChecklistItemFieldQuestion,
} from "./intake-chat-types"
import type {
  FieldValue,
  FormRecord,
  PersonSectionKey,
  SchemaField,
  WizardData,
} from "./types"
```

Then paste the 19 extracted functions verbatim. Export all of them.

**Note on `getActiveSubFields`:** This function also exists in `form-wizard-context.tsx`. It should be imported from `wizard-reducer.ts` in both places. Check if `wizard-reducer.ts` exports it; if not, add it there and remove the duplicate from `form-wizard-context.tsx`.

- [ ] **Step 2: Update `intake-chat.tsx` — replace extracted code with imports**

Add to `intake-chat.tsx` imports:

```typescript
import {
  buildQuestions,
  computeAnsweredQuestionIds,
  deriveSkippedFromLastAnswered,
  findNextPendingQuestion,
  readValue,
  shouldSkipQuestionInChat,
  writeFieldById,
  writeValue,
} from "./intake-chat-question-builder"
```

Also import `IntakeQuestion` and related types:

```typescript
import type { IntakeQuestion, IntakeQuestionComplex } from "./intake-chat-types"
```

Delete the 19 extracted functions from `intake-chat.tsx`.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "intake-chat" | head -30
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/intake-chat-question-builder.ts \
        components/application/aca3/intake-chat.tsx
git commit -m "refactor(aca3): extract intake-chat-question-builder.ts — question queue engine"
```

---

## Task 9: Extract `intake-chat-answer-parser.ts` + remove duplicates

**Files:**
- Create: `components/application/aca3/intake-chat-answer-parser.ts`
- Modify: `components/application/aca3/intake-chat.tsx`

### Part A — Remove duplicate functions

`intake-chat.tsx` duplicates these functions that already exist in `wizard-reducer.ts`. Delete them from `intake-chat.tsx` and import from `wizard-reducer` instead:

| Duplicate in intake-chat.tsx | Already in wizard-reducer.ts |
|---|---|
| `normalizeScalarFieldValue` (~501) | ✅ exported |
| `seedFieldDefaults` (~526) | ✅ exported |
| `getRepeatableRowDefault` (~544) | ✅ exported |
| `makeDefaultPersonState` (~562) | ✅ exported |
| `clampPersonCount` (~594) | ✅ exported |
| `ensurePersonCount` (~604) | ✅ exported |
| `createInitialData` (~628) | ✅ exported |
| `createDraftWizardState` (~652) | ✅ exported |
| `getActiveSubFields` (~664) | ✅ exported |

Verify each is exported from `wizard-reducer.ts` before deleting:

```bash
grep -n "^export function\|^export const" \
  components/application/aca3/wizard-reducer.ts
```

For any that are not exported, add `export` to their declaration in `wizard-reducer.ts`.

Add to `intake-chat.tsx` imports:

```typescript
import {
  normalizeScalarFieldValue,
  seedFieldDefaults,
  getRepeatableRowDefault,
  makeDefaultPersonState,
  clampPersonCount,
  ensurePersonCount,
  createInitialData,
  createDraftWizardState,
  getActiveSubFields,
} from "./wizard-reducer"
```

### Part B — Extract answer parser

| Symbol | Purpose |
|---|---|
| `normalizeTwoDigitYear` | Two-digit year normalization |
| `toUsDateString` | Constructs MM/DD/YYYY string |
| `normalizeFlexibleDateInput` | Parses month-name + numeric date strings |
| `extractLikelyDateFromText` | Extracts dates from free text |
| `isUnknownValue` | True for "don't know" / "N/A" answers |
| `isFilledValue` | True for non-empty values |
| `evaluateConditionalRuleForQuestioning` | Conditional evaluation in chat context |
| `isRequiredInCurrentContext` | Required-field check for chat |
| `validateParsedFieldValue` | Validates a parsed chat answer |
| `normalizeYesNo` | "yes"/"no"/"y"/"n" → boolean |
| `normalizeOptionValue` | Fuzzy match input to option list |
| `parseCheckboxGroupValues` | "1, 3" or "a, c" → option array |
| `formatQuestionPrompt` | Builds the question text to display |
| `resolveSpeechLanguage` | Maps language → speech synthesis BCP-47 |
| `toSpeakableQuestionText` | Strips markdown for TTS |
| `parseAnswerValue` | Top-level: parses raw user input → FieldValue |
| `isDeclineAnswer` | True for "skip"/"decline"/etc. |
| `toTitleCase` | Capitalizes first letter of each word |
| `getFirstNameFromWizardData` | Extracts applicant's first name |
| `buildAcknowledgementPrefix` | "Thanks, [name]!" prefix |
| `applyInitialMemoExtraction` | Extracts fields from opening memo |
| `formatDisplayValue` | Formats a FieldValue for display |
| `restoreWizardDataFromRaw` | Restores WizardData from localStorage |
| `buildProfileFilledLabels` | List of fields pre-filled from profile |
| `applyProfileToWizardData` | Applies UserProfile → WizardData |

- [ ] **Step 1: Create `intake-chat-answer-parser.ts`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import {
  ACA3_SCHEMA,
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  MAX_PERSON_COUNT,
  PERSON_SECTION_MAP,
  SSN_PATTERN,
} from "@/lib/constant"
import { isSupportedLanguage, type SupportedLanguage } from "@/lib/i18n/languages"
import { evaluateConditionalRule } from "@/hooks/use-conditional"
import { normalizeNumberInput, parseDate, validateDobBounds } from "@/lib/utils/aca3-form"
import { formatCurrency, formatPhoneNumber, formatSsn, parseCurrency } from "@/lib/utils/input-format"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import {
  clampPersonCount,
  createInitialData,
  ensurePersonCount,
  makeDefaultPersonState,
} from "./wizard-reducer"
import type { IntakeQuestion } from "./intake-chat-types"
import type {
  FieldValue,
  FormRecord,
  PersonSectionKey,
  SchemaField,
  WizardData,
} from "./types"
import type { UserProfile } from "@/lib/user-profile/types"
```

Then paste all 25 functions verbatim. Export all of them.

- [ ] **Step 2: Update `intake-chat.tsx`**

Remove Part A duplicates (lines ~501–692 — verify exact range after prior deletions).

Add imports:

```typescript
import {
  normalizeScalarFieldValue,
  seedFieldDefaults,
  getRepeatableRowDefault,
  makeDefaultPersonState,
  clampPersonCount,
  ensurePersonCount,
  createInitialData,
  createDraftWizardState,
  getActiveSubFields,
} from "./wizard-reducer"

import {
  applyInitialMemoExtraction,
  applyProfileToWizardData,
  buildAcknowledgementPrefix,
  buildProfileFilledLabels,
  formatDisplayValue,
  formatQuestionPrompt,
  isDeclineAnswer,
  parseAnswerValue,
  restoreWizardDataFromRaw,
  toSpeakableQuestionText,
} from "./intake-chat-answer-parser"
```

Delete the Part B functions from `intake-chat.tsx`.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Check line count**

```bash
wc -l components/application/aca3/intake-chat.tsx
# Expected: < 600 lines
```

- [ ] **Step 5: Run tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add components/application/aca3/intake-chat-answer-parser.ts \
        components/application/aca3/intake-chat.tsx \
        components/application/aca3/wizard-reducer.ts
git commit -m "refactor(aca3): extract intake-chat-answer-parser.ts + remove wizard-reducer duplicates"
```

---

## Task 10: Extract `application-assistant-utils.ts`

**Files:**
- Create: `components/application/aca3/application-assistant-utils.ts`
- Modify: `components/application/aca3/application-assistant.tsx`

### What to extract

All constants and all exported utility functions (lines ~100–818). These are already tested in `__tests__/application-assistant-quick-replies.test.ts` and are importable independently of the React component.

| Symbol | Type | Line |
|---|---|---|
| `SECTION_LABELS` | const | ~101 |
| `SECTION_ORDER` | const | ~109 |
| `REQUIRED_DOCS` | const | ~111 |
| `ACTIVE_ASSISTANT_APPLICATION_KEY` | const | ~134 |
| `ASSISTANT_DRAFT_STORAGE_PREFIX` | const | ~135 |
| `LANGUAGE_LABELS` | const | ~153 |
| `SPEECH_LANG` | const | ~163 |
| `ASSISTANT_CONNECTION_FAILURE_MESSAGE` | **exported** const | ~318 |
| `detectInputFieldType` | func | ~176 |
| `formatPhone` | func | ~193 |
| `formatSSN` | func | ~201 |
| `formatDateDigits` | func | ~209 |
| `formatCalendarDate` | func | ~216 |
| `parseCalendarDate` | func | ~222 |
| `MONTH_MAP` | const | ~243 |
| `parseNaturalDate` | func | ~258 |
| `formatMoney` | func | ~297 |
| `isValidEmail` | func | ~305 |
| `getAssistantDraftCacheKey` | func | ~137 |
| `resolveInitialAssistantApplicationId` | func | ~141 |
| `getQuickRepliesForAssistantPrompt` | **exported** func | ~325 |
| `getNextMissingApplicationQuestion` | **exported** func | ~357 |
| `hasPatchValueChanged` | func | ~385 |
| `getImmediateFieldPatchFromAnswer` | **exported** func | ~395 |
| `recoverImmediateFieldsFromMessages` | **exported** func | ~490 |
| `getSectionFields` | func | ~556 |
| `isSectionComplete` | func | ~592 |
| `computeProgress` | func | ~612 |
| `buildPreFillFromProfile` | func | ~636 |
| `describedAppliedFields` | func | ~652 |
| `hasDocumentUploadPrompt` | **exported** func | ~662 |
| `sanitizeAssistantDraftMessages` | **exported** func | ~666 |
| `createAssistantDraftState` | func | ~681 |
| `readAssistantDraftState` | func | ~701 |
| `hasMeaningfulDraftValue` | func | ~729 |
| `hasPersistableAssistantDraft` | **exported** func | ~738 |

- [ ] **Step 1: Create `application-assistant-utils.ts`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { createUuid } from "@/lib/utils/random-id"
import { formatCurrency, formatPhoneNumber, formatSsn, parseCurrency } from "@/lib/utils/input-format"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import {
  summarizeCollectedFields,
  detectCurrentSection,
  type FormSection,
} from "@/lib/masshealth/form-sections"
import { containsSsnLikeContent } from "@/lib/agents/sensitive-input"
import {
  type ApplicationFormData,
  type HouseholdMember,
  type IncomeSource,
  initialApplicationFormData,
} from "@/lib/redux/features/application-slice"
import type { UserProfile } from "@/lib/user-profile/types"
import type { AssistantMessage, AssistantDraftState } from "./application-assistant-types"
```

Then paste all 36 constants + functions verbatim. Export everything that was previously exported.

**Important:** The types `AssistantMessage`, `AssistantDraftState`, `QuickReply`, etc. must come from a types file. See Task 12 note — inline the types in this file or reference `application-assistant.tsx` (but avoid circular imports). Safest: keep the type definitions in `application-assistant.tsx` and import them here from it, OR define them in a new `application-assistant-types.ts`. For simplicity, copy the type definitions inline at the top of this file.

- [ ] **Step 2: Update `application-assistant.tsx`**

Add import:

```typescript
import {
  ACTIVE_ASSISTANT_APPLICATION_KEY,
  ASSISTANT_CONNECTION_FAILURE_MESSAGE,
  ASSISTANT_DRAFT_STORAGE_PREFIX,
  LANGUAGE_LABELS,
  REQUIRED_DOCS,
  SECTION_LABELS,
  SECTION_ORDER,
  SPEECH_LANG,
  buildPreFillFromProfile,
  computeProgress,
  createAssistantDraftState,
  describedAppliedFields,
  detectInputFieldType,
  formatCalendarDate,
  formatDateDigits,
  formatMoney,
  formatPhone,
  formatSSN,
  getAssistantDraftCacheKey,
  getImmediateFieldPatchFromAnswer,
  getNextMissingApplicationQuestion,
  getQuickRepliesForAssistantPrompt,
  hasDocumentUploadPrompt,
  hasMeaningfulDraftValue,
  hasPersistableAssistantDraft,
  hasPatchValueChanged,
  isValidEmail,
  parseCalendarDate,
  parseNaturalDate,
  readAssistantDraftState,
  recoverImmediateFieldsFromMessages,
  resolveInitialAssistantApplicationId,
  sanitizeAssistantDraftMessages,
} from "./application-assistant-utils"
```

Re-export the previously-exported symbols so external imports keep working:

```typescript
export {
  ASSISTANT_CONNECTION_FAILURE_MESSAGE,
  getQuickRepliesForAssistantPrompt,
  getNextMissingApplicationQuestion,
  getImmediateFieldPatchFromAnswer,
  recoverImmediateFieldsFromMessages,
  hasDocumentUploadPrompt,
  sanitizeAssistantDraftMessages,
  hasPersistableAssistantDraft,
} from "./application-assistant-utils"
```

Delete the 36 extracted constants + functions from `application-assistant.tsx`.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "assistant" | head -30
```

- [ ] **Step 4: Run tests — specifically the utility tests**

```bash
pnpm test -- --reporter=verbose \
  components/application/aca3/__tests__/application-assistant-quick-replies.test.ts 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/application-assistant-utils.ts \
        components/application/aca3/application-assistant.tsx
git commit -m "refactor(aca3): extract application-assistant-utils.ts — all utility functions + constants"
```

---

## Task 11: Extract `application-assistant-message-bubble.tsx`

**Files:**
- Create: `components/application/aca3/application-assistant-message-bubble.tsx`
- Modify: `components/application/aca3/application-assistant.tsx`

### What to extract

| Symbol | Line | Purpose |
|---|---|---|
| `CompassIcon` | ~321 | SVG compass icon |
| `MessageBubble` | ~1979 | Renders user/assistant/upload-prompt message |

`MessageBubble` depends on: `DocumentUploader`, `CompassIcon`, `AssistantMessage` type.

- [ ] **Step 1: Create `application-assistant-message-bubble.tsx`**

```typescript
/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { User } from "lucide-react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentUploader } from "@/components/application/document-uploader"
import type { AssistantMessage } from "./application-assistant-types"
```

Paste `CompassIcon` and `MessageBubble` verbatim. Export both.

**Note on `AssistantMessage` type:** This type is currently defined in `application-assistant.tsx`. After Task 10 you may have inlined it in `application-assistant-utils.ts`. Either way, create a thin `application-assistant-types.ts` to hold the shared types:

```typescript
// components/application/aca3/application-assistant-types.ts
export type MessageRole = "user" | "assistant"
// ... (paste type definitions from application-assistant.tsx lines 61-98)
```

Then both `application-assistant-utils.ts` and `application-assistant-message-bubble.tsx` import from `application-assistant-types.ts`.

- [ ] **Step 2: Update `application-assistant.tsx`**

```typescript
import { CompassIcon, MessageBubble } from "./application-assistant-message-bubble"
```

Delete `CompassIcon` and `MessageBubble` from `application-assistant.tsx`.

- [ ] **Step 3: Verify TypeScript + check line count**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
wc -l components/application/aca3/application-assistant.tsx
# Expected: < 1200 lines (was 2055)
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -30
```

- [ ] **Step 5: Commit**

```bash
git add components/application/aca3/application-assistant-message-bubble.tsx \
        components/application/aca3/application-assistant-types.ts \
        components/application/aca3/application-assistant.tsx
git commit -m "refactor(aca3): extract application-assistant-message-bubble.tsx + types"
```

---

## Task 12: Final verification

- [ ] **Check all file sizes**

```bash
wc -l components/application/aca3/*.tsx components/application/aca3/*.ts | sort -rn | head -20
```

Expected targets:

| File | Target |
|---|---|
| `form-wizard.tsx` | < 700 |
| `form-wizard-field-renderer.tsx` | < 1100 |
| `form-wizard-submit-step.tsx` | < 600 |
| `form-wizard-steps.tsx` | < 700 |
| `form-wizard-validation.tsx` | < 550 |
| `intake-chat.tsx` | < 600 |
| `application-assistant.tsx` | < 1200 |

- [ ] **Run full TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Run full test suite**

```bash
pnpm test -- --reporter=verbose 2>&1 | tail -40
```

Expected: same pass/fail as baseline.

- [ ] **Verify public API still works — spot-check external consumers**

```bash
pnpm exec tsc --noEmit 2>&1 | grep "check/page\|new/page\|social-worker" | head -10
```

Expected: no errors in those page files.

- [ ] **Final commit**

```bash
git add -A
git commit -m "refactor(aca3): complete component decomposition — 8875 lines across 3 files → 14 focused modules"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `form-wizard.tsx` (3926L) → 6 sub-files
- ✅ `intake-chat.tsx` (2894L) → 3 sub-files + duplicate removal
- ✅ `application-assistant.tsx` (2055L) → 3 sub-files
- ✅ Public API preserved for all external consumers
- ✅ `intake-chat-types.ts` created (fixes failing `lang-flow.test.ts` import)
- ✅ Duplicate wizard-reducer functions removed from `intake-chat.tsx`

**Placeholder scan:** None found. Every step has exact file paths, exact code headers, exact commands.

**Type consistency:**
- `FormContext` / `useFormContext` — defined in `form-wizard-context.tsx`, imported in field renderer, validation, steps, review, submit, and `form-wizard.tsx`
- `validateFieldsRecursive` — defined in `form-wizard-validation.tsx`, imported in `form-wizard-steps.tsx` (PersonStepTabs uses it)
- `getEngineRuleFixTarget` — defined in `form-wizard-review-step.tsx`, imported in `form-wizard-submit-step.tsx`
- `IntakeQuestion` — defined in `intake-chat-types.ts`, used in both `intake-chat-question-builder.ts` and `intake-chat-answer-parser.ts`
- `AssistantMessage` — defined in `application-assistant-types.ts`, imported in `application-assistant-utils.ts` and `application-assistant-message-bubble.tsx`
