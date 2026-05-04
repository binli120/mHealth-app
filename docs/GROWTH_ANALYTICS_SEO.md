# Growth, Analytics, SEO, Referrals, and Mailing List

This document describes the growth infrastructure added to HealthCompass MA:

- Google Analytics and Mixpanel page tracking
- SEO metadata, canonical URLs, robots metadata, Open Graph, and Twitter cards
- First-party referral attribution
- Mailing-list capture from the landing page
- CSP updates for nonce-backed third-party analytics scripts
- Database tables for growth reporting

Production domain: `https://healthcompass.cloud`

## Goals

The implementation is designed to answer growth questions without collecting PHI:

- Which campaigns and referral partners bring traffic?
- Which landing-page visitors join the mailing list?
- Which routes are viewed most often?
- Which acquisition sources convert before account creation?

Growth payloads intentionally avoid application data, profile data, SSNs, health details, uploaded document contents, chat content, and authenticated user profile fields.

## Main Files

- `app/layout.tsx`
  - Global metadata, canonical URL, Open Graph, Twitter card metadata
  - Injects analytics scripts and client-side growth provider

- `components/analytics/growth-scripts.tsx`
  - Env-gated Google Analytics and Mixpanel script loading
  - Uses the request CSP nonce from the root layout

- `components/analytics/growth-provider.tsx`
  - Client-side page-view tracking
  - Captures referral query params
  - Stores referral code in a first-party cookie
  - Sends first-party referral events to `/api/growth/referrals`

- `app/page.tsx`
  - Landing-page footer mailing-list form
  - Sends email, campaign, and referral attribution to `/api/growth/mailing-list`

- `app/page.copy.ts`
  - Localized mailing-list labels and messages

- `app/api/growth/referrals/route.ts`
  - First-party referral event API

- `app/api/growth/mailing-list/route.ts`
  - First-party mailing-list signup API

- `lib/db/growth.ts`
  - Postgres writes for referral events and mailing-list signups

- `lib/growth/request.ts`
  - Request helpers for user-agent, referral cookie, and salted IP hashing

- `lib/csp/nonce.ts`
  - Allows GA/Mixpanel script, connect, and pixel endpoints in the nonce-backed CSP

- `proxy.ts`
  - Emits CSP, nonce, and security headers for matched requests

- `supabase/migrations/20260503090000_growth_system.sql`
  - Creates `growth_referrals` and `mailing_list_signups`

- `scripts/db-migrate-dev.sh`
  - Includes the growth migration in the local/dev migration path

## Environment Variables

Required for correct production metadata:

```bash
NEXT_PUBLIC_APP_URL=https://healthcompass.cloud
```

Optional analytics providers:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_MIXPANEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Optional privacy hardening for IP hashes:

```bash
GROWTH_IP_HASH_SALT=<long-random-secret>
```

If `GROWTH_IP_HASH_SALT` is absent, the app falls back to `NEXT_PUBLIC_APP_URL` and then `mhealth-app`. Production should set a real secret salt so IP hashes cannot be compared across environments.

## Data Flow

### Page Views

1. User navigates in the app.
2. `GrowthProvider` observes route/search-param changes.
3. If GA is configured, it sends a `page_view` event through `gtag`.
4. If Mixpanel is configured, it sends a `Page Viewed` event with:
   - `path`
   - `url`
   - `title`
   - `utm_source`
   - `utm_medium`
   - `utm_campaign`
   - `utm_term`
   - `utm_content`

### Referral Capture

Referral codes are recognized from these query params:

- `ref`
- `referral`
- `referral_code`
- `utm_referral`

Example:

```text
https://healthcompass.cloud/?ref=community-partner-01&utm_source=flyer&utm_campaign=spring-outreach
```

On first page load with a referral code:

1. `GrowthProvider` stores the code in the `hc_ref` cookie for 30 days.
2. It registers the code in Mixpanel with `register_once`.
3. It sends a first-party POST to `/api/growth/referrals`.
4. The server writes a row to `public.growth_referrals`.

Stored referral fields:

- `referral_code`
- `landing_path`
- `referrer`
- `campaign` JSON
- `user_agent`
- `ip_hash`
- `created_at`

### Mailing List

The landing-page footer includes a mailing-list form.

On submit:

1. Client validates basic email shape.
2. Client sends a POST to `/api/growth/mailing-list`.
3. Server validates with Zod.
4. Server reads `hc_ref` if no referral code was sent directly.
5. Server upserts into `public.mailing_list_signups`.

Stored mailing-list fields:

