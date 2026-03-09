import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import {
  ADDRESS_VALIDATE_RUNTIME,
  DEFAULT_ZIP_CODE,
  ERROR_ADDRESS_LOOKUP_UNAVAILABLE,
  ERROR_INVALID_ADDRESS_PAYLOAD,
  ERROR_LOG_PREFIX,
  ERROR_VALIDATE_ADDRESS_FAILED,
  MESSAGE_ADDRESS_MISMATCH,
  MESSAGE_ADDRESS_VALIDATED,
  MESSAGE_NO_MATCHING_ADDRESS,
  NOMINATIM_ADDRESS_DETAILS,
  NOMINATIM_COUNTRY_CODES,
  NOMINATIM_FORMAT,
  NOMINATIM_RESULT_LIMIT,
  NOMINATIM_SEARCH_URL,
  REQUEST_ACCEPT_LANGUAGE,
  REQUEST_USER_AGENT,
  STATE_CODE_LENGTH,
  ZIP_CODE_LENGTH,
} from "./constants"

export const runtime = ADDRESS_VALIDATE_RUNTIME

const requestSchema = z.object({
  streetAddress: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(STATE_CODE_LENGTH).max(STATE_CODE_LENGTH),
  zipCode: z.string().trim().optional().default(DEFAULT_ZIP_CODE),
})

interface NominatimAddress {
  road?: string
  house_number?: string
  city?: string
  town?: string
  village?: string
  hamlet?: string
  county?: string
  state?: string
  postcode?: string
  country_code?: string
  "ISO3166-2-lvl4"?: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: NominatimAddress
}

interface NormalizedAddress {
  streetAddress: string
  city: string
  state: string
  zipCode: string
  county: string
  displayName: string
  latitude: string
  longitude: string
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

function parseStateCode(address?: NominatimAddress): string {
  const isoValue = address?.["ISO3166-2-lvl4"]

  if (isoValue && isoValue.includes("-")) {
    return isoValue.split("-").at(-1)?.toUpperCase() || ""
  }

  return ""
}

function toNormalizedAddress(result: NominatimResult): NormalizedAddress {
  const address = result.address
  const streetAddress = [address?.house_number, address?.road]
    .filter(Boolean)
    .join(" ")
    .trim()
  const city = address?.city || address?.town || address?.village || address?.hamlet || ""
  const state = parseStateCode(address)
  const zipCode = address?.postcode ? digitsOnly(address.postcode).slice(0, ZIP_CODE_LENGTH) : ""
  const county = address?.county?.trim() || ""

  return {
    streetAddress,
    city,
    state,
    zipCode,
    county,
    displayName: result.display_name,
    latitude: result.lat,
    longitude: result.lon,
  }
}

function queryToAddress(streetAddress: string, city: string, state: string, zipCode: string): string {
  return [streetAddress, city, state, zipCode].filter(Boolean).join(", ")
}

function buildSearchUrl(query: string): URL {
  const url = new URL(NOMINATIM_SEARCH_URL)
  url.searchParams.set("q", query)
  url.searchParams.set("format", NOMINATIM_FORMAT)
  url.searchParams.set("addressdetails", NOMINATIM_ADDRESS_DETAILS)
  url.searchParams.set("limit", NOMINATIM_RESULT_LIMIT)
  url.searchParams.set("countrycodes", NOMINATIM_COUNTRY_CODES)

  if (process.env.NOMINATIM_EMAIL) {
    url.searchParams.set("email", process.env.NOMINATIM_EMAIL)
  }

  return url
}

function isAddressMatch(
  normalizedAddress: NormalizedAddress,
  input: z.infer<typeof requestSchema>,
): boolean {
  const inputState = input.state.toUpperCase()
  const inputZip = digitsOnly(input.zipCode).slice(0, ZIP_CODE_LENGTH)
  const zipMatches = !inputZip || !normalizedAddress.zipCode || inputZip === normalizedAddress.zipCode
  const stateMatches = !normalizedAddress.state || normalizedAddress.state === inputState

  return zipMatches && stateMatches
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const body = await request.json()
    const payload = requestSchema.parse(body)

    const query = queryToAddress(
      payload.streetAddress,
      payload.city,
      payload.state.toUpperCase(),
      payload.zipCode,
    )

    const searchUrl = buildSearchUrl(query)
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Accept-Language": REQUEST_ACCEPT_LANGUAGE,
        "User-Agent": REQUEST_USER_AGENT,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, valid: false, error: ERROR_ADDRESS_LOOKUP_UNAVAILABLE },
        { status: 502 },
      )
    }

    const data = (await response.json()) as NominatimResult[]

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({
        ok: true,
        valid: false,
        message: MESSAGE_NO_MATCHING_ADDRESS,
      })
    }

    const suggestion = toNormalizedAddress(data[0])
    const valid = isAddressMatch(suggestion, payload)

    if (valid) {
      return NextResponse.json({
        ok: true,
        valid: true,
        message: MESSAGE_ADDRESS_VALIDATED,
        suggestion,
      })
    }

    return NextResponse.json({
      ok: true,
      valid: false,
      message: MESSAGE_ADDRESS_MISMATCH,
      suggestion,
    })
  } catch (error) {
    const isValidationError = error instanceof z.ZodError
    const isUpstreamFailure = error instanceof TypeError

    if (!isValidationError) {
      console.error(ERROR_LOG_PREFIX, error)
    }

    return NextResponse.json(
      {
        ok: false,
        valid: false,
        error: isValidationError
          ? ERROR_INVALID_ADDRESS_PAYLOAD
          : isUpstreamFailure
            ? ERROR_ADDRESS_LOOKUP_UNAVAILABLE
            : ERROR_VALIDATE_ADDRESS_FAILED,
      },
      {
        status: isValidationError ? 400 : isUpstreamFailure ? 503 : 500,
      },
    )
  }
}
