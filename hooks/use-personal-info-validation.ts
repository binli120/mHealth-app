/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useMemo } from "react"
import { getDobInputBounds, getDobValidation } from "@/lib/utils/date-of-birth"
import { useField } from "@/hooks/use-field"
import { useAddressValidation, type NormalizedAddress } from "@/hooks/use-address-validation"

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
  onAddressValidated?: (suggestion: NormalizedAddress) => void
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
  const {
    isValidating: isValidatingAddress,
    isValid: isAddressValidatedForCurrentValues,
    errors: addressLookupErrors,
  } = useAddressValidation(
    { line1: values.address, city: values.city, state: values.state, zip: values.zip },
    { enabled, onValidated: onAddressValidated },
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

  // addressLookupErrors keys from useAddressValidation are "line1" — map to "address" for this hook's output
  const mergedAddressErrors = useMemo(
    () => ({
      address: addressField.error || addressLookupErrors.line1 || null,
      city: cityField.error || addressLookupErrors.city || null,
      state: stateField.error || addressLookupErrors.state || null,
      zip: zipField.error || addressLookupErrors.zip || null,
    }),
    [
      addressField.error,
      cityField.error,
      stateField.error,
      zipField.error,
      addressLookupErrors.line1,
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
