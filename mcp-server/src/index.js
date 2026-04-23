import express from 'express';
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_URL = process.env.BASE_URL || 'https://healthcompass.cloud';

// ── In-memory stores (sufficient for single-instance MCP) ────────────────────
const authCodes = new Map();  // code → { clientId, redirectUri, expiresAt }
const tokens = new Map();     // token → { clientId, expiresAt }

// ── OAuth 2.0: Server metadata (MCP spec requires this) ──────────────────────
app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/oauth/authorize`,
    token_endpoint: `${BASE_URL}/oauth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  });
});

// ── OAuth 2.0: Authorization endpoint ────────────────────────────────────────
// Claude.ai redirects the user here; we auto-approve and send back the code.
app.get('/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, state, response_type } = req.query;

  if (client_id !== process.env.MCP_CLIENT_ID) {
    return res.status(400).send('Unknown client_id');
  }
  if (response_type !== 'code') {
    return res.status(400).send('Only response_type=code is supported');
  }

  const code = crypto.randomBytes(24).toString('hex');
  authCodes.set(code, {
    clientId: client_id,
    redirectUri: redirect_uri,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  });

  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  res.redirect(url.toString());
});

// ── OAuth 2.0: Token endpoint ─────────────────────────────────────────────────
app.post('/oauth/token', (req, res) => {
  const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;

  if (client_id !== process.env.MCP_CLIENT_ID || client_secret !== process.env.MCP_CLIENT_SECRET) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const entry = authCodes.get(code);
  if (!entry || entry.expiresAt < Date.now() || entry.clientId !== client_id) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  authCodes.delete(code);

  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { clientId: client_id, expiresAt: Date.now() + 8 * 60 * 60 * 1000 }); // 8h

  res.json({ access_token: token, token_type: 'Bearer', expires_in: 28800 });
});

// ── Token validation middleware for /mcp ─────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  const entry = tokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  next();
}

// ── MCP tools ─────────────────────────────────────────────────────────────────
function createServer() {
  const server = new McpServer({
    name: 'healthcompass-mcp',
    version: '1.0.0',
  });

  server.tool('ping', 'Check if the MCP server is alive', {}, async () => ({
    content: [{ type: 'text', text: 'pong — HealthCompass MCP server is running' }],
  }));

  // Add your tools here:
  // server.tool('tool_name', 'description', { param: z.string() }, async ({ param }) => { ... });

  return server;
}

// ── MCP endpoint (protected) ──────────────────────────────────────────────────
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

// ── Liveness probe ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MCP server listening on :${PORT}`));
