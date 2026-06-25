# OpenObserve Dashboard SQL Queries

Stream: `mhealth_app`

- **Dashboard panels**: use `AND _timestamp BETWEEN $__from AND $__to` in WHERE clause
- **Query Explorer**: omit the time filter — the time picker applies it automatically

---

## Row 1 — User Engagement

### Unique Weekly Logins
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(DISTINCT ip_hash) AS unique_logins
FROM "mhealth_app"
WHERE event = 'customer.login' AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(DISTINCT ip_hash) AS unique_logins
FROM "mhealth_app"
WHERE event = 'customer.login'
GROUP BY week ORDER BY week
```

### Unique Sessions Per Week
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(DISTINCT session_id) AS unique_sessions
FROM "mhealth_app"
WHERE event = 'customer.page_view' AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(DISTINCT session_id) AS unique_sessions
FROM "mhealth_app"
WHERE event = 'customer.page_view'
GROUP BY week ORDER BY week
```

### Unique Authenticated Users Per Week
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(DISTINCT user_hash) AS unique_users
FROM "mhealth_app"
WHERE event = 'customer.page_view' AND user_hash IS NOT NULL AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(DISTINCT user_hash) AS unique_users
FROM "mhealth_app"
WHERE event = 'customer.page_view' AND user_hash IS NOT NULL
GROUP BY week ORDER BY week
```

### Avg Active Time Per Session (minutes)
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  ROUND(AVG(duration_ms) / 60000.0, 2) AS avg_active_min,
  ROUND(MAX(duration_ms) / 60000.0, 2) AS max_active_min
FROM "mhealth_app"
WHERE event = 'customer.active_time' AND duration_ms > 0 AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  ROUND(AVG(duration_ms) / 60000.0, 2) AS avg_active_min,
  ROUND(MAX(duration_ms) / 60000.0, 2) AS max_active_min
FROM "mhealth_app"
WHERE event = 'customer.active_time' AND duration_ms > 0
GROUP BY week ORDER BY week
```

### Session Duration Buckets
```sql
-- Dashboard
SELECT
  CASE
    WHEN duration_ms <  30000 THEN '1_0-30s'
    WHEN duration_ms < 120000 THEN '2_30s-2m'
    WHEN duration_ms < 300000 THEN '3_2-5m'
    WHEN duration_ms < 600000 THEN '4_5-10m'
    ELSE                           '5_10m+'
  END AS bucket,
  COUNT(*) AS sessions
FROM "mhealth_app"
WHERE event = 'customer.active_time' AND duration_ms > 0 AND _timestamp BETWEEN $__from AND $__to
GROUP BY bucket ORDER BY bucket

-- Explorer
SELECT
  CASE
    WHEN duration_ms <  30000 THEN '1_0-30s'
    WHEN duration_ms < 120000 THEN '2_30s-2m'
    WHEN duration_ms < 300000 THEN '3_2-5m'
    WHEN duration_ms < 600000 THEN '4_5-10m'
    ELSE                           '5_10m+'
  END AS bucket,
  COUNT(*) AS sessions
FROM "mhealth_app"
WHERE event = 'customer.active_time' AND duration_ms > 0
GROUP BY bucket ORDER BY bucket
```

---

## Row 2 — Page Traffic

### Top Pages
```sql
-- Dashboard
SELECT path, COUNT(*) AS views
FROM "mhealth_app"
WHERE event = 'customer.page_view' AND path IS NOT NULL AND _timestamp BETWEEN $__from AND $__to
GROUP BY path ORDER BY views DESC LIMIT 20

-- Explorer
SELECT path, COUNT(*) AS views
FROM "mhealth_app"
WHERE event = 'customer.page_view' AND path IS NOT NULL
GROUP BY path ORDER BY views DESC LIMIT 20
```

### Daily Traffic (time series)
```sql
-- Dashboard
SELECT date_trunc('day', to_timestamp(ts)) AS day,
  COUNT(*) AS page_views,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(DISTINCT user_hash) AS auth_users
FROM "mhealth_app"
WHERE event = 'customer.page_view' AND _timestamp BETWEEN $__from AND $__to
GROUP BY day ORDER BY day

-- Explorer
SELECT date_trunc('day', to_timestamp(ts)) AS day,
  COUNT(*) AS page_views,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(DISTINCT user_hash) AS auth_users
FROM "mhealth_app"
WHERE event = 'customer.page_view'
GROUP BY day ORDER BY day
```

