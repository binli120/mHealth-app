import express from 'express';
import crypto from 'crypto';
import pg from 'pg';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const { Pool } = pg;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_URL = process.env.BASE_URL || 'https://healthcompass.cloud';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── In-memory OAuth stores ────────────────────────────────────────────────────
const authCodes = new Map();
const tokens    = new Map();

// ── OAuth: server metadata ────────────────────────────────────────────────────
app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/authorize`,
    token_endpoint: `${BASE_URL}/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  });
});

// ── OAuth: authorization ──────────────────────────────────────────────────────
app.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, state, response_type } = req.query;
  if (client_id !== process.env.MCP_CLIENT_ID)
    return res.status(400).send('Unknown client_id');
  if (response_type !== 'code')
    return res.status(400).send('Only response_type=code is supported');

  const code = crypto.randomBytes(24).toString('hex');
  authCodes.set(code, { clientId: client_id, redirectUri: redirect_uri, expiresAt: Date.now() + 5 * 60 * 1000 });

  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  res.redirect(url.toString());
});

// ── OAuth: token ──────────────────────────────────────────────────────────────
app.post('/token', (req, res) => {
  const { grant_type, code, client_id, client_secret } = req.body;
  if (client_id !== process.env.MCP_CLIENT_ID || client_secret !== process.env.MCP_CLIENT_SECRET)
    return res.status(401).json({ error: 'invalid_client' });
  if (grant_type !== 'authorization_code')
    return res.status(400).json({ error: 'unsupported_grant_type' });

  const entry = authCodes.get(code);
  if (!entry || entry.expiresAt < Date.now() || entry.clientId !== client_id)
    return res.status(400).json({ error: 'invalid_grant' });
  authCodes.delete(code);

  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { clientId: client_id, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 28800 });
});

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const entry = token && tokens.get(token);
  if (!entry || entry.expiresAt < Date.now())
    return res.status(401).json({ error: 'Invalid or expired token' });
  next();
}

