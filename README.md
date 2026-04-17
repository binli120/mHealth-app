# HealthCompass MA — MassHealth Application Portal

A collaborative health-application platform that lets patients and social workers fill MassHealth applications together in real time, with screen-sharing, live chat, and AI-powered voice messaging.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5.7 |
| UI | React 19, Tailwind CSS 4, Radix UI |
| State | Redux Toolkit |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI / LLM | Ollama — llama3.2 |
| Speech-to-text | OpenAI Whisper CLI |
| Email | Resend |
| Observability | OpenObserve + OpenTelemetry |
| Package manager | pnpm 10 |
| Node.js | ≥ 20 |

---

## Prerequisites

### 1. Node.js & pnpm

```bash
# Node.js >= 20 (nvm recommended)
nvm install 20 && nvm use 20

# pnpm 10
npm install -g pnpm@10

# Verify
node -v   # v20.x.x
pnpm -v   # 10.x.x
```

### 2. Docker

Required to run Supabase locally. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it is running before the next step.

### 3. Supabase CLI

```bash
brew install supabase/tap/supabase
supabase --version
```

### 4. Ollama + models

```bash
# Install Ollama
brew install ollama

# Pull required models
ollama pull llama3.2          # conversational AI + translation
ollama pull nomic-embed-text  # RAG document embeddings

# Optional
ollama pull llava             # vision / image analysis
```

### 5. OpenAI Whisper (voice transcription)

```bash
brew install openai-whisper

# Verify — should print usage
whisper --help
```

Whisper downloads the `base` model (~140 MB) on first use. Use `WHISPER_MODEL=small` or `medium` in `.env.local` for better accuracy.

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Supabase

```bash
supabase start
```

After startup, copy the printed values — you will need them in the next step:

```
API URL:          http://127.0.0.1:54321
DB URL:           postgresql://postgres:postgres@127.0.0.1:54322/postgres
anon key:         eyJ...
service_role key: eyJ...
Studio URL:       http://127.0.0.1:54323
```

### 3. Configure environment variables

Create `.env.local` in the project root:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_URL_DEV=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_URL_PROD=

# ── Supabase ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase start>

# Local overrides (used when NODE_ENV != production)
NEXT_PUBLIC_SUPABASE_URL_LOCAL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL=<anon key from supabase start>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_LOCAL=<anon key from supabase start>
NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=true

# Server-side only — never expose to the browser
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>

# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
OLLAMA_VISION_MODEL=llava

# ── Whisper voice transcription ───────────────────────────────────────────────
WHISPER_BIN=/opt/homebrew/bin/whisper   # default on macOS; change if installed elsewhere
WHISPER_MODEL=base                       # tiny | base | small | medium | large

# ── Email (Resend) ────────────────────────────────────────────────────────────
# Optional for local dev — invitation links are printed to the console when unset
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
FROM_EMAIL=noreply@yourdomain.com

# ── External services ─────────────────────────────────────────────────────────
NEXT_PUBLIC_MASSHEALTH_FORMS_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MASSHEALTH_ANALYSIS_BASE_URL=http://localhost:8000

# ── OpenObserve observability ─────────────────────────────────────────────────
# All three must be set to activate; leave blank to disable silently
OPENOBSERVE_URL=http://72.60.29.200:5080
OPENOBSERVE_USER=blee@healthcompass.cloud
OPENOBSERVE_PASSWORD=
OPENOBSERVE_ORG=default
OPENOBSERVE_STREAM=mhealth-app
OPENOBSERVE_STREAM_CONTAINERS=containers-local   # Vector ships all container logs here

# ── Optional ──────────────────────────────────────────────────────────────────
PROFILE_ENCRYPTION_KEY=        # 32-byte hex string for profile field encryption
GOOGLE_GEOCODING_API_KEY=      # address geocoding
RAG_INGEST_SECRET=             # bearer token for the RAG document ingestion endpoint
```

### 4. Apply database migrations

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f database/mHealth_schema.sql \
  -f database/mHealth_schema_update.sql \
  -f database/user_profile_schema.sql \
  -f database/rag_schema.sql \
  -f database/benefit_orchestration_schema.sql \
  -f database/documents_storage_migration.sql \
  -f database/notifications_schema.sql \
  -f database/social_worker_schema.sql \
  -f database/staff_profile_migration.sql \
  -f database/invitations_schema.sql \
  -f database/sw_messaging_schema.sql \
  -f database/collaborative_session_schema.sql \
  -f database/voice_transcription_migration.sql \
  -f database/identity_verification_schema.sql \
  -f database/migrations/add_mobile_verify_sessions.sql \
  -f database/migrations/add_mobile_session_extracted_data.sql
```

