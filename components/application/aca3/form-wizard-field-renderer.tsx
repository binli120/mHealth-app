/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useEffect, useReducer, useRef, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  FULL_NAME_FIELD_IDS,
  HOUSEHOLD_SIZE_FIELD_ID,
  HOUSEHOLD_SIZE_OPTIONS,
  MAX_DOB_AGE_YEARS,
  SUPPORTED_LANGUAGE_FIELD_IDS,
  SUPPORTED_LANGUAGE_OPTIONS,
  US_STATE_CODES,
} from "@/lib/constant"
import { cn } from "@/lib/utils"
import { formatCurrency, formatPhoneNumber, formatSsn } from "@/lib/utils/input-format"
import {
  buildDependentsListValue,
  formatUsDate,
  getExclusiveCheckboxOptions,
  normalizeDateInput,
  normalizeNumberInput,
  parseDate,
  parseDependentsListValue,
  splitSpouseNameDobValue,
} from "@/lib/utils/aca3-form"
import { parsePastedUsAddress } from "@/lib/utils/address-parse"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { useConditional } from "@/hooks/use-conditional"
import { useField } from "@/hooks/use-field"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { getRepeatableRowDefault, getActiveSubFields } from "./form-wizard-context"
import type {
  AddressGroupFieldProps,
  AddressValidationResponse,
  DependentEntry,
  FieldRendererProps,
  FieldValue,
  SchemaField,
} from "./types"

export function isAddressCoreField(field: SchemaField): boolean {
  const id = field.id.toLowerCase()
  if (id.includes("apt") || id.includes("county")) {
    return false
  }

  return id.includes("street") || id.includes("city") || id.includes("state") || id.includes("zip")
}

