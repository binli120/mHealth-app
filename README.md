# HealthCompass MA — MassHealth Application Portal

A collaborative health-application platform that lets patients and social workers fill MassHealth applications together in real time, with screen-sharing, live chat, and voice messaging.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local Supabase (Docker required)
npx supabase start

# Run database migrations
pnpm db:migrate:dev

# Start the dev server
pnpm dev
```

App runs at **http://localhost:3000**

---

## Test Accounts

> All accounts below work against the local Supabase instance (`localhost:54322`).
> Password is `password` unless noted.

### Admin

| Field    | Value                   |
|----------|-------------------------|
| Email    | `binli120@gmail.com`    |
| Password | `password`              |
| Portal   | `/admin/dashboard`      |
| Notes    | Auto-seeded by `database/seed_admin.sql`. Can approve social worker accounts. |

---

### Social Worker

| Field          | Value                         |
|----------------|-------------------------------|
| Email          | `sarah.chen@homesite.com`     |
| Password       | `password`                    |
| Portal         | `/social-worker/dashboard`    |
| Name           | Sarah Chen                    |
| Company        | Homesite                      |
| Account status | **approved** (must be set by admin — see note below) |

> **First-time setup:** After registering, a social worker account starts as `pending`.
> Log in as Admin → **Staff** → find Sarah Chen → set status to **Approved**.
> Until approved, the SW portal shows a "pending review" banner and all session features are blocked.

---

### Patient / Customer

| Field    | Value                     |
|----------|---------------------------|
| Email    | `demo.e2e@masshealth-test.local` |
| Password | `Demo@2026!`              |
| Portal   | `/customer/dashboard`     |
| Name     | Maria Santos              |
| Notes    | Created automatically by the E2E global setup (`pnpm test:e2e`). Can also be created by visiting `/auth/register`. |

> **Additional patient accounts** can be created at `/auth/register` (role: Customer).
> For screenshare testing you need the patient to be assigned to Sarah Chen via the SW portal's **My Patients** list.

---

### E2E Reviewer (staff reviewer role)

| Field    | Value                                  |
|----------|----------------------------------------|
| Email    | `reviewer.e2e@masshealth-test.local`   |
| Password | `Staff@2026!`                          |
| Name     | Staff Reviewer                         |
| Notes    | Created by E2E global setup. Used only in Playwright tests. |

---

## Testing the Screen-Share Feature

The collaborative session feature lets a social worker share their screen while both parties chat in real time. Below is the full end-to-end test walkthrough.

### Prerequisites

1. Two separate browser windows (or profiles) — one for the SW, one for the patient.
2. Both accounts exist and the SW account is **approved** by admin.
3. The patient (`Maria Santos`) is linked to Sarah Chen in the SW portal.
4. Running on `localhost` — WebRTC works without TURN on the same machine.

> **Chrome note:** Chrome uses mDNS obfuscation for WebRTC on the same machine, which can cause connection failures when both browsers run locally.
> To disable it: open `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` and set it to **Disabled**, then relaunch Chrome.

---

### Step-by-Step Test Flow

#### 1 — SW creates a session invite

1. Log in as **Sarah Chen** at `/auth/login` → lands at `/social-worker/dashboard`
2. Click **Sessions** in the left nav → `/social-worker/sessions`
3. Click **New Session**
4. Select patient **Maria Santos** from the dropdown
5. Optionally set a scheduled time and personal note
6. Click **Send Invite**

#### 2 — Patient sees the invite (real-time)

1. Log in as **Maria Santos** in a second browser/profile → `/customer/dashboard`
2. The **SessionInviteBanner** appears at the top of the dashboard automatically (polls every 30 s, or refresh the page)
3. Alternatively, navigate to `/customer/sessions` to see the invite card
4. Click **Accept**

#### 3 — SW starts the session

1. Back in the SW window, the session card status changes to **Invited → Accepted**
2. Click **Start Session** — status transitions to **Live**
3. Both parties are redirected to (or can navigate to) the session room:
   - SW: `/social-worker/sessions/<sessionId>`
   - Patient: `/customer/sessions/<sessionId>`

#### 4 — SW shares their screen

1. In the SW session room, click **Share Screen**
2. A browser picker dialog appears — select a window or tab to share
3. The patient side transitions from "Connecting…" to a live screen-share view
4. The **FloatingSessionBar** (bottom-right corner) appears on every SW page while sharing is active

#### 5 — SW navigates to a patient's application (screen share stays active)

1. From the SW session room, click the patient's name link → `/social-worker/patients/<patientId>`
2. Click **New Application** or open an existing draft
3. The application form opens **inside the SW portal layout** (`/social-worker/patients/<patientId>/applications/…`)
4. The FloatingSessionBar remains visible — the patient continues seeing the SW's screen throughout
5. The SW fills the form while the patient watches the shared screen

#### 6 — Chat during the session

- Use the chat panel in the session room to send text messages
- Voice messages can be recorded and sent (microphone permission required)
- Both SW and patient see each other's messages in real time via Supabase Realtime

#### 7 — End and delete the session

1. SW clicks **End Session** in the FloatingSessionBar or session room → status changes to **Ended**
2. Patient sees the session end notification
3. SW can then delete the ended session: go to `/social-worker/sessions` → find the session card → click **Delete**
4. Ended and cancelled sessions can be deleted; active and scheduled sessions cannot

---

## WebRTC Signaling Architecture

```
SW browser                           Patient browser
    |                                     |
    | ── offer (SDP) ──────────────────►  |
    |                                     |
    | ◄─────────────────── answer (SDP) ──|
    |                                     |
    | ◄──────── ICE candidates ──────────►|
    |                                     |
    | ════════ screen share stream ══════►|
