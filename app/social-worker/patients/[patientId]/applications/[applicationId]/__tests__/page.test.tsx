// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useParams: () => ({ patientId: "patient-1", applicationId: "app-1" }),
}))
vi.mock("@/components/application/saca2/use-is-saca2-application", () => ({
  useIsSaca2Application: vi.fn(),
}))
vi.mock("@/components/application/aca3/form-wizard", () => ({
  FormWizard: () => <div data-testid="form-wizard" />,
}))
vi.mock("@/components/application/aca3/intake-chat", () => ({
  IntakeChat: () => <div data-testid="intake-chat" />,
}))

import SWEditApplicationPage from "@/app/social-worker/patients/[patientId]/applications/[applicationId]/page"
import { useIsSaca2Application } from "@/components/application/saca2/use-is-saca2-application"

describe("SWEditApplicationPage SACA-2 gate", () => {
  beforeEach(() => {
    cleanup()
    vi.mocked(useIsSaca2Application).mockReset()
  })

  it.each(["saca2", "error"] as const)("shows the social-worker notice and no ACA-3 UI for %s", (lookup) => {
    vi.mocked(useIsSaca2Application).mockReturnValue(lookup)
    render(<SWEditApplicationPage />)
    expect(screen.getByTestId("saca2-unavailable")).toBeTruthy()
    expect(screen.getByText(/Social-worker editing of SACA-2/)).toBeTruthy()
    expect(screen.queryByTestId("intake-chat")).toBeNull()
    expect(screen.queryByTestId("form-wizard")).toBeNull()
  })

  it("shows a loading line while the type is unknown", () => {
    vi.mocked(useIsSaca2Application).mockReturnValue("unknown")
    render(<SWEditApplicationPage />)
    expect(screen.getByTestId("sw-application-loading")).toBeTruthy()
    expect(screen.queryByTestId("intake-chat")).toBeNull()
    expect(screen.queryByTestId("form-wizard")).toBeNull()
  })

  it("renders the existing tabs UI for other applications", () => {
    vi.mocked(useIsSaca2Application).mockReturnValue("other")
    render(<SWEditApplicationPage />)
    expect(screen.queryByTestId("saca2-unavailable")).toBeNull()
    expect(screen.getByTestId("intake-chat")).toBeTruthy()
    expect(useIsSaca2Application).toHaveBeenCalledWith("app-1", "", "patient-1")
  })
})