// ── MCP tools ─────────────────────────────────────────────────────────────────
function createServer() {
  const server = new McpServer({ name: 'healthcompass-mcp', version: '1.0.0' });

  // ── 1. Application stats ────────────────────────────────────────────────────
  server.tool(
    'get_application_stats',
    'Summary counts of applications by status plus recent submission activity',
    {},
    async () => {
      const { rows: byStatus } = await pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM public.applications
        GROUP BY status
        ORDER BY count DESC
      `);
      const { rows: recent } = await pool.query(`
        SELECT DATE(submitted_at) AS date, COUNT(*)::int AS submissions
        FROM public.applications
        WHERE submitted_at >= NOW() - INTERVAL '14 days'
        GROUP BY date ORDER BY date DESC
      `);
      return { content: [{ type: 'text', text: JSON.stringify({ by_status: byStatus, last_14_days: recent }, null, 2) }] };
    }
  );

  // ── 2. List applications ────────────────────────────────────────────────────
  server.tool(
    'list_applications',
    'List benefit applications with optional status filter and search by applicant name',
    {
      status: z.enum(['draft','submitted','ai_extracted','needs_review','rfi_requested','approved','denied']).optional().describe('Filter by status'),
      search: z.string().optional().describe('Search by applicant first or last name'),
      limit:  z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
    async ({ status, search, limit, offset }) => {
      const params = [];
      const where  = [];
      if (status) { params.push(status);  where.push(`a.status = $${params.length}`); }
      if (search) { params.push(`%${search}%`); where.push(`(ap.first_name ILIKE $${params.length} OR ap.last_name ILIKE $${params.length})`); }
      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      params.push(limit, offset);

      const { rows } = await pool.query(`
        SELECT
          a.id, a.status, a.household_size, a.total_monthly_income,
          a.confidence_score, a.submitted_at, a.decided_at, a.created_at,
          ap.first_name, ap.last_name, ap.dob, ap.phone, ap.city, ap.state
        FROM public.applications a
        JOIN public.applicants ap ON ap.id = a.applicant_id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params);

      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── 3. Get single application ───────────────────────────────────────────────
  server.tool(
    'get_application',
    'Full details for one application: applicant, household members, incomes, documents, validation issues, eligibility screening',
    { application_id: z.string().uuid().describe('Application UUID') },
    async ({ application_id }) => {
      const [appRes, membersRes, incomesRes, docsRes, validRes, screenRes, rfiRes] = await Promise.all([
        pool.query(`
          SELECT a.*, ap.first_name, ap.last_name, ap.dob, ap.phone,
                 ap.address_line1, ap.city, ap.state, ap.zip, ap.citizenship_status, u.email
          FROM public.applications a
          JOIN public.applicants ap ON ap.id = a.applicant_id
          JOIN public.users u ON u.id = ap.user_id
          WHERE a.id = $1::uuid
        `, [application_id]),
        pool.query(`SELECT * FROM public.household_members WHERE application_id = $1::uuid ORDER BY created_at`, [application_id]),
        pool.query(`SELECT * FROM public.incomes WHERE application_id = $1::uuid ORDER BY created_at`, [application_id]),
        pool.query(`SELECT id, document_type, file_url, mime_type, uploaded_at FROM public.documents WHERE application_id = $1::uuid ORDER BY uploaded_at`, [application_id]),
        pool.query(`SELECT rule_name, severity, message, resolved FROM public.validation_results WHERE application_id = $1::uuid ORDER BY severity`, [application_id]),
        pool.query(`SELECT estimated_program, fpl_percentage, screening_result, created_at FROM public.eligibility_screenings WHERE application_id = $1::uuid ORDER BY created_at DESC LIMIT 1`, [application_id]),
        pool.query(`SELECT message, due_date, resolved, created_at FROM public.rfis WHERE application_id = $1::uuid ORDER BY created_at DESC`, [application_id]),
      ]);

      if (!appRes.rows.length) return { content: [{ type: 'text', text: 'Application not found' }] };

      const result = {
        application:    appRes.rows[0],
        household:      membersRes.rows,
        incomes:        incomesRes.rows,
        documents:      docsRes.rows,
        validation:     validRes.rows,
        eligibility:    screenRes.rows[0] ?? null,
        rfis:           rfiRes.rows,
      };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── 4. Pending reviews ──────────────────────────────────────────────────────
  server.tool(
    'list_pending_reviews',
    'Applications waiting for reviewer action (needs_review or rfi_requested), ordered by submission date',
    { limit: z.number().int().min(1).max(100).default(20) },
    async ({ limit }) => {
      const { rows } = await pool.query(`
        SELECT
          a.id, a.status, a.household_size, a.total_monthly_income,
          a.confidence_score, a.submitted_at,
          ap.first_name, ap.last_name, ap.dob,
          (SELECT COUNT(*)::int FROM public.validation_results vr
           WHERE vr.application_id = a.id AND vr.resolved = false) AS open_issues,
          (SELECT COUNT(*)::int FROM public.rfis r
           WHERE r.application_id = a.id AND r.resolved = false) AS open_rfis
        FROM public.applications a
        JOIN public.applicants ap ON ap.id = a.applicant_id
        WHERE a.status IN ('needs_review', 'rfi_requested')
        ORDER BY a.submitted_at ASC
        LIMIT $1
      `, [limit]);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── 5. Review history for an application ───────────────────────────────────
  server.tool(
    'get_review_history',
    'All reviewer actions taken on an application (approve/deny/rfi) with notes',
    { application_id: z.string().uuid() },
    async ({ application_id }) => {
      const { rows } = await pool.query(`
        SELECT ra.action_type, ra.notes, ra.created_at,
               u.email AS reviewer_email
        FROM public.review_actions ra
        JOIN public.users u ON u.id = ra.reviewer_id
        WHERE ra.application_id = $1::uuid
        ORDER BY ra.created_at DESC
      `, [application_id]);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── 6. Social worker caseload ───────────────────────────────────────────────
  server.tool(
    'get_patient_caseload',
    'All active patients assigned to a social worker with their latest application status',
    { social_worker_user_id: z.string().uuid().describe('Social worker user UUID') },
    async ({ social_worker_user_id }) => {
      const { rows } = await pool.query(`
        SELECT
          psa.patient_user_id,
          u.email,
          ap.first_name, ap.last_name, ap.dob, ap.phone, ap.city, ap.state,
          psa.granted_at,
          COUNT(a.id)::int AS application_count,
          (
            SELECT a2.status FROM public.applications a2
            JOIN public.applicants ap2 ON ap2.id = a2.applicant_id
            WHERE ap2.user_id = psa.patient_user_id
            ORDER BY a2.created_at DESC LIMIT 1
          ) AS latest_status
        FROM public.patient_social_worker_access psa
        JOIN public.users u ON u.id = psa.patient_user_id
        LEFT JOIN public.applicants ap ON ap.user_id = psa.patient_user_id
        LEFT JOIN public.applications a ON a.applicant_id = ap.id
        WHERE psa.social_worker_user_id = $1::uuid AND psa.is_active = true
        GROUP BY psa.patient_user_id, u.email, ap.first_name, ap.last_name,
                 ap.dob, ap.phone, ap.city, ap.state, psa.granted_at
        ORDER BY psa.granted_at DESC
      `, [social_worker_user_id]);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── 7. Patient summary ──────────────────────────────────────────────────────
  server.tool(
    'get_patient_summary',
    'Full profile for a patient: personal info, all applications and their statuses, open RFIs',
    { patient_user_id: z.string().uuid().describe('Patient user UUID') },
    async ({ patient_user_id }) => {
      const [profileRes, appsRes] = await Promise.all([
        pool.query(`
          SELECT ap.*, u.email
          FROM public.applicants ap
          JOIN public.users u ON u.id = ap.user_id
          WHERE ap.user_id = $1::uuid
        `, [patient_user_id]),
        pool.query(`
          SELECT a.id, a.status, a.household_size, a.total_monthly_income,
                 a.submitted_at, a.decided_at,
                 (SELECT json_agg(json_build_object('message', r.message, 'due_date', r.due_date, 'resolved', r.resolved))
                  FROM public.rfis r WHERE r.application_id = a.id) AS rfis
          FROM public.applications a
          JOIN public.applicants ap ON ap.id = a.applicant_id
          WHERE ap.user_id = $1::uuid
          ORDER BY a.created_at DESC
        `, [patient_user_id]),
      ]);

      if (!profileRes.rows.length) return { content: [{ type: 'text', text: 'Patient not found' }] };
      const result = { profile: profileRes.rows[0], applications: appsRes.rows };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── 8. Search users ─────────────────────────────────────────────────────────
  server.tool(
    'search_users',
    'Search for users (applicants, social workers, reviewers) by name or email',
    {
      query: z.string().min(2).describe('Name or email search term'),
      role:  z.enum(['applicant','social_worker','reviewer','admin']).optional(),
    },
    async ({ query, role }) => {
      const params = [`%${query}%`, `%${query}%`];
      let roleJoin = '';
      if (role) { params.push(role); roleJoin = `AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id AND ro.name = $${params.length})`; }

      const { rows } = await pool.query(`
        SELECT u.id, u.email, u.is_active, u.created_at,
               ap.first_name, ap.last_name, ap.phone,
               array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
        FROM public.users u
        LEFT JOIN public.applicants ap ON ap.user_id = u.id
        LEFT JOIN public.user_roles ur ON ur.user_id = u.id
        LEFT JOIN public.roles r ON r.id = ur.role_id
        WHERE (u.email ILIKE $1 OR ap.first_name ILIKE $2 OR ap.last_name ILIKE $2)
        ${roleJoin}
        GROUP BY u.id, u.email, u.is_active, u.created_at, ap.first_name, ap.last_name, ap.phone
        ORDER BY u.created_at DESC
        LIMIT 25
      `, params);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── 9. Open RFIs ────────────────────────────────────────────────────────────
  server.tool(
    'list_open_rfis',
    'All unresolved Requests for Information across applications, optionally filtered by due date urgency',
    { overdue_only: z.boolean().default(false).describe('Only show RFIs past their due date') },
    async ({ overdue_only }) => {
      const { rows } = await pool.query(`
        SELECT r.id, r.application_id, r.message, r.due_date, r.created_at,
               ap.first_name, ap.last_name, u.email,
               a.status AS application_status
        FROM public.rfis r
        JOIN public.applications a ON a.id = r.application_id
        JOIN public.applicants ap ON ap.id = a.applicant_id
        JOIN public.users u ON u.id = ap.user_id
        WHERE r.resolved = false
        ${overdue_only ? 'AND r.due_date < NOW()' : ''}
        ORDER BY r.due_date ASC NULLS LAST
        LIMIT 50
      `);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
  );

  // ── 10. Audit log ───────────────────────────────────────────────────────────
  server.tool(
    'get_audit_log',
    'Recent audit log entries, optionally scoped to a specific application',
    {
      application_id: z.string().uuid().optional().describe('Scope to one application'),
      limit: z.number().int().min(1).max(100).default(25),
    },
    async ({ application_id, limit }) => {
      const params = application_id ? [application_id, limit] : [limit];
      const where  = application_id ? 'WHERE al.application_id = $1::uuid' : '';
      const limitParam = application_id ? '$2' : '$1';

      const { rows } = await pool.query(`
        SELECT al.action, al.created_at, al.ip_address,
               u.email AS actor_email,
               al.application_id
        FROM public.audit_logs al
        LEFT JOIN public.users u ON u.id = al.user_id
        ${where}
        ORDER BY al.created_at DESC
        LIMIT ${limitParam}
      `, params);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    }
  );

  return server;
}

// ── MCP endpoint ──────────────────────────────────────────────────────────────
app.post('/mcp', requireAuth, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on('finish', () => server.close());
});

app.get('/mcp', (_req, res) => {
  res.status(405).json({ error: 'Use POST for MCP requests' });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MCP server listening on :${PORT}`));