```

- **Signaling transport:** Supabase Realtime Broadcast on channel `session-webrtc-{sessionId}`
- **ICE servers:** Google STUN (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`)
- **Race condition fix:** Patient broadcasts `patient-ready` on channel subscription; SW re-sends the offer if already sharing
- **Layout persistence:** `SWSessionProvider` at the SW layout level keeps the WebRTC peer connection alive across page navigations

---

## Project Structure (Key Files)

```
app/
  social-worker/
    layout.tsx                        # SWSessionProvider wraps children (keeps WebRTC alive)
    sessions/page.tsx                 # SW sessions list
    patients/[patientId]/
      page.tsx                        # Patient detail — links stay inside SW layout
      applications/new/page.tsx       # New application within SW layout
      applications/[applicationId]/   # Edit draft within SW layout
  customer/
    sessions/page.tsx                 # Patient sessions list
    dashboard/page.tsx                # SessionInviteBanner lives here

components/collaborative-sessions/
  FloatingSessionBar.tsx              # Persistent screen-share controls + SWSessionProvider
  SessionRoom.tsx                     # Session room UI (chat, video, controls)
  SessionCard.tsx                     # Session list card with role-aware actions
  SessionListPanel.tsx                # Fetches + renders session cards
  SessionInviteBanner.tsx             # Patient invite notification on dashboard
  ScheduleSessionModal.tsx            # SW creates/schedules a new session

hooks/
  use-webrtc-screenshare.ts           # WebRTC peer connection hook

lib/
  collaborative-sessions/
    db.ts                             # SQL helpers (createSession, updateSessionStatus, deleteSession)
    session-rtc-context.tsx           # React context sharing WebRTC state from layout to room
    types.ts                          # SessionSummary, SessionMessage types
  redux/features/
    collaborative-session-slice.ts    # Redux state (activeSession, messages, peerStatus)
  notifications/
    service.ts                        # Email + in-app notification dispatch pipeline

app/api/
  sessions/
    route.ts                          # POST /api/sessions  (create)
    [sessionId]/route.ts              # PATCH (transition) + DELETE (remove)
  notifications/
    route.ts                          # GET  (list)
    unread-count/route.ts             # GET  (badge count)
    [id]/read/route.ts                # POST (mark one read)
    read-all/route.ts                 # POST (mark all read)

database/
  collaborative_session_schema.sql    # Table definitions (reference)
supabase/migrations/
  20260322000000_collaborative_sessions.sql  # Applied migration
```

---

## Running Tests

```bash
# Unit tests (Vitest)
pnpm test

# Unit tests in watch mode
pnpm test:watch

# E2E tests (Playwright — requires running dev server)
pnpm dev &
pnpm test:e2e
```

### Unit test coverage (collaborative sessions + notifications)

| File | What is tested |
|------|----------------|
| `lib/redux/features/__tests__/collaborative-session-slice.test.ts` | `upsertSession`, `removeSession`, `appendMessage`, `updateActiveSession`, `clearRoomState`, `resetSession` |
| `lib/redux/features/__tests__/notifications-slice.test.ts` | All 8 reducers (`setNotifications`, `markRead`, `markAllRead`, `revertMarkRead`, `revertMarkAllRead`, …) |
| `lib/notifications/__tests__/types.test.ts` | `rowToNotification` DB-row → client-shape transformer |
| `lib/notifications/__tests__/service.test.ts` | Dispatch pipeline + all 6 triggers (`notifySessionInvite`, `notifySessionStarting`, `notifyStatusChange`, …) |
| `app/api/sessions/[sessionId]/__tests__/route.test.ts` | PATCH transitions (allowed/disallowed per role) + DELETE guards |
| `app/api/notifications/__tests__/routes.test.ts` | All 4 notification API routes (auth, limit clamping, DB errors) |
| `components/collaborative-sessions/__tests__/SessionCard.test.tsx` | Role-aware buttons, status badges, invite message, room link hrefs |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase (local dev — already set by `npx supabase start`)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
DATABASE_URL_DEV=postgresql://postgres:postgres@localhost:54322/postgres

# App URL (used in notification emails)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (Resend — optional for local dev)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@healthcompassma.com

# Feature flags
LOCAL_AUTH_HELPER=true   # enables /api/auth/dev-register for local user creation
```

---

## Common Issues

| Symptom | Fix |
|---------|-----|
| Patient side stuck on "Connecting…" | Disable Chrome mDNS: `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` → Disabled |
| Screen share drops when SW navigates away | Make sure `SWSessionProvider` is wrapping `{children}` in `app/social-worker/layout.tsx` |
| SW portal shows "pending review" banner | Log in as admin → Staff → approve the SW account |
| `relation collaborative_sessions does not exist` | Run `pnpm db:migrate:dev` |
| Patient doesn't see invite without refresh | `SessionInviteBanner` polls every 30 s — wait or refresh `/customer/dashboard` |
| Session card shows no Delete button | Delete is only available on `ended` or `cancelled` sessions |
