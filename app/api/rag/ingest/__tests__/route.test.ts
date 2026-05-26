/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthenticatedUser: vi.fn().mockResolvedValue({
    ok: true,
    userId: "11111111-1111-4111-8111-111111111111",
    response: null,
  }),
}))

vi.mock("@/lib/rag/ingest", () => ({
  ingestAllDocuments: vi.fn().mockResolvedValue([]),
  POLICY_SOURCES: [],
}))

vi.mock("@/lib/server/logger", () => ({ logServerError: vi.fn() }))

async function importRoute() {
  const mod = await import("@/app/api/rag/ingest/route")
  return mod.POST
}

describe("POST /api/rag/ingest — secret guard", () => {
  const originalEnv = process.env.RAG_INGEST_SECRET

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.RAG_INGEST_SECRET
    else process.env.RAG_INGEST_SECRET = originalEnv
    vi.resetModules()
  })

  it("returns 403 when RAG_INGEST_SECRET is not set", async () => {
    delete process.env.RAG_INGEST_SECRET
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it("returns 403 when RAG_INGEST_SECRET is set but no key provided", async () => {
    process.env.RAG_INGEST_SECRET = "correct-secret"
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("returns 403 when wrong key is provided", async () => {
    process.env.RAG_INGEST_SECRET = "correct-secret"
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      headers: { "x-ingest-key": "wrong-secret" },
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("allows the request when the correct key is provided", async () => {
    process.env.RAG_INGEST_SECRET = "correct-secret"
    const POST = await importRoute()
    const req = new NextRequest("http://localhost/api/rag/ingest", {
      method: "POST",
      headers: { "x-ingest-key": "correct-secret" },
      body: "",
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
