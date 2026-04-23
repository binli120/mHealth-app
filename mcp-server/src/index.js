import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

// ── Bearer token auth (set MCP_SECRET env var to enable) ─────────────────────
app.use('/mcp', (req, res, next) => {
  const secret = process.env.MCP_SECRET;
  if (!secret) return next(); // no secret configured → open (dev only)
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== secret) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

function createServer() {
  const server = new McpServer({
    name: 'healthcompass-mcp',
    version: '1.0.0',
  });

  // ── Health check ──────────────────────────────────────────────────────────
  server.tool('ping', 'Check if the MCP server is alive', {}, async () => ({
    content: [{ type: 'text', text: 'pong — HealthCompass MCP server is running' }],
  }));

  // ── Add your tools here ───────────────────────────────────────────────────
  // Example:
  // server.tool(
  //   'get_patient_status',
  //   'Fetch current application status for a patient',
  //   { patient_id: z.string().describe('The patient UUID') },
  //   async ({ patient_id }) => {
  //     // call your DB or internal API here
  //     return { content: [{ type: 'text', text: `Status for ${patient_id}` }] };
  //   }
  // );

  return server;
}

// Stateless Streamable HTTP — one fresh MCP session per POST request
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  res.on('finish', () => server.close());
});

app.get('/mcp', (_req, res) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Use POST for MCP requests' } });
});

// Liveness probe for Docker health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MCP server listening on :${PORT}`));
