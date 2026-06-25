# OpenObserve Ad-hoc SQL Queries

Stream: `mhealth_app` — run these in the Query Explorer with the time picker set as needed.

---

## Debugging & Inspection

### See all fields for a specific event type
```sql
SELECT * FROM "mhealth_app"
WHERE event = 'customer.login'
LIMIT 10
```

### See all distinct event names in the stream
```sql
SELECT event, COUNT(*) AS count
FROM "mhealth_app"
GROUP BY event ORDER BY count DESC
```

### See all logs for a specific session
```sql
SELECT ts, level, event, path, route, duration_ms, counter
FROM "mhealth_app"
WHERE session_id = 'REPLACE_WITH_SESSION_ID'
ORDER BY ts
```

### See all logs for a specific user (by user_hash)
```sql
SELECT ts, level, event, path, route, session_id
FROM "mhealth_app"
WHERE user_hash = 'REPLACE_WITH_USER_HASH'
ORDER BY ts
```

### See all errors with full context in last 24 hours
```sql
SELECT ts, event, route, level
FROM "mhealth_app"
WHERE level = 'error'
ORDER BY ts DESC
LIMIT 100
```

### Find all logs for a specific IP (by ip_hash)
```sql
SELECT ts, event, path, session_id, user_hash
FROM "mhealth_app"
WHERE ip_hash = 'REPLACE_WITH_IP_HASH'
ORDER BY ts DESC
LIMIT 50
```

---

## User Journey Tracing

### Trace a full session: page views + events in order
```sql
SELECT ts, event, path, route, duration_ms
FROM "mhealth_app"
WHERE session_id = 'REPLACE_WITH_SESSION_ID'
  AND event IN ('customer.page_view', 'customer.active_time', 'customer.login',
                'application.created', 'chat.request', 'benefit-advisor.request',
                'intake.request', 'form-assistant.request', 'vision.request')
ORDER BY ts
```

### Find sessions longer than 10 minutes of active time
```sql
SELECT session_id, user_hash, SUM(duration_ms) / 60000.0 AS total_active_min, COUNT(*) AS segments
FROM "mhealth_app"
WHERE event = 'customer.active_time' AND duration_ms > 0
GROUP BY session_id, user_hash
HAVING SUM(duration_ms) > 600000
ORDER BY total_active_min DESC
LIMIT 50
```

### Find users who created an application this week
```sql
SELECT user_hash, type, ts
FROM "mhealth_app"
WHERE event = 'application.created'
ORDER BY ts DESC
LIMIT 100
```

### Find users who triggered an appeal draft
```sql
SELECT DISTINCT user_hash, ts
FROM "mhealth_app"
WHERE event = 'masshealth.appeals.draft.start'
ORDER BY ts DESC
LIMIT 50
```

---

## Error Investigation

### All errors from a specific route
```sql
SELECT ts, event, level
FROM "mhealth_app"
WHERE level = 'error' AND route = '/api/agents/chat'
ORDER BY ts DESC
LIMIT 50
```

### Errors in the last hour by event name
```sql
SELECT event, COUNT(*) AS count
FROM "mhealth_app"
WHERE level = 'error'
GROUP BY event ORDER BY count DESC
LIMIT 30
```

### Failed document parses with rejection reason
```sql
SELECT ts, event, reason
FROM "mhealth_app"
WHERE event IN ('parse-application.rejected-irrelevant',
                'parse-application.rejected-suspicious',
                'parse-application.all-paths-failed')
ORDER BY ts DESC
LIMIT 50
```

### Appeal pipeline failures
```sql
SELECT ts, event, route
FROM "mhealth_app"
WHERE event IN ('masshealth.appeals.categories.error',
                'masshealth.appeals.research.error',
                'masshealth.appeals.draft.error')
ORDER BY ts DESC
LIMIT 50
```

### RAG failures and low-confidence answers
```sql
SELECT ts, counter, agent, reason
FROM "mhealth_app"
WHERE event = 'metric.counter'
  AND counter IN ('rag_empty_result', 'rag_embedding_error',
                  'rag_low_confidence_used', 'rag_retrieval_latency_exceeded')
ORDER BY ts DESC
LIMIT 100
```

### Extraction parse failures by extractor
```sql
SELECT extractor, reason, COUNT(*) AS failures
FROM "mhealth_app"
WHERE event = 'metric.counter' AND counter = 'extraction_parse_failure'
GROUP BY extractor, reason ORDER BY failures DESC
```

---

## Performance

### Slowest active_time segments (possible hung sessions)
```sql
SELECT session_id, user_hash, path, duration_ms / 60000.0 AS duration_min
FROM "mhealth_app"
WHERE event = 'customer.active_time' AND duration_ms > 1800000
ORDER BY duration_ms DESC
LIMIT 20
```

### Agent requests that took longest (by elapsedMs in context)
```sql
SELECT ts, event, route, ms
FROM "mhealth_app"
WHERE event LIKE '%.done' AND route LIKE '/api/agents/%' AND ms IS NOT NULL
ORDER BY ms DESC
LIMIT 50
```

