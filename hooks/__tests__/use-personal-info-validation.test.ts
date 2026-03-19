/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { usePersonalInfoValidation } from "@/hooks/use-personal-info-validation"

const validValues = {
  firstName: "Jane",
  lastName: "Doe",
  dob: "1990-10-20",
  ssn: "123-45-6789",
  address: "123 Main St",
  city: "Boston",
  state: "MA",
  zip: "02108",
  phone: "(617)555-1234",
  citizenship: "citizen",
}

const fetchMock = vi.fn()

describe("hooks/use-personal-info-validation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns required and format errors for invalid input values", () => {
    const { result } = renderHook(() =>
      usePersonalInfoValidation({
        values: {
          ...validValues,
          dob: "2099-01-01",
          ssn: "123456789",
          address: "",
          city: "",
          state: "",
          zip: "21",
          phone: "6175551234",
          citizenship: "",
        },
        enabled: true,
      }),
    )

    expect(result.current.hasValidPersonalInfo).toBe(false)
    expect(result.current.fieldErrors.dob).toBe(
      "Date of birth cannot be in the future.",
    )
    expect(result.current.fieldErrors.ssn).toBe(
      "SSN must be in XXX-XX-XXXX format.",
    )
    expect(result.current.fieldErrors.address).toBe("Street address is required.")
    expect(result.current.fieldErrors.city).toBe("City is required.")
    expect(result.current.fieldErrors.state).toBe("State is required.")
    expect(result.current.fieldErrors.zip).toBe("ZIP code must be 5 digits.")
    expect(result.current.fieldErrors.phone).toBe(
      "Phone number must be in (XXX)XXX-XXXX format.",
    )
    expect(result.current.fieldErrors.citizenship).toBe(
      "Citizenship status is required.",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("marks form valid after successful async address validation", async () => {
    const onAddressValidated = vi.fn()

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          valid: true,
          suggestion: {
            streetAddress: "123 Main St",
            city: "Boston",
            state: "MA",
            zipCode: "02108",
            county: "Suffolk County",
            displayName: "123 Main St, Boston, MA 02108",
            latitude: "42.3601",
            longitude: "-71.0589",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const { result } = renderHook(() =>
      usePersonalInfoValidation({
        values: validValues,
        enabled: true,
        onAddressValidated,
      }),
    )

    expect(result.current.hasValidPersonalInfo).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/address/validate",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          streetAddress: "123 Main St",
          city: "Boston",
          state: "MA",
          zipCode: "02108",
        }),
      }),
    )
    expect(result.current.fieldErrors.address).toBeNull()
    expect(result.current.fieldErrors.city).toBeNull()
    expect(result.current.fieldErrors.state).toBeNull()
    expect(result.current.fieldErrors.zip).toBeNull()
    expect(result.current.hasValidPersonalInfo).toBe(true)
    expect(onAddressValidated).toHaveBeenCalledWith(
      expect.objectContaining({
        county: "Suffolk County",
      }),
    )
  })

  it("surfaces suggested address mismatches on invalid address response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          valid: false,
          suggestion: {
            streetAddress: "123 Main Street",
            city: "Cambridge",
            state: "MA",
            zipCode: "02139",
            county: "Middlesex County",
            displayName: "123 Main Street, Cambridge, MA 02139",
            latitude: "42.3736",
            longitude: "-71.1097",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    const { result } = renderHook(() =>
      usePersonalInfoValidation({
        values: validValues,
        enabled: true,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })

    expect(result.current.hasValidPersonalInfo).toBe(false)
    expect(result.current.fieldErrors.address).toBe(
      "Check street address. Suggested: 123 Main Street",
    )
    expect(result.current.fieldErrors.city).toBe(
      "Check city. Suggested: Cambridge",
    )
    expect(result.current.fieldErrors.state).toBeNull()
    expect(result.current.fieldErrors.zip).toBe(
      "Check ZIP code. Suggested: 02139",
    )
  })
})