Seed the admin account:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f database/seed_admin.sql
```

Or use the pnpm shortcut (runs all pending migrations):

```bash
pnpm db:migrate:dev
```

### 5. Start Ollama

```bash
ollama serve   # starts on http://127.0.0.1:11434
               # on macOS this auto-starts after brew install
```

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local Supabase (Docker required)
supabase start

# Apply migrations
pnpm db:migrate:dev

# Start the dev server
pnpm dev
```

App runs at **http://localhost:3000**

---

## Requirements and Planning

The implementation-facing requirements package lives in [`docs/requirements/README.md`](docs/requirements/README.md). It covers product, functional, AI agent, API, data/security, non-functional, roadmap, and traceability requirements generated from the current codebase.

---

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with Turbopack at localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Start production server (requires `pnpm build` first) |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm test:eligibility-cases` | Run the ACA-3 eligibility regression case sweep |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm test:e2e:ui` | Playwright interactive UI mode |
| `pnpm test:e2e:report` | Open last Playwright HTML report |
| `pnpm db:check` | Verify database connection |
| `pnpm db:migrate:dev` | Apply pending migrations (dev) |
| `pnpm db:push:dev` | Push migrations to cloud dev (Supabase CLI) |
| `pnpm db:push:prod` | Push migrations to cloud prod (`SUPABASE_PROJECT_REF_PROD` required) |
| `pnpm db:sync:prod` | Dump local public data and restore to cloud (`SUPABASE_DB_URL` required) |
| `pnpm gen:test-license` | Generate a test PDF417 barcode + HTML DL mockup for identity verification testing |

---

## Local Service URLs

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Admin portal | http://localhost:3000/admin |
| Social worker portal | http://localhost:3000/social-worker |
| Supabase Studio | http://127.0.0.1:54323 |
| Supabase API | http://127.0.0.1:54321 |
| Ollama API | http://127.0.0.1:11434 |
| OpenObserve dashboard | http://72.60.29.200:5080 |

---

## Observability (OpenObserve + OpenTelemetry)

HealthCompass MA ships structured logs and distributed traces to a self-hosted **OpenObserve** instance running on the Hostinger VPS.

### Architecture

```
API routes / server functions
        │
        ▼
lib/server/logger.ts          ← logServerError() / logServerInfo()
        │
        ├─── console.{info|warn|error}   (always — local dev + prod stdout)
        │
        └─── POST /api/{org}/{stream}/_json   ─► OpenObserve (fire-and-forget)

instrumentation.ts            ← OpenTelemetry SDK (auto-loaded by Next.js)
        │
        └─── OTLP/HTTP traces  ─────────────────► OpenObserve /api/{org}/traces
```

### What is collected

| Signal | Details |
|---|---|
| **Structured logs** | Every `logServerError` / `logServerInfo` call across 47+ API routes |
| **Distributed traces** | HTTP requests, DB queries, and more via OpenTelemetry auto-instrumentation |
| **PII redaction** | Keys matching `authorization`, `token`, `password`, `ssn`, `dob` are automatically replaced with `[redacted]` |

### OpenObserve instance

| | |
|---|---|
| **URL** | `http://72.60.29.200:5080` |
| **Login** | `blee@healthcompass.cloud` |
| **Dev stream** | `mhealth-app` |
| **Prod stream** | `mhealth-app-prod` |

### Environment variables

All three must be set to activate log shipping and tracing. Leave blank to disable silently.

```env
OPENOBSERVE_URL=http://72.60.29.200:5080
OPENOBSERVE_USER=blee@healthcompass.cloud
OPENOBSERVE_PASSWORD=<your-password>
OPENOBSERVE_ORG=default
OPENOBSERVE_STREAM=mhealth-app                   # Next.js app logs (structured JSON)
OPENOBSERVE_STREAM_CONTAINERS=containers-prod    # Vector: all container logs (Ollama, Traefik, etc.)
```

### Querying logs

