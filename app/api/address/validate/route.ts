import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthenticatedUser } from "@/lib/auth/require-auth"
import { logServerError } from "@/lib/server/logger"
import {
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

export const runtime = "nodejs"

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

interface GoogleGeocodeAddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

interface GoogleGeocodeResult {
  formatted_address: string
  address_components?: GoogleGeocodeAddressComponent[]
  geometry?: {
    location?: {
      lat?: number
      lng?: number
    }
  }
}

interface GoogleGeocodePayload {
  status?: string
  results?: GoogleGeocodeResult[]
}

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

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

function hasGoogleGeocodingKey(): boolean {
  return Boolean(process.env.GOOGLE_GEOCODING_API_KEY?.trim())
}

function getGoogleComponent(
  result: GoogleGeocodeResult,
  type: string,
): GoogleGeocodeAddressComponent | undefined {
  return result.address_components?.find((component) => component.types.includes(type))
}

function toNormalizedAddressFromGoogle(result: GoogleGeocodeResult): NormalizedAddress {
  const streetNumber = getGoogleComponent(result, "street_number")?.long_name ?? ""
  const route = getGoogleComponent(result, "route")?.long_name ?? ""
  const locality =
    getGoogleComponent(result, "locality")?.long_name ??
    getGoogleComponent(result, "postal_town")?.long_name ??
    ""
  const state = getGoogleComponent(result, "administrative_area_level_1")?.short_name?.toUpperCase() ?? ""
  const zipCode = digitsOnly(getGoogleComponent(result, "postal_code")?.long_name ?? "").slice(0, ZIP_CODE_LENGTH)
  const county = getGoogleComponent(result, "administrative_area_level_2")?.long_name?.trim() ?? ""
  const lat = result.geometry?.location?.lat
  const lng = result.geometry?.location?.lng

  return {
    streetAddress: [streetNumber, route].filter(Boolean).join(" ").trim(),
    city: locality,
    state,
    zipCode,
    county,
    displayName: result.formatted_address ?? "",
    latitude: Number.isFinite(lat) ? String(lat) : "",
    longitude: Number.isFinite(lng) ? String(lng) : "",
  }
}

async function geocodeWithGoogle(query: string): Promise<NormalizedAddress | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim()
  if (!apiKey) {
    return null
  }

  const url = new URL(GOOGLE_GEOCODE_URL)
  url.searchParams.set("address", query)
  url.searchParams.set("components", "country:US")
  url.searchParams.set("key", apiKey)

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new TypeError(ERROR_ADDRESS_LOOKUP_UNAVAILABLE)
  }

  const payload = (await response.json()) as GoogleGeocodePayload
  if (payload.status !== "OK" || !Array.isArray(payload.results) || payload.results.length === 0) {
    return null
  }

  return toNormalizedAddressFromGoogle(payload.results[0])
}

async function geocodeWithNominatim(query: string): Promise<NormalizedAddress | null> {
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
    throw new TypeError(ERROR_ADDRESS_LOOKUP_UNAVAILABLE)
  }

  const data = (await response.json()) as NominatimResult[]
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  return toNormalizedAddress(data[0])
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

    const suggestion = hasGoogleGeocodingKey()
      ? await geocodeWithGoogle(query)
      : await geocodeWithNominatim(query)

    if (!suggestion) {
      return NextResponse.json({
        ok: true,
        valid: false,
        message: MESSAGE_NO_MATCHING_ADDRESS,
      })
    }

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
      logServerError(ERROR_LOG_PREFIX, error, {
        route: "/api/address/validate",
        method: "POST",
      })
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
        status: isValidationError ? 400 : isUpstreamFailure ? 502 : 500,
      },
    )
  }
}
