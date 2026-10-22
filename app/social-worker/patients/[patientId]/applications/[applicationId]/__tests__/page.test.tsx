// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

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

  it("shows the social-worker notice and no ACA-3 UI for saca2", () => {
    vi.mocked(useIsSaca2Application).mockReturnValue("saca2")
    render(<SWEditApplicationPage />)
    expect(screen.getByTestId("saca2-unavailable")).toBeTruthy()
    expect(screen.getByText(/Social-worker editing of SACA-2/)).toBeTruthy()
    expect(screen.queryByTestId("application-lookup-error")).toBeNull()
    expect(screen.queryByTestId("intake-chat")).toBeNull()
    expect(screen.queryByTestId("form-wizard")).toBeNull()
  })

  it("shows a retryable error panel, not the SACA-2 notice or ACA-3 UI, when the lookup failed", () => {
    vi.mocked(useIsSaca2Application).mockReturnValue("error")
    render(<SWEditApplicationPage />)
    const panel = screen.getByTestId("application-lookup-error")
    expect(panel.getAttribute("role")).toBe("alert")
    expect(panel.textContent).toMatch(/couldn.t load/i)
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy()
    expect(screen.queryByTestId("saca2-unavailable")).toBeNull()
    expect(screen.queryByText(/SACA-2 application/)).toBeNull()
    expect(screen.queryByTestId("intake-chat")).toBeNull()
    expect(screen.queryByTestId("form-wizard")).toBeNull()
  })

  it("Try again re-runs the lookup with a new retry key and shows loading while it is pending", () => {
    vi.mocked(useIsSaca2Application).mockImplementation((_id, _type, _patient, retryKey) =>
      retryKey ? "unknown" : "error",
    )
    render(<SWEditApplicationPage />)
    expect(vi.mocked(useIsSaca2Application).mock.calls.at(-1)?.[3]).toBeFalsy()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(vi.mocked(useIsSaca2Application).mock.calls.at(-1)?.[3]).toBeTruthy()
    expect(screen.getByTestId("sw-application-loading")).toBeTruthy()
    expect(screen.queryByTestId("application-lookup-error")).toBeNull()
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
    expect(useIsSaca2Application).toHaveBeenCalledWith("app-1", "", "patient-1", 0)
  })
})
