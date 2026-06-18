# Help / Community Q&A — Design Spec

**Date:** 2026-06-18  
**Branch:** MH-helps  
**Route:** `/help`

---

## Overview

A community Q&A help page where patients can ask questions and any authenticated user (patients, healthcare professionals, admins) can answer. Questions can be submitted as text, voice recording, or with a file attachment. AI classifies and embeds questions for category tagging and semantic similarity matching. New questions trigger an email notification to the platform team.

---

## Layout & UX

### `/help` — Question List

- Top bar: search input + "Ask a Question" button (consistent with app's no-sidebar pattern)
- Horizontal category pill filters: All · Eligibility · Benefits & Coverage · Applications & Appeals · Platform Help
- Question feed: cards showing title, category badge, answer count, view count, author type, relative time
- Search is fuzzy (pg_trgm) over question titles and bodies, debounced 300ms

### `/help/[id]` — Question Detail

- Full question with title, body, category, author, date
- Voice player if voice recording attached; file download link if file attached
- Answers listed chronologically, each with:
  - **Healthcare Professional** badge (green) for `social_worker`, `reviewer`, `case_reviewer`, `supervisor` roles
  - **Admin** badge (blue) for `admin` role
  - No badge for regular patients
- Answer text input at the bottom for any authenticated user

### Ask a Question — Modal Dialog

- Opens as a dialog overlay from the "Ask a Question" button
- Fields:
  - **Title** (required, plain text)
  - **Details** (optional, textarea)
  - **Voice recording** — record/stop/playback widget, max 1 recording, 10 MB, audio/webm|ogg|mpeg|mp4|wav
  - **File attachment** — max 1 file, 25 MB, PDF/Word/Excel/PPT/plain text
  - **Notify me of answers** toggle — default ON
- **Similar questions panel** — appears inline below the form as the user types the title, debounced 400ms, shows top 3 semantically similar questions with links; if user clicks one they're navigated to it instead of submitting a duplicate
- Submit button

---

## Data Model

### New Tables (migration `20260618000001_help_qa.sql`)

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

help_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text,                          -- optional details + appended voice transcript
  category        text NOT NULL DEFAULT 'other', -- eligibility|benefits_coverage|applications_appeals|platform_help|other
  embedding       vector(768),                   -- nomic-embed-text via Ollama (768-dim)
  voice_url       text,                          -- signed URL path in Supabase Storage
  file_url        text,
  file_name       text,
  notify_on_answer boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
)

help_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL REFERENCES help_questions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

### Indexes

```sql
-- Fuzzy search
CREATE INDEX help_questions_title_trgm ON help_questions USING gin (title gin_trgm_ops);
CREATE INDEX help_questions_body_trgm  ON help_questions USING gin (body  gin_trgm_ops);

-- Semantic similarity
CREATE INDEX help_questions_embedding ON help_questions USING ivfflat (embedding vector_cosine_ops);
```

### View

```sql
-- Badge resolution — server-side only, never exposed as a client claim
CREATE VIEW help_user_badge AS
SELECT
  u.id AS user_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id AND r.name = 'admin')
      THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id AND r.name IN ('social_worker','reviewer','case_reviewer','supervisor'))
      THEN 'professional'
    ELSE NULL
  END AS badge_type
FROM auth.users u;
```

### Storage

Bucket: existing `masshealth-dev`  
Paths: `help/{questionId}/voice.{ext}` and `help/{questionId}/{fileName}`

### Rate Limits (pg_cron / existing pattern)

- Questions: 5 per user per hour
- Answers: 20 per user per hour

### RLS

- `help_questions`: authenticated users can INSERT and SELECT; users can DELETE their own rows; admins can DELETE any
- `help_answers`: same pattern

