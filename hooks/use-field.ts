/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"

export type FieldValidator<T> = (value: T) => string | null

interface UseFieldOptions<T> {
  value: T
  validators: FieldValidator<T>[]
  cacheKey?: string
  serialize?: (value: T) => string
  deserialize?: (raw: string) => T
  onHydrate?: (cachedValue: T) => void
}

interface UseFieldResult {
  error: string | null
  isValid: boolean
  clearCache: () => void
}

function defaultSerialize<T>(value: T): string {
  if (typeof value === "string") {
    return value
  }

  return JSON.stringify(value)
}

function defaultDeserialize<T>(raw: string): T {
  return raw as T
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }

  const storage = window.localStorage as Partial<Storage> | undefined

  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null
  }

  return storage as Storage
}

export function useField<T>({
  value,
  validators,
  cacheKey,
  serialize,
  deserialize,
  onHydrate,
}: UseFieldOptions<T>): UseFieldResult {
  const didAttemptHydrationRef = useRef(false)
  const skipNextPersistRef = useRef(false)

  const error = useMemo(() => {
    for (const validate of validators) {
      const validationError = validate(value)

      if (validationError) {
        return validationError
      }
    }

    return null
  }, [value, validators])

  useEffect(() => {
    if (!cacheKey || didAttemptHydrationRef.current) {
      return
    }

    const storage = getLocalStorage()

    didAttemptHydrationRef.current = true

    if (!storage) {
      return
    }

    const raw = storage.getItem(cacheKey)

    if (raw === null || !onHydrate) {
      return
    }

    try {
      const parse = deserialize || defaultDeserialize<T>
      const cachedValue = parse(raw)

      skipNextPersistRef.current = true
      onHydrate(cachedValue)
    } catch {
      // If cache cannot be parsed, continue with current state.
    }
  }, [cacheKey, deserialize, onHydrate])

  useEffect(() => {
    if (!cacheKey || !didAttemptHydrationRef.current) {
      return
    }

    const storage = getLocalStorage()

    if (!storage) {
      return
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }

    try {
      const stringify = serialize || defaultSerialize<T>
      storage.setItem(cacheKey, stringify(value))
    } catch {
      // Ignore storage errors.
    }
  }, [cacheKey, serialize, value])

  const clearCache = useCallback(() => {
    if (!cacheKey) {
      return
    }

    const storage = getLocalStorage()

    if (!storage) {
      return
    }

    storage.removeItem(cacheKey)
  }, [cacheKey])

  return {
    error,
    isValid: !error,
    clearCache,
  }
}
