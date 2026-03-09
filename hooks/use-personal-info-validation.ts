"use client"

import { useEffect, useMemo, useState } from "react"
import { getDobInputBounds, getDobValidation } from "@/lib/utils/date-of-birth"
import { useField } from "@/hooks/use-field"

interface PersonalInfoValues {
  firstName: string
  lastName: string
  dob: string
  ssn: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  citizenship: string
}

interface UsePersonalInfoValidationOptions {
  values: PersonalInfoValues
  enabled: boolean
  onAddressValidated?: (suggestion: {
    streetAddress: string
    city: string
    state: string
    zipCode: string
    county: string
    displayName: string
    latitude: string
    longitude: string
  }) => void
}

interface AddressValidationResponse {
  ok: boolean
  valid: boolean
  message?: string
  error?: string
  suggestion?: {
    streetAddress: string
    city: string
    state: string
    zipCode: string
    county: string
    displayName: string
    latitude: string
    longitude: string
  }
}

interface AddressFieldErrors {
  address?: string
  city?: string
  state?: string
  zip?: string
}

interface PersonalInfoValidationResult {
  dobBounds: { min: string; max: string }
  isValidatingAddress: boolean
  isAddressValidatedForCurrentValues: boolean
  hasValidPersonalInfo: boolean
  fieldErrors: {
    firstName: string | null
    lastName: string | null
    dob: string | null
    ssn: string | null
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    phone: string | null
    citizenship: string | null
  }
}

const SSN_PATTERN = /^\d{3}-\d{2}-\d{4}$/
const PHONE_PATTERN = /^\(\d{3}\)\d{3}-\d{4}$/
const ZIP_PATTERN = /^\d{5}$/

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeZip(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5)
}

function requiredField(label: string) {
  return (value: string): string | null =>
    value.trim() ? null : `${label} is required.`
}

