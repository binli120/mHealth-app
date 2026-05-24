/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  decryptStorageDraft: vi.fn(),
  mergePhiIntoState: vi.fn((serverState: Record<string, unknown>, phiPayload: Record<string, unknown>) => ({
    ...serverState,
    data: {
      ...((serverState.data as Record<string, unknown> | undefined) ?? {}),
      ...phiPayload,
    },
  })),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}))

vi.mock("@/lib/phi-token/token", () => ({
  decryptStorageDraft: mocks.decryptStorageDraft,
  mergePhiIntoState: mocks.mergePhiIntoState,
}))

import { restorePhiDraftState } from "@/lib/phi-token/restore"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("restorePhiDraftState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses the server-returned encrypted AES key when no manual key is provided", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, encryptedBlob: "encrypted-payload", aesKeyBase64: "server-key" }),
    )
    mocks.decryptStorageDraft.mockResolvedValue({ contact: { p1_name: "Maria Patient" } })

    const restored = await restorePhiDraftState({
      applicationId: "application-id",
      resumeId: "resume-id",
      serverState: { currentStep: 7, data: { assister: {} } },
    })

    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/applications/application-id/phi-draft?resumeId=resume-id",
      { cache: "no-store", headers: {} },
    )
    expect(mocks.decryptStorageDraft).toHaveBeenCalledWith("encrypted-payload", "server-key")
    expect(restored).toMatchObject({
      currentStep: 7,
      data: {
        assister: {},
        contact: { p1_name: "Maria Patient" },
      },
    })
  })

  it("prefers a manual backup key over the server key", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, encryptedBlob: "encrypted-payload", aesKeyBase64: "server-key" }),
    )
    mocks.decryptStorageDraft.mockResolvedValue({ contact: { p1_name: "Maria Patient" } })

    await restorePhiDraftState({
      applicationId: "application-id",
      resumeId: "resume-id",
      serverState: { data: {} },
      keyBase64: "manual-key",
    })

    expect(mocks.decryptStorageDraft).toHaveBeenCalledWith("encrypted-payload", "manual-key")
  })

  it("fails clearly when no decryption key is available", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      jsonResponse({ ok: true, encryptedBlob: "encrypted-payload", aesKeyBase64: null }),
    )

    await expect(
      restorePhiDraftState({
        applicationId: "application-id",
        resumeId: "resume-id",
        serverState: { data: {} },
      }),
    ).rejects.toThrow("Encryption key not available.")
  })
})
