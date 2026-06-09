/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminAnalyticsPage from "@/app/admin/analytics/page"

const { mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock("@/lib/supabase/authenticated-fetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

vi.mock("recharts", () => {
  const Chart = ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>
  const Primitive = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Bar = ({ children, onClick }: { children?: React.ReactNode; onClick?: (datum: unknown) => void }) => (
    <button
      type="button"
      data-testid="chart-bar"
      onClick={() => onClick?.({ rawMonth: "2026-06", month: "Jun 2026", status: "submitted", label: "Submitted" })}
    >
      {children}
    </button>
  )
  return {
    BarChart: Chart,
    ComposedChart: Chart,
    LineChart: Chart,
    ResponsiveContainer: Primitive,
    Bar,
    Line: Primitive,
    Legend: Primitive,
    XAxis: Primitive,
    YAxis: Primitive,
    CartesianGrid: Primitive,
    Tooltip: Primitive,
    Cell: Primitive,
  }
})

const analyticsData = {
  totalApplications: 12,
  submittedThisMonth: 3,
  totalApplicants: 20,
  avgHouseholdSize: 2.5,
  applicationsByMonth: [{ month: "2026-06", count: 3 }],
  applicationsByStatus: [{ status: "submitted", count: 3 }],
  applicationsByProgram: [{ program: "MassHealth", count: 8 }],
  totalUsers: 9,
  newUsersThisMonth: 2,
  totalAiRequests: 44,
  aiRequestsThisMonth: 6,
  userRegistrationsByMonth: [{ month: "2026-06", count: 2 }],
  moduleUsage: [{ module: "chat", count: 10 }],
  aiChatByMonth: [{ month: "2026-06", count: 6 }],
  recentActivity: [
    {
      action: "application.submitted",
      user_email: "applicant@example.com",
      application_id: "application-123456",
      created_at: "2026-06-09T12:00:00Z",
    },
  ],
  fplDistribution: [{ bucket: "100-150%", count: 4 }],
  householdSizeDistribution: [{ size: 2, count: 5 }],
}

describe("AdminAnalyticsPage", () => {
  beforeEach(() => {
    mockAuthenticatedFetch.mockReset()
    mockAuthenticatedFetch.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/admin/analytics/drill-down")) {
        return {
          json: async () => ({
            ok: true,
            result: {
              columns: [
                { key: "id", label: "ID" },
                { key: "status", label: "Status" },
              ],
              rows: [{ id: "application-1", status: "submitted" }],
              total: 1,
            },
          }),
        }
      }

      return { json: async () => ({ ok: true, data: analyticsData }) }
    })
  })

  it("loads analytics KPIs for the default 12 month period", async () => {
    render(<AdminAnalyticsPage />)

    expect(await screen.findByRole("heading", { name: "Analytics" })).toBeInTheDocument()
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/analytics?months=12")
    })
    expect(screen.getByText("Total Applications")).toBeInTheDocument()
    expect(screen.getByText("Total AI Requests")).toBeInTheDocument()
    expect(screen.getByText("Application Statistics")).toBeInTheDocument()
  })

  it("reloads analytics when the period changes", async () => {
    render(<AdminAnalyticsPage />)

    fireEvent.click(await screen.findByRole("button", { name: /6 months/i }))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith("/api/admin/analytics?months=6")
    })
  })

  it("opens a chart drill-down panel", async () => {
    render(<AdminAnalyticsPage />)

    fireEvent.click((await screen.findAllByTestId("chart-bar"))[0])

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/admin/analytics/drill-down?type=apps-month&value=2026-06&page=1&limit=20",
      )
    })
    expect(await screen.findByText("application-1")).toBeInTheDocument()
  })
})
