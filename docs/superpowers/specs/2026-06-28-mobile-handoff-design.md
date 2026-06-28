# Universal Desktop→Mobile Handoff — Design Spec

**Date:** 2026-06-28  
**Branch:** MH-mobile-improve  
**Status:** Approved, ready for implementation

---

## Overview

Users can hand off any in-progress task from the desktop web app to their mobile phone via a QR code, without re-authenticating. The desktop locks into a "waiting" state. The mobile picks up exactly where the desktop left off in a focused shell. When the user taps "Save & Exit" on mobile, state is persisted to the backend and the desktop wakes up showing updated progress.

### Contexts supported

| `context_type` | Entry point | Mobile renderer |
|---|---|---|
| `intake_chat` | ACA3 intake chat panel | `<IntakeChatPanel>` with mobile layout |
| `mh_chat` | MassHealth chat widget | `<MasshealthChatWidget>` stripped of floating wrapper |
| `id_verify` | Identity verification step | Redirect to existing `/verify/mobile/[token]` |
| `voice_message` | Social worker messages page | New `<MobileVoiceRecorder>` |
| `doc_upload` | Document upload step | Redirect to existing `/upload/mobile/[token]` |

---

## Data Model

### Table: `mobile_handoff_sessions`

```sql
CREATE TABLE mobile_handoff_sessions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token                   text NOT NULL UNIQUE,          -- 192-bit base64url, single-use
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type            text NOT NULL,                 -- enum: intake_chat | mh_chat | id_verify | voice_message | doc_upload
  context_payload         jsonb NOT NULL DEFAULT '{}',  -- context-specific resume data (no PHI)
  encrypted_refresh_token text NOT NULL,                 -- AES-256-GCM with server PHI_KEY
  status                  text NOT NULL DEFAULT 'pending', -- pending | active | completed | expired
  created_at              timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  completed_at            timestamptz,
  progress_summary        jsonb                          -- optional result posted by mobile on complete
);

CREATE INDEX ON mobile_handoff_sessions (user_id, status);
CREATE INDEX ON mobile_handoff_sessions (token);
```

#### `context_payload` shapes by type

```ts
// intake_chat
{ applicationId: string, resumeId: string, lastAnsweredId: string | null }

// mh_chat
{ chatHistory: Array<{ role: 'user'|'assistant', content: string }> }

// id_verify
{ verifySessionToken: string }  // redirect only — existing /verify/mobile/[token]

// voice_message
{ patientId: string, conversationId: string }

// doc_upload
{ uploadSessionToken: string }  // redirect only — existing /upload/mobile/[token]
```

**Security invariants:**
- No PHI in `context_payload` — intake state lives in the existing PHI draft system; payload carries only IDs
- `encrypted_refresh_token` uses `AES-256-GCM` via `lib/phi-token/crypto.ts` with server `PHI_KEY`
- Token is single-use: exchange endpoint transitions `pending → active` atomically; second exchange returns 409
- Desktop creation expires any prior `pending` handoff sessions for the same user

---

## API Routes

### `POST /api/handoff`
Creates a new handoff session. Requires authenticated user.

**Request:**
```json
{ "contextType": "intake_chat", "contextPayload": { "applicationId": "...", "resumeId": "...", "lastAnsweredId": "..." } }
```

**Response:**
```json
{ "ok": true, "token": "...", "mobileUrl": "https://...//mobile/[token]", "expiresAt": "..." }
```

Side effects: expires any existing `pending` sessions for the user; encrypts and stores refresh token from the current session.

---

### `GET /api/handoff?token=xxx`
Desktop polls this (every 3s) to track status. Requires authenticated user + token must belong to them.

**Response:**
```json
{ "ok": true, "status": "pending|active|completed|expired", "progressSummary": null | { ... }, "expiresAt": "..." }
```

---

### `DELETE /api/handoff?token=xxx`
Cancels (expires) the session. Used by the desktop "Cancel" button. Requires authenticated user.

---

### `POST /api/handoff/[token]/exchange`
**Unauthenticated.** Mobile hits this immediately on page load to claim the session.

- Validates token exists, status is `pending`, not past `expires_at`
- Atomically transitions status to `active`
- Decrypts `encrypted_refresh_token`, calls `supabase.auth.setSession()` server-side
- Returns the Supabase `access_token` + `refresh_token` + `context_type` + `context_payload`

If token already `active` or `expired`: returns 409 or 410. Mobile shows appropriate error screen.

---

### `POST /api/handoff/[token]/complete`
**Authenticated** (mobile has a session from exchange). Called by mobile "Save & Exit".

**Request:**
```json
{ "progressSummary": { "lastAnsweredId": "...", "completedSteps": 12 } }
```