---

## Row 3 — Applications

### Applications Created Per Week
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  COUNT(*) AS applications_created,
  COUNT(DISTINCT user_hash) AS unique_applicants
FROM "mhealth_app"
WHERE event = 'application.created' AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  COUNT(*) AS applications_created,
  COUNT(DISTINCT user_hash) AS unique_applicants
FROM "mhealth_app"
WHERE event = 'application.created'
GROUP BY week ORDER BY week
```

### Applications by Type
```sql
-- Dashboard
SELECT type, COUNT(*) AS count
FROM "mhealth_app"
WHERE event = 'application.created' AND _timestamp BETWEEN $__from AND $__to
GROUP BY type ORDER BY count DESC

-- Explorer
SELECT type, COUNT(*) AS count
FROM "mhealth_app"
WHERE event = 'application.created'
GROUP BY type ORDER BY count DESC
```

---

## Row 4 — AI Agent Usage

### All Agent Requests Per Week (stacked by agent)
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'chat.request'            THEN 1 ELSE 0 END) AS chat,
  SUM(CASE WHEN event = 'benefit-advisor.request' THEN 1 ELSE 0 END) AS benefit_advisor,
  SUM(CASE WHEN event = 'intake.request'           THEN 1 ELSE 0 END) AS intake,
  SUM(CASE WHEN event = 'form-assistant.request'   THEN 1 ELSE 0 END) AS form_assistant,
  SUM(CASE WHEN event = 'vision.request'           THEN 1 ELSE 0 END) AS vision
FROM "mhealth_app"
WHERE event IN ('chat.request','benefit-advisor.request','intake.request','form-assistant.request','vision.request')
  AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'chat.request'            THEN 1 ELSE 0 END) AS chat,
  SUM(CASE WHEN event = 'benefit-advisor.request' THEN 1 ELSE 0 END) AS benefit_advisor,
  SUM(CASE WHEN event = 'intake.request'           THEN 1 ELSE 0 END) AS intake,
  SUM(CASE WHEN event = 'form-assistant.request'   THEN 1 ELSE 0 END) AS form_assistant,
  SUM(CASE WHEN event = 'vision.request'           THEN 1 ELSE 0 END) AS vision
FROM "mhealth_app"
WHERE event IN ('chat.request','benefit-advisor.request','intake.request','form-assistant.request','vision.request')
GROUP BY week ORDER BY week
```

### Agent Usage Breakdown (pie/bar)
```sql
-- Dashboard
SELECT route, COUNT(*) AS requests
FROM "mhealth_app"
WHERE event LIKE '%.request' AND route LIKE '/api/agents/%' AND _timestamp BETWEEN $__from AND $__to
GROUP BY route ORDER BY requests DESC

-- Explorer
SELECT route, COUNT(*) AS requests
FROM "mhealth_app"
WHERE event LIKE '%.request' AND route LIKE '/api/agents/%'
GROUP BY route ORDER BY requests DESC
```

### Tool Calls Per Agent
```sql
-- Dashboard
SELECT agent, COUNT(*) AS tool_calls
FROM "mhealth_app"
WHERE event = 'metric.counter' AND counter = 'tool_call' AND _timestamp BETWEEN $__from AND $__to
GROUP BY agent ORDER BY tool_calls DESC

-- Explorer
SELECT agent, COUNT(*) AS tool_calls
FROM "mhealth_app"
WHERE event = 'metric.counter' AND counter = 'tool_call'
GROUP BY agent ORDER BY tool_calls DESC
```

---

## Row 5 — Appeal Pipeline

### Appeal Full Pipeline (funnel)
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'masshealth.appeals.categories.start' THEN 1 ELSE 0 END) AS cat_start,
  SUM(CASE WHEN event = 'masshealth.appeals.categories.done'  THEN 1 ELSE 0 END) AS cat_done,
  SUM(CASE WHEN event = 'masshealth.appeals.research.start'   THEN 1 ELSE 0 END) AS research_start,
  SUM(CASE WHEN event = 'masshealth.appeals.research.done'    THEN 1 ELSE 0 END) AS research_done,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.start'      THEN 1 ELSE 0 END) AS draft_start,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.done'       THEN 1 ELSE 0 END) AS draft_done