1. Open **http://72.60.29.200:5080** → **Logs** → select stream `mhealth-app`
2. Useful queries:
   ```sql
   -- All errors
   level = 'error'

   -- Errors from a specific module
   level = 'error' AND context.module = 'mobile-session'

   -- Slow or failed auth
   level = 'error' AND event LIKE '%auth%'
   ```

### OpenObserve on VPS (Docker)

The instance runs via Docker Compose at `/root/openobserver/docker-compose.yml` on the Hostinger VPS.

```bash
# Check status (on VPS)
docker ps | grep openobserve
curl http://localhost:5080/healthz

# Restart
cd /root/openobserver && docker compose restart

# View logs
docker logs openobserve --tail 50 -f
```

> **Firewall:** Port 5080 must be open in **hPanel → VPS → Firewall** (Hostinger cloud firewall). UFW is inactive on this server — the Hostinger panel is the only firewall layer.

---

### Vector — Container Log Collector

**Vector** is a sidecar in `docker-compose.yml` that tails Docker logs from every container and ships them to OpenObserve. This means **Ollama, Traefik, masshealth-analysis, and the Next.js app** all appear in a single OpenObserve stream — no code changes needed in any service.

| | Detail |
|--|--------|
| Image | `timberio/vector:0.39-alpine` |
| Config | `deploy/vector.toml` |
| Source | Docker socket (`/var/run/docker.sock`) |
| Destination stream | `containers-prod` (configurable via `OPENOBSERVE_STREAM_CONTAINERS`) |

**What you'll see in OpenObserve → `containers-prod`:**
- Ollama inference requests (`"msg":"inference started"`, model load times, errors)
- Traefik access logs (HTTP method, path, status, duration)
- Next.js logs (already structured JSON — parsed automatically by Vector)
- Analysis service logs when the profile is enabled

**Querying container logs:**
1. Open **http://72.60.29.200:5080** → **Logs** → select stream **`containers-prod`**
2. Filter by service:
   - Ollama: `service = 'healthcompass-ollama'`
   - Traefik: `service = 'healthcompass-proxy'`
   - App: `service = 'healthcompass-app'`

**No env var set for `OPENOBSERVE_STREAM_CONTAINERS`?** Vector defaults to `containers-prod` in production (see `docker-compose.yml`).

---

## Identity Verification

HealthCompass MA verifies applicant identity by scanning the **PDF417 barcode** on the back of any US driver's license or state ID. The implementation is fully self-hosted — no third-party identity service is required.

### How it works

1. The applicant scans the barcode using their device camera (or their phone camera via a QR code cross-device flow).
2. The AAMVA standard barcode is parsed to extract name, date of birth, and address.
3. The extracted fields are compared against the applicant's on-file profile using a weighted scoring algorithm.
4. The applicant's identity status (`verified`, `needs_review`, or `failed`) is recorded and gates application submission.

### Scoring

| Field | Weight |
|---|---|
| Last name | 30 pts |
| Date of birth | 30 pts |
| First name | 20 pts |
| Address / ZIP | 20 pts |

Score ≥ 70 → **verified**. Score 50–69 → **needs review** (staff queue). Score < 50 → **failed**.

### Where verification appears

| Location | Behavior |
|---|---|
| **Customer dashboard** | Banner prompts unverified users to scan; disappears when verified |
| **Application submission** | Hard gate — submit button opens scanner if not verified |
| **Profile page** | "Auto-fill from license" scan fills name/address fields and runs verify-on-save |

### Cross-device QR flow

When a user cannot easily aim a laptop camera at the barcode, they click "Scan with Phone":

1. Desktop creates a short-lived session token and displays a QR code.
2. User scans the QR code with their phone — opens a mobile-optimized scan page.
3. Phone camera scans the DL barcode; result is sent to the server.
4. Desktop polls for completion and updates automatically.

### Profile auto-fill

Scanning the DL on the profile page populates name and address fields automatically. Each auto-filled field shows a "From license" badge that clears when the user edits it. Saving the profile triggers identity verification against the newly saved data.

### Technical approach

- **Barcode decoder:** `@zxing/browser` + `@zxing/library` (open-source, already in dependencies)
- **Standard:** AAMVA DL/ID Card Design Standard — all 50 US states
- **QR code:** `bwip-js` server-side SVG generation
- **Privacy:** License number is SHA-256 hashed before storage; name/address/DOB are never persisted
- **Sessions:** 24-byte random token, 10-minute TTL, RLS-enforced

