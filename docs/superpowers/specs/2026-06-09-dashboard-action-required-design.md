# Dashboard Action Required — Design Spec
**Date:** 2026-06-09  
**Status:** Approved

---

## Problem

The "Action Required" card on the customer dashboard only surfaces `rfi_requested` applications. Users have no visibility into stale drafts, social-worker-made changes that need confirmation, upcoming MassHealth deadlines, or future security enforcement items. The card shows "No actions required" in nearly every session.

---

## Goals

1. Surface the right action at the right time — ordered by urgency.
2. Add a SW-modified confirmation flow so customers know when a social worker has changed their data.
3. Add security enforcement placeholders for future features.
4. Keep the layout unchanged — enrich the existing card, do not add new panels.

---

## Priority Order (highest → lowest)

| Priority | Type | Trigger | CTA |
|---|---|---|---|
| 1 | **MassHealth deadline** | Known enrollment/renewal deadline within 30 days for an active application | Open application |
| 2 | **RFI requested** | `status === 'rfi_requested'` | Review & upload docs |
| 3 | **SW-modified pending confirmation** | `needs_customer_review === true` on an application | Review changes |
| 4 | **Stale draft** | `status === 'draft'` AND `last_saved_at` (or `created_at`) is >14 days ago | Continue application |
| 5 | **Security placeholders** | Always shown (static), but visually de-emphasized | Placeholder / coming soon |

Multiple items can be shown simultaneously (e.g., one deadline item + two stale drafts). Each renders as a separate row inside the card.

---

## Action Item Row Design

Each row has:
- **Left accent border color**: red (deadline, RFI), amber (SW-change), gray (stale draft, security)
- **Icon**: matches urgency (AlertCircle=red, Clock=amber, FileText=gray, Shield=security)
- **Short label**: 1 line, e.g. "Application deadline in 12 days"
- **Sub-label**: application type + ID, or security feature name
- **CTA button**: right-aligned, small, links to the relevant page

When the list is empty, show: "No actions required — you're all set."

---

## DB Changes

### Migration: `needs_customer_review` on applications

Add two columns to the `applications` table:

```sql
ALTER TABLE applications
  ADD COLUMN needs_customer_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sw_last_modified_at TIMESTAMPTZ;
```

**Set when:** a social worker saves changes to a draft application (via the SW patient detail page).  
**Cleared when:** the customer visits the application review page and clicks "Confirm — everything looks correct."  
**Index:** `CREATE INDEX ON applications(user_id) WHERE needs_customer_review = true;`

---

## MassHealth Deadline Source

Deadlines are stored as a small static constant object in `lib/masshealth/deadlines.ts`:

```ts
// Each entry: { label, isoDate }
export const MASSHEALTH_DEADLINES = [
  { label: "Annual renewal window closes", isoDate: "2026-12-31" },
  // Add more as needed
]
```

The dashboard checks: for each active (non-denied, non-approved) application, find the nearest deadline within 30 days. One row per deadline found.

---

## Security Placeholder Items

Two static rows, always rendered at the bottom of the action list, visually de-emphasized (opacity-60, no CTA link, "Coming soon" badge):

1. **Review active login sessions** — "Manage where your account is signed in" (Shield icon)
2. **Verify recovery options** — "Ensure your email and backup codes are up to date" (Lock icon)

These are placeholders: no backend logic, no routing. They establish the visual pattern for future security enforcement features.

---

## Components

### `ActionRequiredCard` (new, `components/dashboard/ActionRequiredCard.tsx`)
- Accepts `applications: ApplicationListItem[]` and `language: Language`
- Computes action items internally (deadline check, RFI filter, SW-review filter, stale-draft filter)
- Renders the prioritized list or the empty state
- Replaces the inline card JSX at line 676–706 of `customer/dashboard/page.tsx`

### `ActionRequiredRow` (internal to `ActionRequiredCard`)
- Props: `priority`, `icon`, `label`, `sublabel`, `href`, `ctaLabel`, `isPlaceholder`

---

## SW Confirmation Flow

When `needs_customer_review` is true, the action item links to `/customer/status/[id]` (existing application status page). On that page, add a banner:

> "A social worker updated information in this application on [date]. Please review the details below and confirm everything is correct."

With a "Confirm — looks correct" button that calls `PATCH /api/applications/[id]` → sets `needs_customer_review = false`.

---

## API Changes

- `GET /api/applications` response: include `needsCustomerReview` and `swLastModifiedAt` fields in each record
- `PATCH /api/applications/[id]` (new or extend existing): accept `{ confirmCustomerReview: true }` to clear the flag
- SW patient edit endpoint (existing): set `needs_customer_review = true` and `sw_last_modified_at = now()` when saving

---

## Testing

- Unit tests: action item computation (deadline threshold, 14-day stale check, SW-review flag)
- E2E: stale draft row appears after date manipulation; SW-confirm banner appears and clears on confirm button click

---

## Out of Scope

- Social worker dashboard changes (separate initiative)
- Push notifications for action items (future)
- Admin-managed deadline configuration (future — hardcoded constants are sufficient)
