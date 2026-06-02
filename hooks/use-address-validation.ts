/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect, useReducer, useRef } from "react"

export interface NormalizedAddress {
  streetAddress: string
  city: string
  state: string
  zipCode: string
  county: string
  displayName: string
  latitude: string
  longitude: string
}

export interface AddressValidationErrors {
  line1?: string
  city?: string
  state?: string
  zip?: string
}

export interface UseAddressValidationReturn {
  isValidating: boolean
  isValid: boolean
  errors: AddressValidationErrors
  suggestion?: NormalizedAddress
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeZip(s: string) {
  return s.replace(/\D/g, "").slice(0, 5)
}

export function useAddressValidation(
  address: { line1: string; city: string; state: string; zip: string },
  options?: {
    enabled?: boolean
    debounceMs?: number
    onValidated?: (suggestion: NormalizedAddress) => void
  },
): UseAddressValidationReturn {
  const { enabled = true, debounceMs = 700 } = options ?? {}

  // Stable ref avoids forcing callers to memoize the callback
  const onValidatedRef = useRef(options?.onValidated)
  useEffect(() => { onValidatedRef.current = options?.onValidated }, [options?.onValidated])

  type ValidationState = { isValidating: boolean; validatedKey: string; errors: AddressValidationErrors; suggestion: NormalizedAddress | undefined }
  const [validationState, dispatchValidation] = useReducer(
    (state: ValidationState, update: Partial<ValidationState>) => ({ ...state, ...update }),
    { isValidating: false, validatedKey: "", errors: {}, suggestion: undefined },
  )
  const isValidating = validationState.isValidating
  const validatedKey = validationState.validatedKey
  const errors = validationState.errors
  const suggestion = validationState.suggestion
  const setIsValidating = (v: boolean) => dispatchValidation({ isValidating: v })
  const setValidatedKey = (v: string) => dispatchValidation({ validatedKey: v })
  const setErrors = (v: AddressValidationErrors) => dispatchValidation({ errors: v })
  const setSuggestion = (v: NormalizedAddress | undefined) => dispatchValidation({ suggestion: v })

  const line1 = address.line1.trim()
  const city = address.city.trim()
  const state = address.state.trim().toUpperCase()
  const zip = normalizeZip(address.zip)
  const allFilled = Boolean(line1 && city && state && zip.length === 5)
  const currentKey = [line1, city, state, zip].join("|")

  useEffect(() => {
    if (!enabled || !allFilled) {
      setIsValidating(false)
      setErrors({})
      setSuggestion(undefined)
      setValidatedKey("")
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsValidating(true)
      setErrors({})
      setSuggestion(undefined)
      setValidatedKey("")

      try {
        const res = await fetch("/api/address/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streetAddress: line1, city, state, zipCode: zip }),
          signal: controller.signal,
        })
        const data = await res.json() as {
          ok: boolean
          valid: boolean
          message?: string
          error?: string
          suggestion?: NormalizedAddress
        }

        if (!res.ok || !data.ok) throw new Error(data.error ?? "Unable to validate address.")

        if (data.valid) {
          if (data.suggestion) onValidatedRef.current?.(data.suggestion)
          setSuggestion(data.suggestion)
          setValidatedKey(currentKey)
          setErrors({})
          return
        }

        const nextErrors: AddressValidationErrors = {}
        const s = data.suggestion
        if (!s) {
          nextErrors.line1 = data.message ?? "We could not validate this address."
        } else {
          if (s.streetAddress && normalize(s.streetAddress) !== normalize(line1))
            nextErrors.line1 = `Did you mean: ${s.streetAddress}?`
          if (s.city && normalize(s.city) !== normalize(city))
            nextErrors.city = `Did you mean: ${s.city}?`
          if (s.state && s.state.toUpperCase() !== state)
            nextErrors.state = `Did you mean: ${s.state.toUpperCase()}?`
          const sZip = normalizeZip(s.zipCode)
          if (sZip && sZip !== zip)
            nextErrors.zip = `Did you mean: ${sZip}?`
          if (Object.keys(nextErrors).length === 0)
            nextErrors.line1 = data.message ?? "Address could not be validated."
        }
        setErrors(nextErrors)
        setSuggestion(s ?? undefined)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        // Best-effort — don't block the user on a geocode failure
      } finally {
        setIsValidating(false)
      }
    }, debounceMs)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
    // currentKey captures line1/city/state/zip as a single dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, allFilled, currentKey, debounceMs])

  const isValid = Boolean(validatedKey) && validatedKey === currentKey

  return { isValidating, isValid, errors, suggestion }
}