Full technical design: [`docs/IDENTITY_VERIFICATION.md`](docs/IDENTITY_VERIFICATION.md)

---

## Voice Messaging

Voice messages are automatically transcribed by **Whisper** (language auto-detected) and translated to English by **Ollama llama3.2** when the source language is not English.

Supported languages: English, Spanish, Portuguese, Vietnamese, Chinese (Simplified), French, and all other languages supported by Whisper.

Test audio files are included at `public/test-audio/`:

| File | Language |
|---|---|
| `test_english.wav` | English |
| `test_chinese.wav` | Mandarin Chinese |

---

## Ollama Models

| Model | Purpose | Pull command |
|---|---|---|
| `llama3.2` | Conversational AI, translation | `ollama pull llama3.2` |
| `nomic-embed-text` | RAG document embeddings | `ollama pull nomic-embed-text` |
| `llava` *(optional)* | Vision / image analysis | `ollama pull llava` |

---

---

## Test Accounts

> All accounts below work against the local Supabase instance (`localhost:54322`).
> Password is `password` unless noted.

### Admin

| Field    | Value                   |
|----------|-------------------------|
| Email    | `no-reply@healthcompass.cloud` |
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
| Email    | `patient@healthcompass.dev` |
| Password | `password`                |
| Portal   | `/customer/dashboard`     |
| Notes    | General-purpose dev patient account. No special role — standard applicant experience. |

**E2E test account (created by Playwright global setup):**

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

See the **Setup → Configure environment variables** section above for the full `.env.local` template.

---

## Deployment — Hostinger VPS

### Overview

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build (deps → builder → runner) using `output: standalone` |
| `docker-compose.yml` | Production stack: Next.js app + Traefik (auto-SSL) + Ollama |
| `docker-compose.nginx.yml` | Alternative stack using Nginx + manual SSL certs |
| `nginx/nginx.conf` | Nginx reverse proxy config with TLS + SSE streaming support |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD — SSH → git pull → docker compose up |

---

### GitHub Secrets (Settings → Environments → dev)

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `72.60.29.200` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Full contents of private key (begins `-----BEGIN OPENSSH PRIVATE KEY-----`) |
| `APP_DIR` | `/opt/masshealth-app` |
| `GH_PAT` | GitHub fine-grained token — repo Contents: Read-only |
| `REPO_SLUG` | `your-username/mHealth-app` |
| `DATABASE_URL` | Supabase production Postgres URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `DOMAIN` | `yourdomain.com` |
| `ACME_EMAIL` | Email for Let's Encrypt registration |
| `RESEND_API_KEY` | Resend email API key |
| `FROM_EMAIL` | Sender address |
| `OLLAMA_BASE_URL` | `http://ollama:11434` |
| `OLLAMA_MODEL` | `llama3.2` |
| `OPENOBSERVE_URL` | `http://72.60.29.200:5080` |
| `OPENOBSERVE_USER` | OpenObserve admin email |
| `OPENOBSERVE_PASSWORD` | OpenObserve admin password |
| `OPENOBSERVE_ORG` | `default` |
| `OPENOBSERVE_STREAM` | `mhealth-app-prod` |
| `OPENOBSERVE_STREAM_CONTAINERS` | `containers-prod` |

> **Secrets vs Variables:** All of the above must be stored under **Secrets** (lock icon),
> not Variables. Secrets use `${{ secrets.NAME }}`; Variables use `${{ vars.NAME }}` — mixing them causes blank values and silent deploy failures.

---

### Always-On Services — Systemd Daemon Setup

Docker's `restart: unless-stopped` restarts individual containers when they crash, but it does **not** bring the stack back after a full VPS reboot. Systemd units fill that gap.

Two unit files live in `deploy/`:

| File | Service | Manages |
|------|---------|---------|
| `deploy/healthcompass.service` | `healthcompass` | Next.js app + Traefik + Ollama (+ analysis when profile enabled) |
| `deploy/openobserve.service` | `openobserve` | OpenObserve monitoring stack |

#### Install on the VPS (one-time)