FROM "mhealth_app"
WHERE event LIKE 'masshealth.appeals.%' AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'masshealth.appeals.categories.start' THEN 1 ELSE 0 END) AS cat_start,
  SUM(CASE WHEN event = 'masshealth.appeals.categories.done'  THEN 1 ELSE 0 END) AS cat_done,
  SUM(CASE WHEN event = 'masshealth.appeals.research.start'   THEN 1 ELSE 0 END) AS research_start,
  SUM(CASE WHEN event = 'masshealth.appeals.research.done'    THEN 1 ELSE 0 END) AS research_done,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.start'      THEN 1 ELSE 0 END) AS draft_start,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.done'       THEN 1 ELSE 0 END) AS draft_done
FROM "mhealth_app"
WHERE event LIKE 'masshealth.appeals.%'
GROUP BY week ORDER BY week
```

### Appeal Draft Success Rate
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.done'  THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.start' THEN 1 ELSE 0 END) AS started,
  ROUND(100.0
    * SUM(CASE WHEN event = 'masshealth.appeals.draft.done'  THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN event = 'masshealth.appeals.draft.start' THEN 1 ELSE 0 END), 0)
  , 1) AS success_pct
FROM "mhealth_app"
WHERE event IN ('masshealth.appeals.draft.start', 'masshealth.appeals.draft.done')
  AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.done'  THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN event = 'masshealth.appeals.draft.start' THEN 1 ELSE 0 END) AS started,
  ROUND(100.0
    * SUM(CASE WHEN event = 'masshealth.appeals.draft.done'  THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN event = 'masshealth.appeals.draft.start' THEN 1 ELSE 0 END), 0)
  , 1) AS success_pct
FROM "mhealth_app"
WHERE event IN ('masshealth.appeals.draft.start', 'masshealth.appeals.draft.done')
GROUP BY week ORDER BY week
```

### Benefit Policy Update Notifications
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'masshealth.benefitPolicyUpdates.notify.done'    THEN 1 ELSE 0 END) AS notified,
  SUM(CASE WHEN event = 'masshealth.benefitPolicyUpdates.notify.skipped' THEN 1 ELSE 0 END) AS skipped
FROM "mhealth_app"
WHERE event LIKE 'masshealth.benefitPolicyUpdates.notify.%' AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'masshealth.benefitPolicyUpdates.notify.done'    THEN 1 ELSE 0 END) AS notified,
  SUM(CASE WHEN event = 'masshealth.benefitPolicyUpdates.notify.skipped' THEN 1 ELSE 0 END) AS skipped
FROM "mhealth_app"
WHERE event LIKE 'masshealth.benefitPolicyUpdates.notify.%'
GROUP BY week ORDER BY week
```

---

## Row 6 — Document Processing

### Document Parse Success Breakdown
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'parse-application.regex-success'    THEN 1 ELSE 0 END) AS regex,
  SUM(CASE WHEN event = 'parse-application.pdf-llm-success'  THEN 1 ELSE 0 END) AS pdf_llm,
  SUM(CASE WHEN event = 'parse-application.vision-success'   THEN 1 ELSE 0 END) AS vision,
  SUM(CASE WHEN event = 'parse-application.service-success'  THEN 1 ELSE 0 END) AS service,
  SUM(CASE WHEN event = 'parse-application.all-paths-failed' THEN 1 ELSE 0 END) AS failed,
  SUM(CASE WHEN event LIKE 'parse-application.rejected%'     THEN 1 ELSE 0 END) AS rejected
FROM "mhealth_app"
WHERE event LIKE 'parse-application.%' AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'parse-application.regex-success'    THEN 1 ELSE 0 END) AS regex,
  SUM(CASE WHEN event = 'parse-application.pdf-llm-success'  THEN 1 ELSE 0 END) AS pdf_llm,
  SUM(CASE WHEN event = 'parse-application.vision-success'   THEN 1 ELSE 0 END) AS vision,
  SUM(CASE WHEN event = 'parse-application.service-success'  THEN 1 ELSE 0 END) AS service,
  SUM(CASE WHEN event = 'parse-application.all-paths-failed' THEN 1 ELSE 0 END) AS failed,
  SUM(CASE WHEN event LIKE 'parse-application.rejected%'     THEN 1 ELSE 0 END) AS rejected
FROM "mhealth_app"
WHERE event LIKE 'parse-application.%'
GROUP BY week ORDER BY week
```