- `email`
- `source`
- `referral_code`
- `campaign` JSON
- `user_agent`
- `ip_hash`
- `created_at`
- `updated_at`
- `unsubscribed_at`

Email is lowercased and unique.

## Database

Migration:

```bash
supabase/migrations/20260503090000_growth_system.sql
```

Apply in dev:

```bash
pnpm run db:migrate:dev
```

Useful reporting queries:

```sql
select
  referral_code,
  count(*) as visits
from public.growth_referrals
group by referral_code
order by visits desc;
```

```sql
select
  referral_code,
  count(*) as signups
from public.mailing_list_signups
where unsubscribed_at is null
group by referral_code
order by signups desc;
```

```sql
select
  campaign->>'utm_source' as utm_source,
  campaign->>'utm_campaign' as utm_campaign,
  count(*) as signups
from public.mailing_list_signups
group by 1, 2
order by signups desc;
```

## CSP and Security Headers

The app uses `proxy.ts` to generate a per-request nonce and enforce CSP.

Analytics-related CSP allowances:

- `script-src`
  - `https://www.googletagmanager.com`
  - `https://cdn.mxpnl.com`

- `connect-src`
  - `https://www.google-analytics.com`
  - `https://analytics.google.com`
  - `https://stats.g.doubleclick.net`
  - `https://api-js.mixpanel.com`
  - `https://api.mixpanel.com`

- `img-src`
  - `https://www.google-analytics.com`
  - `https://stats.g.doubleclick.net`

Additional response headers emitted by `proxy.ts`:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Local Verification

Run typecheck:

```bash
pnpm exec tsc --noEmit
```

Run focused unit tests:

```bash
pnpm exec vitest run \
  lib/csp/__tests__/nonce.test.ts \
  app/api/growth/__tests__/mailing-list-route.test.ts \
  app/api/growth/__tests__/referrals-route.test.ts
```

Run production build:

```bash
pnpm run build
```

Run dev server:

```bash
pnpm dev
```

Check CSP headers:

```bash
curl --max-time 5 -sS -I 'http://localhost:3000/?ref=test-ref'
```

Smoke test mailing-list API:

```bash
curl --max-time 5 -sS \
  -X POST 'http://localhost:3000/api/growth/mailing-list' \
  -H 'Content-Type: application/json' \
  --data '{"email":"growth-test@example.com","source":"manual-smoke","campaign":{"utm_source":"manual"}}'
```

Smoke test referral API:

```bash
curl --max-time 5 -sS \
  -X POST 'http://localhost:3000/api/growth/referrals' \
  -H 'Content-Type: application/json' \
  --data '{"referralCode":"manual-test","landingPath":"/?ref=manual-test","referrer":null,"campaign":{"utm_source":"manual"}}'
```

## E2E Auth Gotcha

Some e2e specs generate local helper JWTs. If a manually-started `pnpm dev` server is already running with `.env.local` where local auth helpers are disabled, Playwright may reuse that stale server and authenticated API tests can fail with `401`.

Before running e2e, either stop the manual dev server or start it with:

```bash
NEXT_PUBLIC_ENABLE_LOCAL_AUTH_HELPERS=true ENABLE_LOCAL_AUTH_HELPERS=true pnpm dev
```

Targeted specs verified after letting Playwright own startup:

```bash
pnpm exec playwright test e2e/tests/12-ssn-api.spec.ts --project=chromium --reporter=line
pnpm exec playwright test e2e/tests/14-upload-validation.spec.ts --project=chromium --reporter=line
```

## Production Checklist

Set environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://healthcompass.cloud
NEXT_PUBLIC_GA_MEASUREMENT_ID=<ga-id>
NEXT_PUBLIC_MIXPANEL_TOKEN=<mixpanel-token>
GROWTH_IP_HASH_SALT=<secret-random-salt>
```

Apply the growth migration to production before enabling the mailing-list form publicly.

Confirm:

- Home page emits canonical metadata for `https://healthcompass.cloud`.
- Shared links show HealthCompass MA Open Graph/Twitter previews.
- CSP header includes the expected nonce and analytics endpoints.
- Referral links write rows to `growth_referrals`.
- Mailing-list form writes rows to `mailing_list_signups`.
- No PHI is sent to GA, Mixpanel, or growth APIs.

## Current Limitations

- Mailing-list signups are stored but not yet synchronized to a dedicated ESP/audience list.
- Referral attribution is first-touch style via `mixpanel.register_once` and a 30-day cookie.
- Open Graph currently uses the existing brand logo asset. A custom 1200x630 social card can improve share previews.
- No admin UI has been added yet for growth reporting; reporting is query-based for now.