```bash
# ── HealthCompass app stack ───────────────────────────────────────────────────
sudo cp ~/masshealth_app/deploy/healthcompass.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now healthcompass      # start now + auto-start on boot

# ── OpenObserve monitoring stack ─────────────────────────────────────────────
sudo cp ~/masshealth_app/deploy/openobserve.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openobserve

# ── Verify both are active ───────────────────────────────────────────────────
systemctl status healthcompass openobserve
```

#### Day-to-day systemd commands

```bash
# Status
systemctl status healthcompass          # show running state + last 10 log lines
systemctl status openobserve

# Restart (e.g. after config change)
systemctl restart healthcompass
systemctl restart openobserve

# Logs via journald (follows live)
journalctl -u healthcompass -f
journalctl -u openobserve -f

# Stop (won't auto-restart until you start it again)
systemctl stop healthcompass
```

#### MassHealth Analysis Service

The `masshealth-analysis` service is defined in `docker-compose.yml` under a `profiles: [analysis]` guard so it does **not** start by default.

When the analysis service is ready to deploy:
1. Build its image on the VPS: `docker build -t healthcompass-analysis:latest /path/to/analysis-repo`
2. Enable the profile for all future starts — edit `/etc/systemd/system/healthcompass.service` and uncomment the `--profile analysis` ExecStart line (or override inline):

```bash
# One-off start including analysis:
cd ~/masshealth_app
docker compose --env-file .env.production.local --profile analysis up -d

# OR permanently — edit the systemd unit:
sudo sed -i 's|up -d --remove-orphans|--profile analysis up -d --remove-orphans|' \
  /etc/systemd/system/healthcompass.service
sudo systemctl daemon-reload && sudo systemctl restart healthcompass
```

#### How restart protection works (layers)

```
VPS reboot
  └─► systemd starts Docker daemon (docker.service)
        └─► systemd starts healthcompass.service  → docker compose up -d
              └─► Docker runs containers with restart: unless-stopped
                    └─► if any container crashes → Docker restarts it automatically
                          └─► if docker compose exits → systemd restarts the unit (Restart=on-failure)
```

---

### First-time VPS Setup

```bash
# 1. SSH in (via Hostinger hPanel → Terminal, or ssh root@72.60.29.200)

# 2. Install SSH server if missing (Debian/Ubuntu)
apt-get update && apt-get install -y openssh-server
systemctl enable --now ssh

# 3. Add your deploy public key
echo "ssh-ed25519 AAAA... your-public-key" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 4. Open firewall ports
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 5. Verify SSH from your Mac
nc -zv 72.60.29.200 22    # should say: succeeded
ssh -i ~/.ssh/id_hostinger.ed25519 root@72.60.29.200

# 6. Pull Ollama model after first deploy
docker exec healthcompass-ollama ollama pull llama3.2
```

---

### SSH Key Setup

Private key goes into GitHub secret `VPS_SSH_KEY`. Public key goes on the VPS.

```bash
# Generate a new passphrase-free deploy key
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions-deploy"

cat ~/.ssh/github_deploy      # → paste into VPS_SSH_KEY GitHub secret
cat ~/.ssh/github_deploy.pub  # → append to VPS ~/.ssh/authorized_keys
```

> **Important:** The key must have **no passphrase**. GitHub Actions cannot enter one interactively.
> If you get `ssh: this private key is passphrase protected`, strip it:
> ```bash
> ssh-keygen -p -f ~/.ssh/your_key   # enter current passphrase, set new to empty
> ```

---

### Deploy Flow

Every `git push` to `main` triggers the workflow automatically:

```
git push main
  └─► GitHub Actions
        └─► SSH into 72.60.29.200
              ├─► Install Docker (if missing) + ensure daemon running
              ├─► git clone (first run) or git reset --hard origin/main
              ├─► rm -f docker-compose.yaml          # remove stale file
              ├─► Write .env.production.local from GitHub secrets
              ├─► docker compose up -d --build --remove-orphans
              ├─► Health check: poll localhost:3000 every 5s (2 min max)
              └─► docker image prune -f
```

Manual trigger: **GitHub → Actions → Deploy to Hostinger VPS → Run workflow**

---

### Managing the Running App (on VPS)

> **Preferred:** once the systemd units are installed (see above), use `systemctl restart healthcompass` instead of docker compose directly. Both work — systemd just adds boot-time auto-start.

All docker compose commands run from `~/masshealth_app` using the env file:

