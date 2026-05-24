/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ComponentProps } from "react"

import { PhiSaveExitDialog } from "@/components/application/phi-save-exit-dialog"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { buildStorageDraft } from "@/lib/phi-token/token"
import type { WizardState } from "@/components/application/aca3/types"

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: vi.fn(),
}))

vi.mock("@/lib/phi-token/token", async () => {
  const actual = await vi.importActual<typeof import("@/lib/phi-token/token")>("@/lib/phi-token/token")
  return {
    ...actual,
    splitWizardState: vi.fn(() => ({ phiPayload: { contact: { p1_name: "Ada" } }, safeState: {} })),
    buildStorageDraft: vi.fn(),
  }
})

const wizardState = {
  data: {
    preApp: {},
    contact: { p1_name: "Ada" },
    assister: {},
    assisterEnabled: false,
    persons: [],
    attestation: false,
  },
  currentStep: 7,
  completedSteps: [1, 2, 3, 4, 5, 6],
  tabByStep: { 4: 0, 5: 0, 6: 0, 7: 0 },
  errors: {},
  dirty: true,
  submitted: false,
} satisfies WizardState

function renderDialog(
  overrides: Partial<ComponentProps<typeof PhiSaveExitDialog>> & {
    onBeforeSecureSave?: () => Promise<boolean>
  } = {},
) {
  const props: ComponentProps<typeof PhiSaveExitDialog> & {
    onBeforeSecureSave?: () => Promise<boolean>
  } = {
    open: true,
    applicationId: "9b786f61-c945-4098-b813-e62c069114d2",
    wizardState,
    onExit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }

  return render(<PhiSaveExitDialog {...props} />)
}

describe("PhiSaveExitDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(buildStorageDraft).mockResolvedValue({
      resumeId: "11111111-1111-4111-8111-111111111111",
      encryptedBlob: "{\"v\":1}",
      keyBase64: "key-base64",
      resumeTokenString: "resume-token",
    })
    vi.mocked(authenticatedFetch).mockResolvedValue({ ok: true } as Response)
  })

  it("saves the safe draft before uploading the encrypted PHI blob", async () => {
    const onBeforeSecureSave = vi.fn().mockResolvedValue(true)
    renderDialog({ onBeforeSecureSave })

    await userEvent.click(screen.getByRole("button", { name: /^save & exit$/i }))

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalled())
    expect(onBeforeSecureSave).toHaveBeenCalledBefore(vi.mocked(authenticatedFetch))
  })

  it("does not upload PHI when the safe draft save fails", async () => {
    const onBeforeSecureSave = vi.fn().mockResolvedValue(false)
    renderDialog({ onBeforeSecureSave })

    await userEvent.click(screen.getByRole("button", { name: /^save & exit$/i }))

    await waitFor(() => {
      expect(screen.getByText("Unable to save application progress. Please try again.")).toBeInTheDocument()
    })
    expect(authenticatedFetch).not.toHaveBeenCalled()
  })

  it("passes acting-for patient context to the PHI upload", async () => {
    renderDialog({
      actingForPatientId: "22222222-2222-4222-8222-222222222222",
      onBeforeSecureSave: vi.fn().mockResolvedValue(true),
    })

    await userEvent.click(screen.getByRole("button", { name: /^save & exit$/i }))

    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalled())
    expect(vi.mocked(authenticatedFetch).mock.calls.at(-1)?.[1]).toMatchObject({
      headers: {
        "X-Acting-For-Patient": "22222222-2222-4222-8222-222222222222",
      },
    })
  })
})
