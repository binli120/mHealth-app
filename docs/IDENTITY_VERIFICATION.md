# Identity Verification — Technical Design Document

**Author:** Bin Lee
**Feature branch:** MH-codereview-1
**Status:** Implemented

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [AAMVA Standard](#3-aamva-standard)
4. [Scoring Algorithm](#4-scoring-algorithm)
5. [Cross-Device QR Flow](#5-cross-device-qr-flow)
6. [Profile Auto-Fill Flow](#6-profile-auto-fill-flow)
7. [API Reference](#7-api-reference)
8. [Database Schema](#8-database-schema)
9. [Component Hierarchy](#9-component-hierarchy)
10. [UX States & Gate Logic](#10-ux-states--gate-logic)
11. [Security Considerations](#11-security-considerations)
12. [File Map](#12-file-map)

---

## 1. Overview

HealthCompass MA uses **driver's license barcode scanning** to verify applicant identity before application submission. The implementation is fully self-hosted — no third-party identity service (ID.me, Persona, etc.) is required.

### Why barcode scanning?

Every US and Canadian driver's license and state ID issued under the AAMVA DL/ID Card Design Standard carries a **PDF417 2D barcode** on the back. This barcode encodes the holder's name, date of birth, address, and license number in a machine-readable format. Scanning this barcode and cross-referencing it against the applicant's on-file profile gives a reliable, privacy-preserving identity signal at zero marginal cost.

### What is verified

| Field | Weight |
|---|---|
| Last name | 30 pts |
| Date of birth | 30 pts |
| First name | 20 pts |
| Street address or ZIP code | 20 pts |

A total score ≥ 70 earns **verified** status. 50–69 goes to **needs\_review** (manual staff queue). Below 50 is **failed**.

### Where verification is required

| Location | Behavior |
|---|---|
| Application submission | Hard gate — cannot submit without `verified` or `needs_review` status |
| Customer dashboard | Soft banner — prompts user to verify; dismisses when verified |
| Profile page | Optional scan-to-auto-fill; runs verify-on-save if barcode is present |
| Registration | Not required — users can explore before verifying |

---

## 2. Architecture

### System components

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Desktop)                                              │
│                                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────┐  │
│  │  LicenseScannerModal│    │  PersonalSection (Profile)   │  │
│  │  ┌─────────────┐   │    │  ┌──────────────────────────┐ │  │
│  │  │ Camera tab  │   │    │  │  ProfileScanModal         │ │  │
│  │  │ (ZXing)     │   │    │  │  (Camera + Phone tabs)    │ │  │
│  │  ├─────────────┤   │    │  └──────────────────────────┘ │  │
│  │  │ Phone tab   │   │    │  Auto-fill + verify-on-save   │  │
│  │  │ (QR + poll) │   │    └──────────────────────────────┘  │
│  │  └─────────────┘   │                                       │
│  └─────────────────────┘                                       │
│           │ POST /api/identity/verify-license                  │
│           │ POST /api/identity/mobile-session                  │
│           │ GET  /api/identity/mobile-session?token=           │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js API Routes                                             │
│                                                                 │
│  POST /api/identity/verify-license   ─── direct scan path      │
│  POST /api/identity/mobile-session   ─── create QR session     │
│  GET  /api/identity/mobile-session   ─── desktop poll          │
│  POST /api/identity/mobile-verify/[token] ── mobile callback   │
│  GET  /api/identity/qrcode           ─── QR code SVG           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
            ┌───────────┴────────────┐
            ▼                        ▼
┌─────────────────────┐  ┌──────────────────────────┐
│  lib/identity/      │  │  PostgreSQL (Supabase)   │
│  aamva-parser.ts    │  │                          │
│  verify-license.ts  │  │  applicants              │
└─────────────────────┘  │  identity_verification_  │
                         │    attempts              │
┌─────────────────────┐  │  mobile_verify_sessions  │
│  Browser (Mobile)   │  └──────────────────────────┘
│                     │
│  /verify/mobile/    │
│  [token]/page.tsx   │
│  (ZXing scan)       │
└──────────┬──────────┘
           │ POST /api/identity/mobile-verify/[token]
           └──────────────────────────────────────────►  API Routes
```

### Technology choices

| Concern | Solution | Rationale |
|---|---|---|
| PDF417 decode | `@zxing/browser` + `@zxing/library` | Already in dependencies; open-source; handles continuous camera scan |
| QR code generation | `bwip-js` (server-side) | Already in dependencies; no new packages needed |
| Identity standard | AAMVA DL/ID Card Design Standard | Covers all 50 US states + DC + territories |
| PII storage | SHA-256 hash of license number only | License number never stored in plain text |
| Session security | Random 24-byte base64url token, 10-min TTL | Short-lived; bound to authenticated user |

---

## 3. AAMVA Standard

The **AAMVA DL/ID Card Design Standard** (ANSI/AAMVA D20) defines the layout of the PDF417 barcode printed on the back of every US driver's license and state ID. All 50 states comply.

### Barcode structure

```
@\n\x1e\rANSI 636000...
DL                  ← subfile designator
DAQ12345678         ← license number (DAQ)
DCSSmith            ← last name (DCS)
DACJohn             ← first name (DAC)
DBB19850315         ← date of birth (DBB) — MMDDYYYY or CCYYMMDD
DAG123 Main St      ← street address (DAG)
DAIBoston           ← city (DAI)
DAJMA               ← state (DAJ)
DAK021011234        ← ZIP+4 (DAK)
DBA20280315         ← expiration date (DBA)
...
```

### Key field codes

| Code | Field | Notes |
|---|---|---|
| `DCS` | Last name | Truncated to 40 chars on some cards |
| `DAC` | First name | |
| `DAD` | Middle name / initial | Optional |
| `DBB` | Date of birth | MMDDYYYY or CCYYMMDD depending on state |
| `DBA` | Expiration date | Same date formats |
| `DAQ` | License/ID number | |
| `DAG` | Street address | |
| `DAI` | City | |
| `DAJ` | State | 2-letter code |
| `DAK` | ZIP code | First 5 digits used |

### Date format detection

Some states encode dates as `CCYYMMDD` (e.g. `19850315`), others as `MMDDYYYY` (e.g. `03151985`). The parser detects the format by checking whether the first 4 characters look like a plausible year (1900–2099):

```typescript
// lib/identity/aamva-parser.ts
function parseBarcodeDate(raw: string): string | undefined {
  if (raw.length < 8) return undefined
  const firstFour = parseInt(raw.slice(0, 4), 10)
  const isYearFirst = firstFour >= 1900 && firstFour <= 2099
  if (isYearFirst) {
    // CCYYMMDD → YYYY-MM-DD
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  }
  // MMDDYYYY → YYYY-MM-DD
  return `${raw.slice(4, 8)}-${raw.slice(0, 2)}-${raw.slice(2, 4)}`
}
```

---

## 4. Scoring Algorithm

**File:** `lib/identity/verify-license.ts`

The verifier compares fields extracted from the license barcode against the applicant's profile stored in the database. Each field match awards points:

```
score = Σ(weight × match)  where match ∈ {0, 1}
```

### Field weights

```typescript
const WEIGHTS = {
  lastName:    30,   // strongest — hardest to fake
  dateOfBirth: 30,   // strongest — date is fixed
  firstName:   20,
  address:     20,   // street number OR zip match = full address points
}
```

### Name normalization

Names are compared after:
1. Lowercasing
2. Stripping diacritics (`café` → `cafe`)
3. Trimming whitespace

This handles encoding differences between the barcode and the profile (e.g. accents, extra spaces).

### Date normalization

Dates from the barcode (AAMVA format) and from the profile (DB timestamp or `MM/DD/YYYY`) are both converted to `YYYY-MM-DD` before comparison.

### Address matching

Full address comparison is flexible — either the street number token OR the ZIP code must match. This accommodates abbreviations and apartment-number formatting differences:

```typescript
const streetNumberMatch = extractStreetNumber(license.addressStreet) ===
                          extractStreetNumber(profile.addressStreet)
const zipMatch = normalize(license.addressZip?.slice(0, 5)) ===
                 normalize(profile.addressZip?.slice(0, 5))
address: streetNumberMatch || zipMatch
```

### Score thresholds

| Score | Status | Outcome |
|---|---|---|
| ≥ 70 | `verified` | Application can be submitted |
| 50–69 | `needs_review` | Enters staff review queue; application can still be submitted |
| < 50 | `failed` | Must retry |

### Expiry check

If the license expiration date is in the past, the attempt records `isExpired: true`. Expired licenses do not automatically fail — the score still reflects field matches — but the UI displays a warning and staff can see the flag in the review queue.

---

## 5. Cross-Device QR Flow

When a user on a desktop cannot easily point their laptop camera at the back of their license, they can scan a QR code with their phone instead.

### Sequence diagram

```
Desktop Browser          API Server              Mobile Browser
      │                      │                         │
      │  POST /mobile-session │                         │
      │─────────────────────►│                         │
      │  {token, expiresAt,  │                         │
      │   mobileUrl}         │                         │
      │◄─────────────────────│                         │
      │                      │                         │
      │  Display QR code     │                         │
      │  (encodes mobileUrl) │                         │
      │                      │                         │
      │  [User scans QR      │                         │
      │   with phone camera] │                         │
      │                      │  GET /verify/mobile/    │
      │                      │  [token]                │
      │                      │◄────────────────────────│
      │                      │  (page load, no auth)   │
      │                      │                         │
      │                      │  [User holds phone      │
      │                      │   camera over DL barcode│
      │                      │   → ZXing decodes PDF417│
      │                      │   → green flash + stop] │
      │                      │                         │
      │                      │  POST /mobile-verify/   │
      │                      │  [token]                │
      │                      │  {rawBarcode: "..."}    │
      │                      │◄────────────────────────│
      │                      │                         │
      │                      │  parse → verify → save  │
      │                      │  completeSession()      │
      │                      │                         │
      │                      │  {ok, status, score}    │
      │                      │─────────────────────────►
      │                      │                         │
      │                      │  "Verified! Return to   │
      │  GET /mobile-session │   desktop."             │
      │  ?token=xxx (poll)   │                         │
      │─────────────────────►│                         │
      │  {status:"completed",│                         │
      │   verifyStatus,      │                         │
      │   extractedData}     │                         │
      │◄─────────────────────│                         │
      │                      │                         │
      │  Update UI: verified │                         │
      │  Apply auto-fill     │                         │
```

### Session lifecycle

```
created  →  pending  →  completed
                    ↘  expired (TTL 10 min or manual expiry)
                    ↘  failed (verification failed on mobile)
```

When a new session is created for a user, any existing `pending` sessions for that user are immediately set to `expired` (prevents stale QR codes from being used).

### Desktop polling

The desktop polls `GET /api/identity/mobile-session?token=xxx` every **2 seconds**. The countdown timer in the UI updates every second. Polling stops when:
- `status` becomes `completed` or `failed`
- `status` becomes `expired`
- The user closes the modal

### QR code generation

`GET /api/identity/qrcode?url=<encoded>` generates a QR SVG server-side using `bwip-js`:

```typescript
const svg = bwipjs.toSVG({
  bcid: "qrcode",
  text: decodedUrl,
  scale: 3,
  eclevel: "M",
})
```

The endpoint is **origin-locked** — it only accepts URLs that begin with the application's own `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_VERCEL_URL`, preventing open-redirect abuse.

---

## 6. Profile Auto-Fill Flow

When a user visits their profile page, they can scan their DL barcode to automatically populate name and address fields.

### Camera scan path

```
ProfileScanModal (Camera tab)
  └─ ZXing continuous scan
       └─ PDF417 detected → barcodeFlash (750ms green overlay)
            └─ parseAamvaBarcode() [client-side, no API call]
                 └─ Preview card: "John Smith — 123 Main St, Boston, MA"
                      └─ User clicks "Apply to Profile"
                           └─ PersonalSection fills form fields
                           └─ scannedFields Set tracks filled fields
                           └─ pendingRawBarcode stored
                           └─ "From license" badge shown per field
```

### Phone scan path

```
ProfileScanModal (Phone tab)
  └─ POST /api/identity/mobile-session → QR code
       └─ Poll GET /api/identity/mobile-session?token=
            └─ when extractedData present → Preview card
                 └─ User clicks "Apply to Profile"
                      └─ Same as camera path, but no rawBarcode stored
                           (verify already happened server-side)
```

### Verify-on-save

When the user clicks **Save Profile** and a `pendingRawBarcode` is stored (from a camera scan where verification has not yet run):

```
handleSave()
  1. PUT /api/profile  (save profile to DB first)
  2. if (pendingRawBarcode && identityStatus !== "verified")
       POST /api/identity/verify-license {rawBarcode}
       if verified → success toast + sessionVerified = true
       else        → "submitted for review" toast
```

The profile is saved **before** calling the verify API. This ensures the DB has the latest matching data when the verifier loads the applicant profile, avoiding a false-positive mismatch between the just-scanned license and stale profile data.

### Field badges

Each auto-filled field displays a `ScanBadge` ("From license" label) with a subtle ring highlight. The badge is cleared if the user manually edits that field, tracked via a `scannedFields: Set<string>` state.

---

## 7. API Reference

### POST /api/identity/verify-license

Direct scan from desktop camera or upload.

**Auth:** Required (session cookie)

**Request**
```json
{ "rawBarcode": "<raw PDF417 barcode string>" }
```

**Response 200**
```json
{
  "ok": true,
  "status": "verified",        // "verified" | "needs_review" | "failed"
  "score": 80,
  "breakdown": {
    "firstName": true,
    "lastName": true,
    "dateOfBirth": true,
    "address": false
  },
  "isExpired": false,
  "extractedName": "John Smith",
  "verifiedAt": "2026-04-03T12:00:00Z",
  "message": "Identity verified!"
}
```

**Error responses**

| Status | Condition |
|---|---|
| 400 | `rawBarcode` missing |
| 404 | No applicant profile found |
| 422 | Barcode could not be parsed |
| 500 | Internal error |

---

### GET /api/identity/verify-license

Get current identity status for authenticated user.

**Auth:** Required

**Response 200**
```json
{
  "ok": true,
  "status": "verified",
  "score": 80,
  "verifiedAt": "2026-04-03T12:00:00Z"
}
```

---

### POST /api/identity/mobile-session

Create a cross-device verification session.

**Auth:** Required

**Response 200**
```json
{
  "ok": true,
  "token": "abc123def456",
  "expiresAt": "2026-04-03T12:10:00Z",
  "mobileUrl": "https://app.example.com/verify/mobile/abc123def456"
}
```

---

### GET /api/identity/mobile-session?token=xxx

Poll session status (desktop poller).

**Auth:** Required (user must own the session)

**Response 200**
```json
{
  "ok": true,
  "status": "completed",
  "verifyStatus": "verified",
  "verifyScore": 80,
  "verifyBreakdown": { "firstName": true, "lastName": true, "dateOfBirth": true, "address": false },
  "extractedData": {
    "firstName": "John",
    "lastName": "Smith",
    "addressLine1": "123 Main St",
    "city": "Boston",
    "state": "MA",
    "zip": "02101"
  },
  "expiresAt": "2026-04-03T12:10:00Z",
  "completedAt": "2026-04-03T12:03:45Z"
}
```

---

### POST /api/identity/mobile-verify/[token]

Called by the mobile scan page. No authentication — token-based.

**Request**
```json
{ "rawBarcode": "<raw PDF417 barcode string>" }
```

**Response 200**
```json
{
  "ok": true,
  "status": "verified",
  "score": 80,
  "extractedName": "John Smith",
  "message": "Identity verified! You can return to the desktop."
}
```

**Error responses**

| Status | Condition |
|---|---|
| 400 | Token blank or `rawBarcode` missing |
| 404 | Session not found |
| 409 | Session already used |
| 410 | Session expired |
| 422 | Barcode parse failure |
| 500 | Internal error |

---

### GET /api/identity/qrcode?url=xxx

Server-side QR code generation.

**Auth:** None required

**Response:** `image/svg+xml` — QR code encoding the provided URL

**Security:** Origin-locked — rejects URLs not starting with `NEXT_PUBLIC_APP_URL`.

---

## 8. Database Schema

### applicants table (additional columns)

```sql
ALTER TABLE applicants
  ADD COLUMN identity_status       TEXT     NOT NULL DEFAULT 'unverified'
    CHECK (identity_status IN ('unverified', 'pending', 'verified', 'failed')),
  ADD COLUMN identity_verified_at  TIMESTAMPTZ,
  ADD COLUMN identity_provider     TEXT     DEFAULT 'dl_barcode',
  ADD COLUMN identity_score        SMALLINT,        -- 0–100
  ADD COLUMN dl_number_hash        TEXT,            -- SHA-256, never plain text
  ADD COLUMN dl_expiration_date    DATE,
  ADD COLUMN dl_issuing_state      TEXT;
```

### identity_verification_attempts

Append-only audit log — one row per scan attempt.

```sql
CREATE TABLE identity_verification_attempts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id      UUID        NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,

  status            TEXT        NOT NULL CHECK (status IN ('verified', 'needs_review', 'failed')),
  score             SMALLINT    NOT NULL,
  breakdown         JSONB       NOT NULL DEFAULT '{}',
  -- e.g. {"firstName":true,"lastName":true,"dateOfBirth":true,"address":false}

  dl_number_hash    TEXT,               -- SHA-256 of license number
  dl_expiration_date DATE,
  dl_issuing_state  TEXT,
  is_expired        BOOLEAN     NOT NULL DEFAULT FALSE,

  attempted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        TEXT,
  user_agent        TEXT
);
```

### mobile_verify_sessions

Short-lived cross-device sessions.

```sql
CREATE TABLE mobile_verify_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT        NOT NULL UNIQUE
                              DEFAULT encode(gen_random_bytes(24), 'base64url'),
  user_id         UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  applicant_id    UUID        NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,

  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),

  verify_status   TEXT        CHECK (verify_status IN ('verified', 'needs_review', 'failed')),
  verify_score    SMALLINT,
  verify_breakdown JSONB,

  -- Demographic fields extracted from the license — returned to desktop for auto-fill
  extracted_data  JSONB,
  -- { firstName, lastName, addressLine1, city, state, zip }

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  completed_at    TIMESTAMPTZ
);
```

### staff review view

```sql
CREATE OR REPLACE VIEW identity_pending_review AS
  SELECT
    a.id              AS applicant_id,
    a.first_name,
    a.last_name,
    a.identity_status,
    a.identity_score,
    a.dl_expiration_date,
    a.dl_issuing_state,
    iva.attempted_at  AS last_attempt_at,
    iva.breakdown
  FROM applicants a
  LEFT JOIN LATERAL (
    SELECT breakdown, attempted_at
    FROM identity_verification_attempts
    WHERE applicant_id = a.id
    ORDER BY attempted_at DESC
    LIMIT 1
  ) iva ON TRUE
  WHERE a.identity_status IN ('pending', 'failed');
```

### Row-Level Security

| Table | Policy | Rule |
|---|---|---|
| `identity_verification_attempts` | `owner_select` | `can_access_applicant(applicant_id)` |
| `identity_verification_attempts` | `staff_all` | `is_staff()` |
| `mobile_verify_sessions` | `owner` | `user_id = auth.uid()` |
| `mobile_verify_sessions` | `staff` | `is_staff()` |

### Migrations

```bash
# Apply in order:
database/identity_verification_schema.sql
database/migrations/add_mobile_verify_sessions.sql
database/migrations/add_mobile_session_extracted_data.sql
```

---

## 9. Component Hierarchy

```
app/customer/dashboard/page.tsx
  └─ IdentityVerificationBanner          # soft prompt; "Verify Now" CTA
       └─ LicenseScannerModal            # full scanner (3 tabs)
            ├─ Camera tab
            │    └─ ZXing continuous scan
            │    └─ Box-shadow cutout overlay + scan-line animation
            │    └─ Result card (score bar, breakdown grid)
            ├─ Phone tab
            │    └─ QR code <img> from /api/identity/qrcode
            │    └─ 2s poll → PhoneResultCard
            │    └─ Countdown timer
            └─ Upload tab
                 └─ ZXing image decode from <input type="file">

app/application/aca3/form-wizard.tsx
  └─ ValidateAndSubmitStep
       ├─ IdentityVerificationBanner     # shown when not verified
       └─ Submit button → openScanner() if not verified

components/user-profile/PersonalSection.tsx
  └─ Scan banner ("Auto-fill from license")
  └─ ProfileScanModal                   # compact 2-tab scanner
       ├─ Camera tab  → parseAamvaBarcode() client-side → preview → apply
       └─ Phone tab   → QR session → poll extractedData → preview → apply
  └─ ScanBadge per auto-filled field
  └─ IdentityStatusPill in avatar row

app/verify/mobile/[token]/page.tsx      # mobile-only page
  └─ States: loading → ready → scanning → processing → success/failed
  └─ ZXing continuous scan
  └─ Box-shadow cutout + scan-line animation
  └─ 750ms green flash on detection
```

---

## 10. UX States & Gate Logic

### Identity status states

| Status | Badge color | Banner message |
|---|---|---|
| `unverified` | Amber | "Verify your identity to submit your application" |
| `pending` (needs\_review) | Blue | "Your identity is under review" |
| `verified` | Emerald | Hidden (or "Identity Verified" if `showWhenVerified` prop) |
| `failed` | Red/Destructive | "Verification failed — please try again" |

### Application submission gate

```typescript
// form-wizard.tsx
const identityVerified =
  identityStatus === "verified" || identityStatus === "pending"

const canSubmit =
  !isSubmitting &&
  !hasErrors &&
  identityVerified      // ← hard gate

// Submit button onClick:
if (!identityVerified) {
  reduxDispatch(openScanner())   // open scanner instead of submit dialog
  return
}
```

Both `verified` and `needs_review` (mapped to `pending` in Redux) allow submission. The application enters a staff review queue for the `needs_review` case.

### Profile auto-fill badge lifecycle

```
field filled by scan  →  ScanBadge shown + ring highlight
user edits field      →  scannedFields.delete(field) → badge removed
user saves profile    →  if pendingRawBarcode → verify-on-save → badge replaced by status pill
```

---

## 11. Security Considerations

### No PII stored from the license

The only license data persisted to the database is:
- `dl_number_hash` — SHA-256 hash of the license number (one-way, non-reversible)
- `dl_expiration_date` — date only, no name or address
- `dl_issuing_state` — 2-character state code

Name, address, and date-of-birth extracted from the barcode are used only in-memory during the verification computation and never written to the database.

### Session token security

- Tokens are 24 random bytes encoded as base64url (192 bits of entropy)
- TTL is 10 minutes from creation
- Each new session immediately expires any existing pending sessions for the same user (prevents token accumulation)
- The mobile endpoint (`POST /mobile-verify/[token]`) requires no authentication, but the token itself serves as the credential — guessing a 192-bit token is computationally infeasible
- Desktop polling requires full authentication AND token ownership (`WHERE token = $1 AND user_id = $2`)

### QR code origin lock

`GET /api/identity/qrcode?url=` validates that the target URL starts with the app's own origin before generating the QR code. This prevents the endpoint from being used as a QR code generator for arbitrary external URLs.

### RLS enforcement

All identity tables have Row-Level Security enabled. Applicants can only read their own attempts; staff can read all. The `mobile_verify_sessions` table uses `user_id = auth.uid()` to ensure users cannot read each other's session results.

### Error message sanitization

In production, the mobile-verify endpoint returns a generic error string. The real error message is only exposed in `development` mode (`process.env.NODE_ENV === "development"`), preventing internal stack traces from leaking to the mobile client.

---

## 12. File Map

```
lib/
  identity/
    aamva-parser.ts               # PDF417 barcode parser (AAMVA standard)
    verify-license.ts             # Match engine + scoring algorithm
  db/
    identity-verification.ts      # DB layer: load profile, save attempt, get applicant ID
    mobile-verify-session.ts      # DB layer: create/get/complete mobile sessions

app/api/identity/
  verify-license/route.ts         # GET (status) + POST (direct scan)
  mobile-session/route.ts         # POST (create session) + GET (poll)
  mobile-verify/[token]/route.ts  # POST (mobile callback — no auth)
  qrcode/route.ts                 # GET (QR SVG generation)

app/verify/mobile/[token]/
  page.tsx                        # Mobile scan page (no auth)

components/identity/
  LicenseScannerModal.tsx         # Full 3-tab scanner modal
  IdentityVerificationBanner.tsx  # Dashboard/form banner
  ProfileScanModal.tsx            # Compact 2-tab scanner for profile page

components/user-profile/
  PersonalSection.tsx             # Profile form with scan auto-fill

lib/redux/features/
  identity-verification-slice.ts  # Redux state (status, score, scannerOpen, ...)

database/
  identity_verification_schema.sql              # applicants columns + attempts table
  migrations/add_mobile_verify_sessions.sql     # mobile_verify_sessions table
  migrations/add_mobile_session_extracted_data.sql  # extracted_data JSONB column
```