```bash
cd ~/masshealth_app

# ── Status ────────────────────────────────────────────────────────────────────
docker compose --env-file .env.production.local ps          # all service statuses
docker ps                                                    # quick container list

# ── Start / Stop / Restart ────────────────────────────────────────────────────
docker compose --env-file .env.production.local up -d                        # start all
docker compose --env-file .env.production.local down                         # stop all
docker compose --env-file .env.production.local restart app                  # restart Next.js only
docker compose --env-file .env.production.local restart traefik              # restart reverse proxy only

# ── Logs ──────────────────────────────────────────────────────────────────────
docker compose --env-file .env.production.local logs -f app                  # Next.js live logs
docker compose --env-file .env.production.local logs -f traefik              # Traefik live logs
docker compose --env-file .env.production.local logs -f ollama               # Ollama live logs
docker compose --env-file .env.production.local logs --tail 100 app          # last 100 lines

# ── SSL Certificate (Let's Encrypt via Traefik) ───────────────────────────────
# If cert is self-signed or expired, clear the ACME cache and restart:
docker exec healthcompass-proxy rm -f /letsencrypt/acme.json
docker compose --env-file .env.production.local restart traefik
# Watch for cert issuance:
docker compose --env-file .env.production.local logs -f traefik 2>&1 | grep -iE "acme|cert|obtain|challeng|error"

# Verify the live cert:
echo | openssl s_client -connect healthcompass.cloud:443 -servername healthcompass.cloud 2>/dev/null \
  | openssl x509 -noout -issuer -dates

# ── Ollama model ──────────────────────────────────────────────────────────────
docker exec healthcompass-ollama ollama list                 # list downloaded models
docker exec healthcompass-ollama ollama pull llama3.2       # pull / update model
```

> **Services:** `app` = Next.js · `traefik` (container: `healthcompass-proxy`) = reverse proxy + SSL · `ollama` = local LLM

---

### Troubleshooting

#### `dial tcp ***:22: i/o timeout`

SSH port 22 is blocked. Fix via **hPanel → VPS → Firewall** — add inbound TCP rule for port 22.
Then on the VPS (via hPanel web terminal):
```bash
ufw allow 22/tcp && ufw --force enable
systemctl enable --now ssh
ss -tlnp | grep ':22'     # confirm listening
```

#### `ssh: no key found` or `ssh: this private key is passphrase protected`

Wrong key in `VPS_SSH_KEY` secret. Check:
1. You pasted the **private** key (not `.pub`) — must start with `-----BEGIN OPENSSH PRIVATE KEY-----`
2. The key has **no passphrase** — strip with `ssh-keygen -p -f ~/.ssh/key`

#### `Unit sshd.service could not be found`

On Debian/Ubuntu the service is `ssh`, not `sshd`:
```bash
systemctl enable --now ssh
```
If that also fails: `apt-get install -y openssh-server`

#### `fatal: not a git repository`

The repo has never been cloned on the VPS. The workflow handles this automatically (clones on first run). If it fails, check that `GH_PAT` and `REPO_SLUG` secrets are set correctly and that the PAT has **Contents: Read-only** permission.

#### `Host key verification failed`

The VPS tried to clone from GitHub via SSH before accepting GitHub's host key.
The workflow uses HTTPS + `GH_PAT` to avoid this entirely. Ensure `GH_PAT` and `REPO_SLUG` are set in the `dev` environment secrets.

#### `env file .env.production.local not found`

The workflow writes this file from GitHub secrets on every deploy. If it's missing, the workflow failed before reaching that step. Check the Actions log for the earlier error (usually Docker not running or a git clone failure).

#### `Cannot connect to the Docker daemon`

Docker is installed but the daemon isn't running:
```bash
systemctl enable docker --now
docker info    # should respond without error
```

#### `Found multiple config files: docker-compose.yml, docker-compose.yaml`

A stale `docker-compose.yaml` (the old minio-only file) was cloned before it was deleted from the repo. The workflow removes it automatically with `rm -f docker-compose.yaml`. If it persists, delete it manually on the VPS:
```bash
rm -f /opt/masshealth-app/docker-compose.yaml
```

#### Variables showing as blank / `not set` in docker compose

Secrets added to GitHub environment **Variables** (not **Secrets**) use a different syntax and won't be interpolated. Move all sensitive values to **Secrets** (lock icon) under Settings → Environments → dev.

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