export function usePersonalInfoValidation({
  values,
  enabled,
  onAddressValidated,
}: UsePersonalInfoValidationOptions): PersonalInfoValidationResult {
  const [isValidatingAddress, setIsValidatingAddress] = useState(false)
  const [validatedAddressKey, setValidatedAddressKey] = useState("")
  const [addressLookupErrors, setAddressLookupErrors] = useState<AddressFieldErrors>(
    {},
  )

  const firstNameField = useField({
    value: values.firstName,
    validators: [requiredField("First name")],
  })
  const lastNameField = useField({
    value: values.lastName,
    validators: [requiredField("Last name")],
  })
  const dobField = useField({
    value: values.dob,
    validators: [
      (value) => {
        const validation = getDobValidation(value)
        return validation.error || null
      },
    ],
  })
  const ssnField = useField({
    value: values.ssn,
    validators: [
      requiredField("Social Security Number"),
      (value) =>
        SSN_PATTERN.test(value) ? null : "SSN must be in XXX-XX-XXXX format.",
    ],
  })
  const addressField = useField({
    value: values.address,
    validators: [requiredField("Street address")],
  })
  const cityField = useField({
    value: values.city,
    validators: [requiredField("City")],
  })
  const stateField = useField({
    value: values.state,
    validators: [requiredField("State")],
  })
  const zipField = useField({
    value: values.zip,
    validators: [
      requiredField("ZIP code"),
      (value) =>
        ZIP_PATTERN.test(normalizeZip(value))
          ? null
          : "ZIP code must be 5 digits.",
    ],
  })
  const phoneField = useField({
    value: values.phone,
    validators: [
      requiredField("Phone number"),
      (value) =>
        PHONE_PATTERN.test(value)
          ? null
          : "Phone number must be in (XXX)XXX-XXXX format.",
    ],
  })
  const citizenshipField = useField({
    value: values.citizenship,
    validators: [requiredField("Citizenship status")],
  })

  const currentAddressKey = [
    values.address.trim(),
    values.city.trim(),
    values.state.trim().toUpperCase(),
    normalizeZip(values.zip),
  ].join("|")

  const canRunAddressLookup =
    enabled &&
    addressField.isValid &&
    cityField.isValid &&
    stateField.isValid &&
    zipField.isValid

  useEffect(() => {
    if (!enabled) {
      setIsValidatingAddress(false)
      setAddressLookupErrors({})
      setValidatedAddressKey("")
      return
    }

    const streetAddress = values.address.trim()
    const city = values.city.trim()
    const state = values.state.trim().toUpperCase()
    const zipCode = normalizeZip(values.zip)

    if (!canRunAddressLookup) {
      setIsValidatingAddress(false)
      setAddressLookupErrors({})
      setValidatedAddressKey("")
      return
    }

    const validationKey = [streetAddress, city, state, zipCode].join("|")
    const abortController = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setIsValidatingAddress(true)
      setAddressLookupErrors({})
      setValidatedAddressKey("")

      try {
        const response = await fetch("/api/address/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            streetAddress,
            city,
            state,
            zipCode,
          }),
          signal: abortController.signal,
        })

        const result = (await response.json()) as AddressValidationResponse

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Unable to validate address.")
        }

        if (result.valid) {
          if (result.suggestion && onAddressValidated) {
            onAddressValidated(result.suggestion)
          }
          setAddressLookupErrors({})
          setValidatedAddressKey(validationKey)
          return
        }

        const nextErrors: AddressFieldErrors = {}
        const suggestion = result.suggestion

        if (!suggestion) {
          nextErrors.address = result.message || "We could not validate this address."
        } else {
          if (
            suggestion.streetAddress &&
            normalizeText(suggestion.streetAddress) !== normalizeText(streetAddress)
          ) {
            nextErrors.address = `Check street address. Suggested: ${suggestion.streetAddress}`
          }

          if (
            suggestion.city &&
            normalizeText(suggestion.city) !== normalizeText(city)
          ) {
            nextErrors.city = `Check city. Suggested: ${suggestion.city}`
          }

          if (suggestion.state && suggestion.state.toUpperCase() !== state) {
            nextErrors.state = `Check state. Suggested: ${suggestion.state.toUpperCase()}`
          }

          const suggestionZip = normalizeZip(suggestion.zipCode)

          if (suggestionZip && suggestionZip !== zipCode) {
            nextErrors.zip = `Check ZIP code. Suggested: ${suggestionZip}`
          }

          if (Object.keys(nextErrors).length === 0) {
            nextErrors.address = result.message || "Address could not be validated."
          }
        }

        setAddressLookupErrors(nextErrors)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setAddressLookupErrors({
          address:
            error instanceof Error ? error.message : "Unable to validate address.",
        })
      } finally {
        setIsValidatingAddress(false)
      }
    }, 700)

    return () => {
      abortController.abort()
      window.clearTimeout(timeoutId)
    }
  }, [
    canRunAddressLookup,
    enabled,
    onAddressValidated,
    values.address,
    values.city,
    values.state,
    values.zip,
  ])

  const mergedAddressErrors = useMemo(
    () => ({
      address: addressField.error || addressLookupErrors.address || null,
      city: cityField.error || addressLookupErrors.city || null,
      state: stateField.error || addressLookupErrors.state || null,
      zip: zipField.error || addressLookupErrors.zip || null,
    }),
    [
      addressField.error,
      cityField.error,
      stateField.error,
      zipField.error,
      addressLookupErrors.address,
      addressLookupErrors.city,
      addressLookupErrors.state,
      addressLookupErrors.zip,
    ],
  )

  const hasAddressValidationErrors = Boolean(
    mergedAddressErrors.address ||
      mergedAddressErrors.city ||
      mergedAddressErrors.state ||
      mergedAddressErrors.zip,
  )

  const isAddressValidatedForCurrentValues =
    Boolean(validatedAddressKey) && validatedAddressKey === currentAddressKey

  const hasValidPersonalInfo =
    firstNameField.isValid &&
    lastNameField.isValid &&
    dobField.isValid &&
    ssnField.isValid &&
    phoneField.isValid &&
    citizenshipField.isValid &&
    isAddressValidatedForCurrentValues &&
    !hasAddressValidationErrors &&
    !isValidatingAddress

  return {
    dobBounds: getDobInputBounds(),
    isValidatingAddress,
    isAddressValidatedForCurrentValues,
    hasValidPersonalInfo,
    fieldErrors: {
      firstName: firstNameField.error,
      lastName: lastNameField.error,
      dob: dobField.error,
      ssn: ssnField.error,
      address: mergedAddressErrors.address,
      city: mergedAddressErrors.city,
      state: mergedAddressErrors.state,
      zip: mergedAddressErrors.zip,
      phone: phoneField.error,
      citizenship: citizenshipField.error,
    },
  }
}