### Document Parse Results (pie chart)
```sql
-- Dashboard
SELECT REPLACE(event, 'parse-application.', '') AS result, COUNT(*) AS count
FROM "mhealth_app"
WHERE event LIKE 'parse-application.%' AND _timestamp BETWEEN $__from AND $__to
GROUP BY event ORDER BY count DESC

-- Explorer
SELECT REPLACE(event, 'parse-application.', '') AS result, COUNT(*) AS count
FROM "mhealth_app"
WHERE event LIKE 'parse-application.%'
GROUP BY event ORDER BY count DESC
```

---

## Row 7 — AI Quality (RAG & Reflection)

### RAG & AI Quality Counters (daily)
```sql
-- Dashboard
SELECT date_trunc('day', to_timestamp(ts)) AS day,
  SUM(CASE WHEN counter = 'rag_empty_result'         THEN 1 ELSE 0 END) AS rag_no_match,
  SUM(CASE WHEN counter = 'rag_low_confidence_used'  THEN 1 ELSE 0 END) AS rag_low_confidence,
  SUM(CASE WHEN counter = 'rag_embedding_error'      THEN 1 ELSE 0 END) AS rag_embed_err,
  SUM(CASE WHEN counter = 'memory_hit'               THEN 1 ELSE 0 END) AS memory_hits,
  SUM(CASE WHEN counter = 'memory_stale'             THEN 1 ELSE 0 END) AS memory_stale,
  SUM(CASE WHEN counter = 'reflection_revision'      THEN 1 ELSE 0 END) AS reflections,
  SUM(CASE WHEN counter = 'extraction_parse_failure' THEN 1 ELSE 0 END) AS parse_failures
FROM "mhealth_app"
WHERE event = 'metric.counter' AND _timestamp BETWEEN $__from AND $__to
GROUP BY day ORDER BY day

-- Explorer
SELECT date_trunc('day', to_timestamp(ts)) AS day,
  SUM(CASE WHEN counter = 'rag_empty_result'         THEN 1 ELSE 0 END) AS rag_no_match,
  SUM(CASE WHEN counter = 'rag_low_confidence_used'  THEN 1 ELSE 0 END) AS rag_low_confidence,
  SUM(CASE WHEN counter = 'rag_embedding_error'      THEN 1 ELSE 0 END) AS rag_embed_err,
  SUM(CASE WHEN counter = 'memory_hit'               THEN 1 ELSE 0 END) AS memory_hits,
  SUM(CASE WHEN counter = 'memory_stale'             THEN 1 ELSE 0 END) AS memory_stale,
  SUM(CASE WHEN counter = 'reflection_revision'      THEN 1 ELSE 0 END) AS reflections,
  SUM(CASE WHEN counter = 'extraction_parse_failure' THEN 1 ELSE 0 END) AS parse_failures
FROM "mhealth_app"
WHERE event = 'metric.counter'
GROUP BY day ORDER BY day
```

### Memory Hit Rate %
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN counter = 'memory_hit'   THEN 1 ELSE 0 END) AS hits,
  SUM(CASE WHEN counter = 'memory_stale' THEN 1 ELSE 0 END) AS stale,
  ROUND(100.0
    * SUM(CASE WHEN counter = 'memory_hit' THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN counter IN ('memory_hit','memory_stale') THEN 1 ELSE 0 END), 0)
  , 1) AS hit_rate_pct
FROM "mhealth_app"
WHERE event = 'metric.counter' AND counter IN ('memory_hit','memory_stale')
  AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN counter = 'memory_hit'   THEN 1 ELSE 0 END) AS hits,
  SUM(CASE WHEN counter = 'memory_stale' THEN 1 ELSE 0 END) AS stale,
  ROUND(100.0
    * SUM(CASE WHEN counter = 'memory_hit' THEN 1 ELSE 0 END)
    / NULLIF(SUM(CASE WHEN counter IN ('memory_hit','memory_stale') THEN 1 ELSE 0 END), 0)
  , 1) AS hit_rate_pct