### Pages with highest bounce (single page_view sessions)
```sql
SELECT path, COUNT(*) AS single_view_sessions
FROM "mhealth_app"
WHERE event = 'customer.page_view'
  AND session_id IN (
    SELECT session_id FROM "mhealth_app"
    WHERE event = 'customer.page_view'
    GROUP BY session_id
    HAVING COUNT(*) = 1
  )
GROUP BY path ORDER BY single_view_sessions DESC
LIMIT 20
```

---

## Growth & Funnel

### Login methods breakdown
```sql
SELECT method, COUNT(*) AS count
FROM "mhealth_app"
WHERE event = 'customer.login' AND method IS NOT NULL
GROUP BY method ORDER BY count DESC
```

### Users who signed up for mailing list but never logged in
```sql
SELECT COUNT(DISTINCT ip_hash) AS mailing_signups_no_login
FROM "mhealth_app"
WHERE event = 'growth.mailing_list.signup'
  AND ip_hash NOT IN (
    SELECT DISTINCT ip_hash FROM "mhealth_app"
    WHERE event = 'customer.login' AND ip_hash IS NOT NULL
  )
```

### Invite funnel: started vs email sent vs completed
```sql
SELECT
  SUM(CASE WHEN event = 'invite.start'      THEN 1 ELSE 0 END) AS started,
  SUM(CASE WHEN event = 'invite.email_sent' THEN 1 ELSE 0 END) AS email_sent,
  SUM(CASE WHEN event = 'invite.done'       THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN event = 'invite.no_resend_key' THEN 1 ELSE 0 END) AS skipped_no_key
FROM "mhealth_app"
WHERE event LIKE 'invite.%'
```

---

## AI Quality Spot Checks

### Memory hit vs stale rate per agent
```sql
SELECT agent,
  SUM(CASE WHEN counter = 'memory_hit'   THEN 1 ELSE 0 END) AS hits,
  SUM(CASE WHEN counter = 'memory_stale' THEN 1 ELSE 0 END) AS stale,
  ROUND(100.0
    * SUM(CASE WHEN counter = 'memory_hit' THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN counter IN ('memory_hit','memory_stale') THEN 1 ELSE 0 END), 0)
  , 1) AS hit_rate_pct
FROM "mhealth_app"
WHERE event = 'metric.counter' AND counter IN ('memory_hit', 'memory_stale')
GROUP BY agent ORDER BY hits DESC
```

### Reflection revision rate per agent
```sql
SELECT agent,
  SUM(CASE WHEN counter = 'tool_call_sequence' THEN 1 ELSE 0 END) AS total_turns,
  SUM(CASE WHEN counter = 'reflection_revision' THEN 1 ELSE 0 END) AS revisions,
  ROUND(100.0
    * SUM(CASE WHEN counter = 'reflection_revision' THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN counter = 'tool_call_sequence' THEN 1 ELSE 0 END), 0)
  , 1) AS revision_rate_pct
FROM "mhealth_app"
WHERE event = 'metric.counter'
  AND counter IN ('tool_call_sequence', 'reflection_revision')
GROUP BY agent ORDER BY total_turns DESC
```

### Average tool calls per agent turn
```sql
SELECT agent,
  COUNT(*) AS tool_calls,
  COUNT(DISTINCT sequence) AS sequences,
  ROUND(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT sequence), 0), 2) AS avg_tools_per_turn
FROM "mhealth_app"
WHERE event = 'metric.counter' AND counter = 'tool_call'
GROUP BY agent ORDER BY avg_tools_per_turn DESC
```

### Benefit policy update run history
```sql
SELECT ts, event
FROM "mhealth_app"
WHERE event LIKE 'masshealth.benefitPolicyUpdates.%'
ORDER BY ts DESC
LIMIT 50
```

---

## Admin & Audit

### Recent admin actions
```sql
SELECT ts, event, route, user_hash
FROM "mhealth_app"
WHERE route LIKE '/api/admin/%'
ORDER BY ts DESC
LIMIT 100
```

### Identity extraction purge history
```sql
SELECT ts, event
FROM "mhealth_app"
WHERE event IN ('Identity extraction purge complete', 'Identity extraction purge failed')
ORDER BY ts DESC
LIMIT 20
```

### Auth attempts vs successful logins
```sql
SELECT
  SUM(CASE WHEN event = 'auth.attempt'    THEN 1 ELSE 0 END) AS attempts,
  SUM(CASE WHEN event = 'customer.login'  THEN 1 ELSE 0 END) AS logins,
  ROUND(100.0
    * SUM(CASE WHEN event = 'customer.login' THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN event = 'auth.attempt' THEN 1 ELSE 0 END), 0)
  , 1) AS login_success_pct
FROM "mhealth_app"
WHERE event IN ('auth.attempt', 'customer.login')
```

### Suspicious mobile upload IP mismatches
```sql
SELECT ts, event
FROM "mhealth_app"
WHERE event = 'Mobile upload IP mismatch — rejecting request'
ORDER BY ts DESC
LIMIT 50
```