Transitions status to `completed`, stores `progress_summary`, sets `completed_at`. Desktop poll will see `completed` on next tick.

---

## Desktop Flow

### `useHandoff(contextType, getPayload)` hook

```ts
// Returns:
{
  trigger: () => Promise<void>       // initiates handoff, starts poll
  cancel: () => Promise<void>        // cancels session
  state: 'idle' | 'creating' | 'waiting_scan' | 'in_progress' | 'completed' | 'error'
  mobileUrl: string | null
  expiresAt: Date | null
}
```

`getPayload` is a lazy callback so intake-chat can snapshot current wizard state at trigger time without the hook needing to know about it.

Polling: every 3s via `setInterval`. Stops when status is `completed` or `expired`. On `completed` the hook fires an `onComplete(progressSummary)` callback so the parent component can refresh its data.

### `<HandoffWaitOverlay>`

Full-screen overlay (z-50, backdrop-blur) with three sub-states:

**`waiting_scan`:**
- Centered QR code (renders via `/api/identity/qrcode?url=...` — existing endpoint)
- "Scan with your phone to continue"
- Countdown timer (MM:SS, red when < 60s)
- "Cancel" button

**`in_progress`:**
- Phone icon with pulsing ring animation
- "Your [Intake / Chat / ID Verification / Voice Note] is in progress on your phone"
- "Cancel" button (still available)

**`completed`:**
- Green checkmark
- "Done! Your progress has been saved."
- Auto-dismisses after 3s; triggers parent data refresh

### Trigger button placement

A `<HandoffTrigger>` button (smartphone icon, "Continue on mobile") appears as a secondary action in:
- `intake-chat-panel.tsx` — in the panel header toolbar
- `masshealth-chat-widget.tsx` — in the chat header
- `app/social-worker/messages/[patientId]/page.tsx` — near the voice record button

---

## Mobile Shell

### Route: `/mobile/[token]`

Server component (`app/mobile/[token]/page.tsx`):
- No auth check — token is the credential
- Renders `<MobileShell>` client component with `token` prop
- Minimal layout: no sidebar, no global nav

Client component (`app/mobile/[token]/shell.tsx`):
1. On mount: `POST /api/handoff/[token]/exchange` → get session + context
2. Call `supabase.auth.setSession(access_token, refresh_token)` to authenticate
3. Render context-appropriate renderer (see table above)
4. "Save & Exit" footer button → `POST /api/handoff/[token]/complete` → navigate to `/mobile/done`

**Error states:**
- Token expired / not found → `/mobile/expired` static page
- Token already active (scanned twice) → `/mobile/already-claimed` static page

### Header

```
[← ] [HealthCompass]    [context title]
```

No back navigation to the main app — user is in focused mode.

### `<MobileVoiceRecorder>` (new component)

For `voice_message` context:
- Large "Tap to Record" button (full-width, 80px height)
- Recording timer + waveform visualization
- Review step: playback, re-record, or confirm
- On confirm: POST audio blob + transcription to existing `/api/messages/voice` endpoint

---

## Security Summary

| Concern | Mitigation |
|---|---|
| QR code intercepted | 5-min TTL; single-use exchange; HTTPS only |
| Token brute-force | 192-bit random token (≈ 2^192 space); rate-limit on exchange route |
| PHI in handoff row | `context_payload` carries IDs only; PHI stays in existing encrypted draft system |
| Refresh token exposure | AES-256-GCM encrypted at rest with `PHI_KEY`; deleted from row after exchange |
| Double-scan | Atomic `pending → active` transition; 409 on second attempt |
| Orphaned sessions | DB cleanup job (or pg_cron) expires `pending` rows > 10 min old |

---

## New Files

```
lib/db/mobile-handoff-session.ts
app/api/handoff/route.ts
app/api/handoff/[token]/exchange/route.ts
app/api/handoff/[token]/complete/route.ts
app/mobile/[token]/page.tsx
app/mobile/[token]/shell.tsx
app/mobile/done/page.tsx
app/mobile/expired/page.tsx
app/mobile/already-claimed/page.tsx
components/handoff/handoff-wait-overlay.tsx
components/handoff/handoff-trigger.tsx
components/handoff/use-handoff.ts
components/handoff/mobile-voice-recorder.tsx
db/migrations/XXXX_mobile_handoff_sessions.sql
```

## Modified Files

```
components/application/aca3/intake-chat-panel.tsx   — add <HandoffTrigger>
components/chat/masshealth-chat-widget.tsx           — add <HandoffTrigger>
app/social-worker/messages/[patientId]/page.tsx      — add voice handoff trigger
```

---

## Out of Scope

- Push notifications when mobile completes (future)
- Mobile PWA / installable app (future)
- Android/iOS native app (future)
- Multi-step handoff chaining (desktop→mobile→desktop mid-flow)