FROM "mhealth_app"
WHERE event = 'metric.counter' AND counter IN ('memory_hit','memory_stale')
GROUP BY week ORDER BY week
```

---

## Row 8 — Growth

### Mailing List Signups Per Week
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(*) AS signups
FROM "mhealth_app"
WHERE event = 'growth.mailing_list.signup' AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week, COUNT(*) AS signups
FROM "mhealth_app"
WHERE event = 'growth.mailing_list.signup'
GROUP BY week ORDER BY week
```

### User Invites Sent Per Week
```sql
-- Dashboard
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'invite.email_sent'  THEN 1 ELSE 0 END) AS emails_sent,
  SUM(CASE WHEN event = 'invite.no_resend_key' THEN 1 ELSE 0 END) AS skipped_no_key
FROM "mhealth_app"
WHERE event IN ('invite.email_sent', 'invite.no_resend_key') AND _timestamp BETWEEN $__from AND $__to
GROUP BY week ORDER BY week

-- Explorer
SELECT date_trunc('week', to_timestamp(ts)) AS week,
  SUM(CASE WHEN event = 'invite.email_sent'    THEN 1 ELSE 0 END) AS emails_sent,
  SUM(CASE WHEN event = 'invite.no_resend_key' THEN 1 ELSE 0 END) AS skipped_no_key
FROM "mhealth_app"
WHERE event IN ('invite.email_sent', 'invite.no_resend_key')
GROUP BY week ORDER BY week
```

---

## Row 9 — Errors & Health

### Error Volume Per Day
```sql
-- Dashboard
SELECT date_trunc('day', to_timestamp(ts)) AS day, COUNT(*) AS errors
FROM "mhealth_app"
WHERE level = 'error' AND service = 'healthcompass-app' AND _timestamp BETWEEN $__from AND $__to
GROUP BY day ORDER BY day

-- Explorer
SELECT date_trunc('day', to_timestamp(ts)) AS day, COUNT(*) AS errors
FROM "mhealth_app"
WHERE level = 'error' AND service = 'healthcompass-app'
GROUP BY day ORDER BY day
```

### Top Error Routes
```sql
-- Dashboard
SELECT route, COUNT(*) AS errors
FROM "mhealth_app"
WHERE level = 'error' AND route IS NOT NULL AND _timestamp BETWEEN $__from AND $__to
GROUP BY route ORDER BY errors DESC LIMIT 15

-- Explorer
SELECT route, COUNT(*) AS errors
FROM "mhealth_app"
WHERE level = 'error' AND route IS NOT NULL
GROUP BY route ORDER BY errors DESC LIMIT 15
```

### Error Rate % Per Day
```sql
-- Dashboard
SELECT date_trunc('day', to_timestamp(ts)) AS day,
  SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) AS errors,
  SUM(CASE WHEN level = 'info'  THEN 1 ELSE 0 END) AS info_logs,
  ROUND(100.0
    * SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0)
  , 2) AS error_pct
FROM "mhealth_app"
WHERE service = 'healthcompass-app' AND _timestamp BETWEEN $__from AND $__to
GROUP BY day ORDER BY day

-- Explorer
SELECT date_trunc('day', to_timestamp(ts)) AS day,
  SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) AS errors,
  SUM(CASE WHEN level = 'info'  THEN 1 ELSE 0 END) AS info_logs,
  ROUND(100.0
    * SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0)
  , 2) AS error_pct
FROM "mhealth_app"
WHERE service = 'healthcompass-app'
GROUP BY day ORDER BY day
```

### Top Error Events
```sql
-- Dashboard
SELECT event, COUNT(*) AS count
FROM "mhealth_app"
WHERE level = 'error' AND _timestamp BETWEEN $__from AND $__to
GROUP BY event ORDER BY count DESC LIMIT 20

-- Explorer
SELECT event, COUNT(*) AS count
FROM "mhealth_app"
WHERE level = 'error'
GROUP BY event ORDER BY count DESC LIMIT 20
```