---

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/help/questions` | required | List questions; `?q=` triggers fuzzy search; `?category=` filters |
| POST | `/api/help/questions` | required | Create question; triggers AI pipeline + email |
| GET | `/api/help/questions/[id]` | required | Question detail with answers and badge data |
| POST | `/api/help/questions/[id]/answers` | required | Post an answer |
| GET | `/api/help/questions/similar` | required | `?q=` → pgvector cosine similarity, top 3 above 0.75 threshold |
| PATCH | `/api/help/notifications` | required | Toggle `notify_on_answer` for the current user's questions |

---

## AI Pipeline (on question submission)

All AI processing is fully on-premise — no patient data leaves the VPS.

Executed server-side in `POST /api/help/questions`, steps run in sequence:

1. **Voice transcription** — if voice file present: `POST /asr?task=transcribe&language=en&output=json` to local Whisper ASR (`WHISPER_BASE_URL`), form field `audio_file`. Returns `{ text, segments, language }`. Transcript appended to `body` with `\n\n[Voice transcript]: ` prefix.
2. **Category classification** — `title + body` sent to local Ollama (`llama3.2` via `OLLAMA_BASE_URL`) with structured output schema → one of `eligibility | benefits_coverage | applications_appeals | platform_help | other`.
3. **Embedding** — `title + body` embedded via Ollama `nomic-embed-text` (768-dim). Stored in `embedding vector(768)` column. Note: use `vector(768)` in migration, not 1536.
4. **Email notification** — Resend sends from/to `no-reply@healthcompass.cloud` with question title, body excerpt, category, and link to `/help/[id]`.

**Similar questions** (live search while typing): `GET /api/help/questions/similar?q=` embeds the query via `nomic-embed-text` and runs pgvector cosine similarity. Returns top 3 questions where similarity > 0.75. Debounced 400ms on the client.

**Infrastructure:**
- Whisper: `onerahmet/openai-whisper-asr-webservice:latest`, port 9000, internal network only
- `WHISPER_BASE_URL=http://whisper:9000` (prod) / `http://localhost:9000` (local dev)
- `WHISPER_MODEL=medium` (prod, ~1.5GB RAM) / `small` (local dev)

---

## File Structure

```
app/help/
  layout.tsx
  page.tsx                    # List page
  page.hooks.ts               # useQuestions, useSearch
  [id]/
    page.tsx                  # Detail page
    page.hooks.ts             # useQuestion, useAnswers, usePostAnswer

components/help/
  QuestionFeed.tsx
  QuestionCard.tsx
  QuestionDetailHeader.tsx
  AnswerCard.tsx              # Renders badge_type → badge chip
  AnswerForm.tsx
  AskQuestionDialog.tsx       # Modal with similar-questions panel
  VoiceRecorder.tsx           # 1-recording limit enforced here
  CategoryPills.tsx

app/api/help/
  questions/
    route.ts                  # GET list, POST create
    [id]/route.ts             # GET detail + answers
    [id]/answers/route.ts     # POST answer
    similar/route.ts          # GET similarity search
  notifications/route.ts      # PATCH toggle

lib/help/
  db.ts                       # All Supabase queries
  ai.ts                       # transcribeVoice(), classifyQuestion(), embedText()
  email.ts                    # sendNewQuestionEmail()
  constants.ts                # CATEGORIES, BADGE_ROLES, rate limit values

supabase/migrations/
  20260618000001_help_qa.sql  # Full schema migration
```

---

## Security Summary

- All routes require `requireAuthenticatedUser()` — no anonymous access
- Upload validation via existing `validateUpload()` (magic-bytes + MIME allowlist)
- Badge resolved server-side via `help_user_badge` view; client never sends role claims
- RLS enforces row-level ownership for deletes
- Rate limits: 5 questions / 20 answers per user per hour
- Monarx on VPS scans stored files periodically as backstop
- No third-party virus scanning (VirusTotal excluded due to PHI privacy concerns)

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `WHISPER_BASE_URL` | Local Whisper ASR service (`http://whisper:9000` prod, `http://localhost:9000` dev) |
| `WHISPER_MODEL` | Whisper model size — `medium` prod, `small` local dev |
| `RESEND_API_KEY` | Email notification (already in use) |
| `OLLAMA_BASE_URL` | Classification + embeddings via `llama3.2` + `nomic-embed-text` (already in use) |