export function requiresFullNameFormat(field: SchemaField): boolean {
  if (field.type !== "text") {
    return false
  }

  if (FULL_NAME_FIELD_IDS.has(field.id)) {
    return true
  }

  const label = field.label.toLowerCase()
  return label.includes("first name") && label.includes("last name")
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

export function AddressGroupField({
  field,
  formValues,
  getValue,
  setValue,
  errors,
  errorPrefix,
  personNumber,
  errorKey,
}: AddressGroupFieldProps) {
  type ValidationTone = "success" | "warning" | "error" | null
  type ValidationState = { isValidating: boolean; validationMessage: string | null; validationTone: ValidationTone }
  const [validationState, dispatchValidation] = useReducer(
    (state: ValidationState, update: Partial<ValidationState>) => ({ ...state, ...update }),
    { isValidating: false, validationMessage: null, validationTone: null },
  )
  const isValidating = validationState.isValidating
  const validationMessage = validationState.validationMessage
  const validationTone = validationState.validationTone
  const setIsValidating = (v: boolean) => dispatchValidation({ isValidating: v })
  const setValidationMessage = (v: string | null) => dispatchValidation({ validationMessage: v })
  const setValidationTone = (v: ValidationTone) => dispatchValidation({ validationTone: v })
  const lastRequestedKeyRef = useRef("")
  const setValueRef = useRef(setValue)

  useEffect(() => {
    setValueRef.current = setValue
  }, [setValue])

  const addressFields = Object.values(field.fields ?? {})
  const siblingFieldIds = {
    streetId: addressFields.find((item) => /(^|_)street$/i.test(item.id))?.id,
    cityId: addressFields.find((item) => /(^|_)city$/i.test(item.id))?.id,
    stateId: addressFields.find((item) => /(^|_)state$/i.test(item.id))?.id,
    zipId: addressFields.find((item) => /(^|_)zip$/i.test(item.id))?.id,
    countyId: addressFields.find((item) => /(^|_)county$/i.test(item.id))?.id,
  }

  const streetValue = siblingFieldIds.streetId ? String(getValue(siblingFieldIds.streetId) ?? "").trim() : ""
  const cityValue = siblingFieldIds.cityId ? String(getValue(siblingFieldIds.cityId) ?? "").trim() : ""
  const stateValue = siblingFieldIds.stateId ? String(getValue(siblingFieldIds.stateId) ?? "").trim().toUpperCase() : ""
  const zipValue = siblingFieldIds.zipId ? digitsOnly(String(getValue(siblingFieldIds.zipId) ?? "")).slice(0, 5) : ""
  const addressKey = `${streetValue}|${cityValue}|${stateValue}|${zipValue}`
  const canValidate =
    Boolean(siblingFieldIds.streetId && siblingFieldIds.cityId && siblingFieldIds.stateId) &&
    streetValue.length > 0 &&
    cityValue.length > 0 &&
    stateValue.length === 2

  useEffect(() => {
    if (!canValidate) {
      setIsValidating(false)
      setValidationMessage(null)
      setValidationTone(null)
      lastRequestedKeyRef.current = ""
      return
    }

    if (lastRequestedKeyRef.current === addressKey) {
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      lastRequestedKeyRef.current = addressKey
      setIsValidating(true)
      setValidationMessage(null)
      setValidationTone(null)

      try {
        const response = await authenticatedFetch("/api/address/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            streetAddress: streetValue,
            city: cityValue,
            state: stateValue,
            zipCode: zipValue,
          }),
          signal: controller.signal,
        })

        const result = (await response.json()) as AddressValidationResponse

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Unable to validate address.")
        }

        const suggestion = result.suggestion
        if (suggestion) {
          const nextStreet = suggestion.streetAddress.trim()
          const nextCity = suggestion.city.trim()
          const nextState = suggestion.state.trim().toUpperCase()
          const nextZip = digitsOnly(suggestion.zipCode).slice(0, 5)
          const nextCounty = suggestion.county.trim()

          if (siblingFieldIds.streetId && nextStreet && nextStreet !== streetValue) {
            setValueRef.current(siblingFieldIds.streetId, nextStreet)
          }

          if (siblingFieldIds.cityId && nextCity && nextCity !== cityValue) {
            setValueRef.current(siblingFieldIds.cityId, nextCity)
          }

          if (siblingFieldIds.stateId && nextState && nextState !== stateValue) {
            setValueRef.current(siblingFieldIds.stateId, nextState)
          }

          if (siblingFieldIds.zipId && nextZip && nextZip !== zipValue) {
            setValueRef.current(siblingFieldIds.zipId, nextZip)
          }

          if (siblingFieldIds.countyId && nextCounty) {
            const currentCounty = String(getValue(siblingFieldIds.countyId) ?? "").trim()
            if (nextCounty !== currentCounty) {
              setValueRef.current(siblingFieldIds.countyId, nextCounty)
            }
          }
        }

        setValidationTone(result.valid ? "success" : "warning")
        setValidationMessage(
          result.message || (result.valid ? "Address validated successfully." : "Address validated with suggested corrections."),
        )
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return
        }

        setValidationTone("error")
        setValidationMessage("Address validation is unavailable right now.")
      } finally {
        setIsValidating(false)
      }
    }, 600)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [
    addressKey,
    canValidate,
    cityValue,
    getValue,
    siblingFieldIds.cityId,
    siblingFieldIds.countyId,
    siblingFieldIds.stateId,
    siblingFieldIds.streetId,
    siblingFieldIds.zipId,
    stateValue,
    streetValue,
    zipValue,
  ])

  return (
    <Card className="border-dashed" data-error-key={errorKey}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{field.label}</CardTitle>
        {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-4 md:grid-cols-2">
          {addressFields.map((addressField) => (
            <FieldRenderer
              key={`${errorPrefix}${addressField.id}`}
              field={addressField}
              formValues={formValues}
              getValue={getValue}
              setValue={setValue}
              errors={errors}
              errorPrefix={errorPrefix}
              personNumber={personNumber}
              addressSiblingFieldIds={siblingFieldIds}
            />
          ))}
        </div>

        {isValidating ? <p className="text-xs text-muted-foreground">Validating address...</p> : null}
        {validationMessage ? (
          <p
            className={cn(
              "text-xs",
              validationTone === "success" && "text-emerald-600",
              validationTone === "warning" && "text-amber-600",
              validationTone === "error" && "text-destructive",
            )}
          >
            {validationMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function FieldRenderer({
  field,
  formValues,
  getValue,
  setValue,
  errors,
  errorPrefix,
  personNumber,
  addressSiblingFieldIds,
}: FieldRendererProps) {
  const { isVisible } = useConditional(field, formValues)
  const currentValue = getValue(field.id)
  const emailValue = typeof currentValue === "string" ? currentValue : ""
  const emailField = useField<string>({
    value: emailValue,
    validators:
      field.type === "email"
        ? [
            (value) => {
              if (!value.trim()) {
                return null
              }
              return EMAIL_PATTERN.test(value.trim()) ? null : "Enter a valid email address."
            },
          ]
        : [],
  })
  const showDetails = field.type !== "email" || emailField.isValid || !emailValue.trim()

  if (field.applicable_from_person && personNumber && personNumber < field.applicable_from_person) {
    return null
  }

  if (!isVisible) {
    return null
  }

  const errorKey = `${errorPrefix}${field.id}`
  const errorMessage = errors[errorKey]
  const visibleErrorMessage = errorMessage || (field.type === "email" ? emailField.error : null)
  const isSpouseNameDobField = field.id === "spouse_name_dob"
  const isDependentsListField = field.id === "dependents_list"
  const isHouseholdSizeField = field.id === HOUSEHOLD_SIZE_FIELD_ID

  const setTextValue = (next: string) => {
    switch (field.type) {
      case "phone":
        setValue(field.id, formatPhoneNumber(next))
        break
      case "ssn":
        setValue(field.id, formatSsn(next))
        break
      case "currency":
        setValue(field.id, formatCurrency(next))
        break
      case "date":
        setValue(field.id, normalizeDateInput(next))
        break
      case "zip":
        setValue(field.id, next.replace(/\D/g, "").slice(0, 5))
        break
      case "number":
        setValue(field.id, normalizeNumberInput(next))
        break
      default:
        setValue(field.id, next)
    }
  }

  const setSpouseNameDobValue = (name: string, dobUsDate: string) => {
    const normalizedName = name.trim()
    const normalizedDob = dobUsDate.trim()
    const combined = normalizedName && normalizedDob ? `${normalizedName} | ${normalizedDob}` : normalizedName || normalizedDob

    setValue(`${field.id}__name`, name)
    setValue(`${field.id}__dob`, normalizedDob)
    setValue(field.id, combined)
  }

  const activeSubFields = getActiveSubFields(field, currentValue)
  const isStateSelectField = field.type === "select" && /(^|_)state$/i.test(field.id)
  const isSupportedLanguageField = SUPPORTED_LANGUAGE_FIELD_IDS.has(field.id)
  const radioValue = String(currentValue ?? "")
  const normalizedOptions = (field.options ?? []).map((option) => option.trim().toLowerCase())
  const isYesNoRadio =
    field.type === "radio" &&
    normalizedOptions.length === 2 &&
    normalizedOptions.includes("yes") &&
    normalizedOptions.includes("no")
  const yesNoVisibleOptions =
    isYesNoRadio && (radioValue === "Yes" || radioValue === "No")
      ? [radioValue]
      : field.options ?? []
  const selectOptions =
    isSupportedLanguageField
      ? [...SUPPORTED_LANGUAGE_OPTIONS]
      : isHouseholdSizeField
        ? [...HOUSEHOLD_SIZE_OPTIONS]
      : field.options && field.options.length > 0
        ? field.options
        : isStateSelectField
          ? [...US_STATE_CODES]
          : []

  if (field.type === "address_group") {
    return (
      <AddressGroupField
        field={field}
        formValues={formValues}
        getValue={getValue}
        setValue={setValue}
        errors={errors}
        errorPrefix={errorPrefix}
        personNumber={personNumber}
        errorKey={errorKey}
      />
    )
  }

  if (field.type === "repeatable_group") {
    const rows = Array.isArray(currentValue) ? (currentValue as Array<Record<string, unknown>>) : []
    const maxEntries = field.max_entries ?? 2
    const groupSchema = field.group_schema ?? []

    const addRow = () => {
      if (rows.length >= maxEntries) {
        return
      }

      const next = [...rows, getRepeatableRowDefault(groupSchema)]
      setValue(field.id, next)
    }

    const removeRow = (index: number) => {
      const next = rows.filter((_, rowIndex) => rowIndex !== index)
      setValue(field.id, next)
    }

    const updateRowField = (rowIndex: number, fieldId: string, value: FieldValue) => {
      const next = [...rows]
      const row = {
        ...(next[rowIndex] ?? {}),
        [fieldId]: value,
      }
      next[rowIndex] = row
      setValue(field.id, next)
    }

    return (
      <Card data-error-key={errorKey}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{field.label}</CardTitle>
          {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs added yet.</p>
          ) : null}

          {rows.map((row, rowIndex) => {
            const rowContext = {
              ...formValues,
              ...row,
            }

            return (
              <Card key={`${field.id}-row-${rowIndex}`} className="border-border/70">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">Job {rowIndex + 1}</CardTitle>
                  {rows.length > 1 ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeRow(rowIndex)}>
                      Remove
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {groupSchema.map((groupField) => (
                    <FieldRenderer
                      key={`${errorPrefix}${field.id}.${rowIndex}.${groupField.id}`}
                      field={groupField}
                      formValues={rowContext}
                      getValue={(fieldId) => row[fieldId]}
                      setValue={(fieldId, value) => updateRowField(rowIndex, fieldId, value)}
                      errors={errors}
                      errorPrefix={`${errorPrefix}${field.id}.${rowIndex}.`}
                      personNumber={personNumber}
                    />
                  ))}
                </CardContent>
              </Card>
            )
          })}

          <Button type="button" variant="secondary" onClick={addRow} disabled={rows.length >= maxEntries}>
            Add Job
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (field.type === "income_checklist") {
    const checklistValue = (currentValue as Record<string, Record<string, unknown>>) ?? {}

    const setChecklistItem = (itemId: string, patch: Record<string, unknown>) => {
      const next = {
        ...checklistValue,
        [itemId]: {
          ...(checklistValue[itemId] ?? {}),
          ...patch,
        },
      }
      setValue(field.id, next)
    }

    return (
      <Card data-error-key={errorKey}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{field.label}</CardTitle>
          {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {(field.items ?? []).map((item) => {
            const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
            const isSelected = Boolean(itemValue.selected)

            return (
              <div key={item.id} className="rounded-md border p-3">
                <label className="flex items-start gap-3 text-sm font-medium">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setChecklistItem(item.id, {
                        selected: Boolean(checked),
                      })
                    }}
                  />
                  <span>{item.label}</span>
                </label>

                {isSelected ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.amount`}>Amount</Label>
                      <Input
                        id={`${errorPrefix}${field.id}.${item.id}.amount`}
                        value={String(itemValue.amount ?? "")}
                        onChange={(event) => {
                          setChecklistItem(item.id, {
                            amount: formatCurrency(event.target.value),
                          })
                        }}
                      />
                      {errors[`${errorPrefix}${field.id}.${item.id}.amount`] ? (
                        <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.amount`]}</p>
                      ) : null}
                    </div>

                    <div>
                      <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.frequency`}>Frequency</Label>
                      <Select
                        value={String(itemValue.frequency ?? "")}
                        onValueChange={(value) => {
                          setChecklistItem(item.id, {
                            frequency: value,
                          })
                        }}
                      >
                        <SelectTrigger id={`${errorPrefix}${field.id}.${item.id}.frequency`}>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {([
                            "One time only",
                            "Weekly",
                            "Every two weeks",
                            "Twice a month",
                            "Monthly",
                            "Yearly",
                          ] as string[]).map((option) => (
                            <SelectItem key={`${item.id}-${option}`} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors[`${errorPrefix}${field.id}.${item.id}.frequency`] ? (
                        <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.frequency`]}</p>
                      ) : null}
                    </div>

                    {item.extra_fields?.includes("source") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.source`}>Source</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.source`}
                          value={String(itemValue.source ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              source: event.target.value,
                            })
                          }}
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.source`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.source`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("type") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.type`}>Type</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.type`}
                          value={String(itemValue.type ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              type: event.target.value,
                            })
                          }}
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.type`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.type`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("profit_or_loss") ? (
                      <div className="md:col-span-2">
                        <Label>Profit / Loss</Label>
                        <RadioGroup
                          value={String(itemValue.profit_or_loss ?? "")}
                          onValueChange={(value) => {
                            setChecklistItem(item.id, {
                              profit_or_loss: value,
                            })
                          }}
                          className="mt-2 flex flex-wrap gap-4"
                        >
                          {["Profit", "Loss"].map((option) => (
                            <label key={`${item.id}-${option}`} className="flex items-center gap-2 text-sm">
                              <RadioGroupItem value={option} id={`${errorPrefix}${field.id}.${item.id}.${option}`} />
                              {option}
                            </label>
                          ))}
                        </RadioGroup>
                        {errors[`${errorPrefix}${field.id}.${item.id}.profit_or_loss`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.profit_or_loss`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("hours_per_week") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.hours_per_week`}>Hours per week</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.hours_per_week`}
                          value={String(itemValue.hours_per_week ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              hours_per_week: normalizeNumberInput(event.target.value),
                            })
                          }}
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.hours_per_week`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.hours_per_week`]}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {item.extra_fields?.includes("effective_date") ? (
                      <div>
                        <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.effective_date`}>Effective date</Label>
                        <Input
                          id={`${errorPrefix}${field.id}.${item.id}.effective_date`}
                          value={String(itemValue.effective_date ?? "")}
                          onChange={(event) => {
                            setChecklistItem(item.id, {
                              effective_date: normalizeDateInput(event.target.value),
                            })
                          }}
                          placeholder="MM/DD/YYYY"
                        />
                        {errors[`${errorPrefix}${field.id}.${item.id}.effective_date`] ? (
                          <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.effective_date`]}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  if (field.type === "deduction_checklist") {
    const checklistValue = (currentValue as Record<string, Record<string, unknown>>) ?? {}

    const setChecklistItem = (itemId: string, patch: Record<string, unknown>) => {
      const next = {
        ...checklistValue,
        [itemId]: {
          ...(checklistValue[itemId] ?? {}),
          ...patch,
        },
      }
      setValue(field.id, next)
    }

    return (
      <Card data-error-key={errorKey}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{field.label}</CardTitle>
          {field.hint ? <CardDescription>{field.hint}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {(field.items ?? []).map((item) => {
            const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
            const isSelected = Boolean(itemValue.selected)
            const needsAmount = item.id !== "ded_none"

            return (
              <div key={item.id} className="rounded-md border p-3">
                <label className="flex items-start gap-3 text-sm font-medium">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      setChecklistItem(item.id, {
                        selected: Boolean(checked),
                      })
                    }}
                  />
                  <span>{item.label}</span>
                </label>

                {isSelected && needsAmount ? (
                  <div className="mt-3">
                    <Label htmlFor={`${errorPrefix}${field.id}.${item.id}.yearly_amount`}>Yearly amount</Label>
                    <Input
                      id={`${errorPrefix}${field.id}.${item.id}.yearly_amount`}
                      value={String(itemValue.yearly_amount ?? "")}
                      onChange={(event) => {
                        setChecklistItem(item.id, {
                          yearly_amount: formatCurrency(event.target.value),
                        })
                      }}
                    />
                    {errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`] ? (
                      <p className="mt-1 text-xs text-destructive">{errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`]}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  if (isSpouseNameDobField) {
    const parsed = typeof currentValue === "string" ? splitSpouseNameDobValue(currentValue) : { name: "", dob: "" }
    const spouseName = String(getValue(`${field.id}__name`) ?? parsed.name)
    const spouseDobUs = String(getValue(`${field.id}__dob`) ?? parsed.dob)
    const spouseNameError = errors[`${errorPrefix}${field.id}__name`]
    const spouseDobError = errors[`${errorPrefix}${field.id}__dob`]

    return (
      <div className="space-y-3" data-error-key={`${errorPrefix}${field.id}__name`}>
        <Label htmlFor={`${errorPrefix}${field.id}__name`}>
          {field.label}
          {field.required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__name`}>
            <Label htmlFor={`${errorPrefix}${field.id}__name`} className="text-xs text-muted-foreground">
              Spouse name
            </Label>
            <Input
              id={`${errorPrefix}${field.id}__name`}
              value={spouseName}
              onChange={(event) => setSpouseNameDobValue(event.target.value, spouseDobUs)}
              placeholder="First name, middle name, last name"
            />
            {spouseNameError ? <p className="text-xs text-destructive">{spouseNameError}</p> : null}
          </div>

          <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__dob`}>
            <Label htmlFor={`${errorPrefix}${field.id}__dob`} className="text-xs text-muted-foreground">
              Date of birth
            </Label>
            <Input
              id={`${errorPrefix}${field.id}__dob`}
              type="text"
              inputMode="numeric"
              placeholder="MM/DD/YYYY"
              value={spouseDobUs}
              onChange={(event) => setSpouseNameDobValue(spouseName, normalizeDateInput(event.target.value))}
            />
            {spouseDobError ? <p className="text-xs text-destructive">{spouseDobError}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  if (isDependentsListField) {
    const parsedRows = typeof currentValue === "string" ? parseDependentsListValue(currentValue) : []
    const storedRows = getValue(`${field.id}__rows`)
    const rowsFromState = Array.isArray(storedRows)
      ? (storedRows as Array<Record<string, unknown>>).map((row) => ({
          name: String(row.name ?? ""),
          dob: String(row.dob ?? ""),
        }))
      : parsedRows
    const rows = rowsFromState.length > 0 ? rowsFromState : [{ name: "", dob: "" }]
    const rowsError = errors[`${errorPrefix}${field.id}__rows`]

    const setDependentsRows = (nextRows: DependentEntry[]) => {
      setValue(`${field.id}__rows`, nextRows as unknown as FieldValue)
      setValue(field.id, buildDependentsListValue(nextRows))
    }

    const updateDependent = (index: number, patch: Partial<DependentEntry>) => {
      const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
      setDependentsRows(nextRows)
    }

    const addDependent = () => {
      setDependentsRows([...rows, { name: "", dob: "" }])
    }

    const removeDependent = (index: number) => {
      if (rows.length <= 1) {
        return
      }
      setDependentsRows(rows.filter((_, rowIndex) => rowIndex !== index))
    }

    return (
      <div className="space-y-3" data-error-key={`${errorPrefix}${field.id}__rows`}>
        <Label htmlFor={`${errorPrefix}${field.id}__rows`}>
          {field.label}
          {field.required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>

        <div className="space-y-3">
          {rows.map((row, rowIndex) => (
            <Card key={`${field.id}-dependent-${rowIndex}`} className="border-border/70">
              <CardContent className="pt-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__rows.${rowIndex}.name`}>
                      <Label htmlFor={`${errorPrefix}${field.id}__rows.${rowIndex}.name`} className="text-xs text-muted-foreground">
                        Dependent name
                      </Label>
                      <Input
                        id={`${errorPrefix}${field.id}__rows.${rowIndex}.name`}
                        value={row.name}
                        onChange={(event) => updateDependent(rowIndex, { name: event.target.value })}
                        placeholder="First name, middle name, last name"
                      />
                      {errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`] ? (
                        <p className="text-xs text-destructive">{errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`]}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1" data-error-key={`${errorPrefix}${field.id}__rows.${rowIndex}.dob`}>
                      <Label htmlFor={`${errorPrefix}${field.id}__rows.${rowIndex}.dob`} className="text-xs text-muted-foreground">
                        Date of birth
                      </Label>
                      <Input
                        id={`${errorPrefix}${field.id}__rows.${rowIndex}.dob`}
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/DD/YYYY"
                        value={row.dob}
                        onChange={(event) => updateDependent(rowIndex, { dob: normalizeDateInput(event.target.value) })}
                      />
                      {errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] ? (
                        <p className="text-xs text-destructive">{errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`]}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => removeDependent(rowIndex)} disabled={rows.length <= 1}>
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={addDependent}>
            + Add dependent
          </Button>
        </div>

        {rowsError ? <p className="text-sm text-destructive">{rowsError}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-2" data-error-key={errorKey}>
      <Label htmlFor={`${errorPrefix}${field.id}`}>
        {field.label}
        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {field.hint && showDetails ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}

      {field.type === "textarea" ? (
        <Textarea
          id={`${errorPrefix}${field.id}`}
          rows={4}
          value={String(currentValue ?? "")}
          onChange={(event) => setTextValue(event.target.value)}
        />
      ) : null}

      {field.type === "checkbox" ? (
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <Checkbox
            checked={Boolean(currentValue)}
            onCheckedChange={(checked) => {
              setValue(field.id, Boolean(checked))
            }}
          />
          <span>{field.label}</span>
        </label>
      ) : null}

      {field.type === "checkbox_group" ? (
        <div className="space-y-2 rounded-md border p-3">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(currentValue) ? (currentValue as string[]) : []
            const checked = selected.includes(option)
            const exclusiveOptions = getExclusiveCheckboxOptions(field.options ?? [])
            const hasExclusiveSelected = selected.some((selectedOption) => exclusiveOptions.has(selectedOption))
            const hasNonExclusiveSelected = selected.some((selectedOption) => !exclusiveOptions.has(selectedOption))
            const isExclusiveOption = exclusiveOptions.has(option)
            const maxReached = Boolean(field.max_select) && selected.length >= (field.max_select ?? 0)
            const disabledByExclusivity =
              !checked &&
              ((hasExclusiveSelected && !isExclusiveOption) || (hasNonExclusiveSelected && isExclusiveOption))

            return (
              <label key={`${field.id}-${option}`} className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={(!checked && maxReached) || disabledByExclusivity}
                  onCheckedChange={(nextChecked) => {
                    if (nextChecked) {
                      if (isExclusiveOption) {
                        setValue(field.id, [option])
                        return
                      }

                      const nextSelected = selected.filter((selectedOption) => !exclusiveOptions.has(selectedOption))
                      setValue(field.id, [...nextSelected, option])
                    } else {
                      setValue(
                        field.id,
                        selected.filter((item) => item !== option),
                      )
                    }
                  }}
                />
                <span>{option}</span>
              </label>
            )
          })}
        </div>
      ) : null}

      {field.type === "radio" ? (
        isYesNoRadio ? (
          <RadioGroup value={radioValue} onValueChange={(value) => setValue(field.id, value)} className="space-y-2">
            {yesNoVisibleOptions.map((option) => (
              <label
                key={`${field.id}-${option}`}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
                onClick={(event) => {
                  if (radioValue === option) {
                    event.preventDefault()
                    setValue(field.id, "")
                  }
                }}
              >
                <RadioGroupItem value={option} id={`${errorPrefix}${field.id}-${option}`} />
                <span>{option}</span>
              </label>
            ))}
          </RadioGroup>
        ) : (
          <RadioGroup value={String(currentValue ?? "")} onValueChange={(value) => setValue(field.id, value)} className="space-y-2">
            {(field.options ?? []).map((option) => (
              <label key={`${field.id}-${option}`} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <RadioGroupItem value={option} id={`${errorPrefix}${field.id}-${option}`} />
                <span>{option}</span>
              </label>
            ))}
          </RadioGroup>
        )
      ) : null}

      {field.type === "select" || isSupportedLanguageField || isHouseholdSizeField ? (
        <Select value={String(currentValue ?? "")} onValueChange={(value) => setValue(field.id, value)}>
          <SelectTrigger id={`${errorPrefix}${field.id}`}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {selectOptions.map((option) => (
              <SelectItem key={`${field.id}-${option}`} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {field.type === "date" && !isSupportedLanguageField ? (
        <div className="flex items-center gap-2">
          <Input
            id={`${errorPrefix}${field.id}`}
            type="text"
            inputMode="numeric"
            placeholder="MM/DD/YYYY"
            value={String(currentValue ?? "")}
            onChange={(event) => setTextValue(event.target.value)}
            className="flex-1"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label={`Open calendar for ${field.label}`}>
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={typeof currentValue === "string" ? parseDate(currentValue) ?? undefined : undefined}
                onSelect={(date) => {
                  if (!date) {
                    return
                  }

                  setValue(field.id, formatUsDate(date))
                }}
                startMonth={
                  DOB_FIELD_PATTERN.test(field.id)
                    ? new Date(new Date().getFullYear() - MAX_DOB_AGE_YEARS, 0, 1)
                    : new Date(new Date().getFullYear() - 100, 0, 1)
                }
                endMonth={
                  DOB_FIELD_PATTERN.test(field.id)
                    ? new Date()
                    : new Date(new Date().getFullYear() + 50, 11, 31)
                }
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {["text", "email", "phone", "zip", "number", "currency", "ssn"].includes(field.type) &&
      !isSupportedLanguageField &&
      !isHouseholdSizeField ? (
        <Input
          id={`${errorPrefix}${field.id}`}
          type={field.type === "email" ? "email" : "text"}
          pattern={field.type === "email" ? "[^\\s@]+@[^\\s@]+\\.[^\\s@]+" : undefined}
          inputMode={field.type === "number" || field.type === "currency" ? "decimal" : "text"}
          value={String(currentValue ?? "")}
          onChange={(event) => setTextValue(event.target.value)}
          onPaste={(event) => {
            if (
              field.type !== "text" ||
              !addressSiblingFieldIds?.streetId ||
              field.id !== addressSiblingFieldIds.streetId
            ) {
              return
            }

            const pastedText = event.clipboardData.getData("text")
            const parsed = parsePastedUsAddress(pastedText)

            if (!parsed) {
              return
            }

            event.preventDefault()
            setValue(field.id, parsed.streetAddress)

            if (addressSiblingFieldIds.cityId) {
              setValue(addressSiblingFieldIds.cityId, parsed.city)
            }

            if (addressSiblingFieldIds.stateId) {
              setValue(addressSiblingFieldIds.stateId, parsed.state)
            }

            if (addressSiblingFieldIds.zipId) {
              setValue(addressSiblingFieldIds.zipId, parsed.zipCode)
            }
          }}
          maxLength={field.type === "zip" ? 5 : undefined}
        />
      ) : null}

      {visibleErrorMessage ? <p className="text-sm text-destructive">{visibleErrorMessage}</p> : null}

      {activeSubFields.length > 0 ? (
        <div className="mt-3 space-y-3 rounded-md border border-dashed p-3 transition-all animate-in fade-in-50">
          {activeSubFields.map((subField) => (
            <FieldRenderer
              key={`${errorPrefix}${subField.id}`}
              field={subField}
              formValues={formValues}
              getValue={getValue}
              setValue={setValue}
              errors={errors}
              errorPrefix={errorPrefix}
              personNumber={personNumber}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
