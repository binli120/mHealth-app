/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback } from "react"
import { AlertTriangle, CircleCheck } from "lucide-react"
import {
  ACA3_PERSON_SECTIONS_BY_ID,
  ACA3_SCHEMA,
  DOB_FIELD_PATTERN,
  EMAIL_PATTERN,
  PERSON_SECTION_MAP,
  PERSON_STEP_SECTION_IDS,
  SSN_PATTERN,
} from "@/lib/constant"
import { evaluateConditionalRule } from "@/hooks/use-conditional"
import { isFilled, parseDate, parseDependentsListValue, validateDobBounds } from "@/lib/utils/aca3-form"
import { hasFirstAndLastName } from "@/lib/utils/person-name"
import { parseCurrency } from "@/lib/utils/input-format"
import { clampPersonCount } from "./wizard-reducer"
import { useFormContext, getActiveSubFields } from "./form-wizard-context"
import { isAddressCoreField, requiresFullNameFormat } from "./form-wizard-field-renderer"
import type { SchemaField, ValidationParams, WizardData } from "./types"

export function validateFieldValue(field: SchemaField, value: unknown, isRequired: boolean): string | null {
  if (isRequired && !isFilled(value)) {
    return "This field is required."
  }

  if (!isFilled(value)) {
    return null
  }

  if (requiresFullNameFormat(field)) {
    return hasFirstAndLastName(String(value)) ? null : "Enter first and last name."
  }

  if (field.type === "email") {
    return EMAIL_PATTERN.test(String(value).trim()) ? null : "Enter a valid email address."
  }

  if (field.type === "phone") {
    const digits = String(value).replace(/\D/g, "")
    return digits.length === 10 ? null : "Enter a 10-digit US phone number."
  }

  if (field.type === "ssn") {
    return SSN_PATTERN.test(String(value)) ? null : "Enter SSN as ###-##-####."
  }

  if (field.type === "zip") {
    return /^\d{5}$/.test(String(value)) ? null : "ZIP must be exactly 5 digits."
  }

  if (field.type === "date") {
    const date = parseDate(String(value))
    if (!date) {
      return "Enter date as MM/DD/YYYY."
    }

    if (DOB_FIELD_PATTERN.test(field.id) && date.getTime() > Date.now()) {
      return "Date of birth cannot be in the future."
    }

    if (DOB_FIELD_PATTERN.test(field.id)) {
      return validateDobBounds(date)
    }
  }

  if (field.type === "number") {
    const numeric = Number.parseFloat(String(value))
    if (!Number.isFinite(numeric)) {
      return "Enter a valid number."
    }

    if (numeric < 0) {
      return "Value cannot be negative."
    }

    if (field.validation?.min !== undefined && numeric < field.validation.min) {
      return `Value must be at least ${field.validation.min}.`
    }

    if (field.validation?.max !== undefined && numeric > field.validation.max) {
      return `Value must be at most ${field.validation.max}.`
    }
  }

  if (field.type === "currency") {
    const numeric = parseCurrency(String(value))
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "Enter a valid non-negative amount."
    }
  }

  return null
}

export function validateFieldsRecursive({
  fields,
  values,
  getValue,
  errors,
  errorPrefix,
  personNumber,
}: ValidationParams) {
  for (const field of fields) {
    if (field.applicable_from_person && personNumber && personNumber < field.applicable_from_person) {
      continue
    }

    const visible = evaluateConditionalRule(field.show_if, values)
    if (!visible) {
      continue
    }

    let requiredByRule = false
    if (typeof field.required_if === "boolean") {
      requiredByRule = field.required_if
    } else if (field.required_if) {
      requiredByRule = evaluateConditionalRule(field.required_if, values)
    }

    const isRequired = Boolean(field.required) || requiredByRule
    const fieldValue = getValue(field.id)

    if (field.type === "address_group") {
      const subFields = Object.values(field.fields ?? {})
      for (const subField of subFields) {
        const subValue = getValue(subField.id)
        const subRequired = Boolean(subField.required) || (isRequired && isAddressCoreField(subField))
        const subError = validateFieldValue(subField, subValue, subRequired)

        if (subError) {
          errors[`${errorPrefix}${subField.id}`] = subError
        }
      }
      continue
    }

    if (field.type === "repeatable_group") {
      const rows = Array.isArray(fieldValue) ? (fieldValue as Array<Record<string, unknown>>) : []
      const groupSchema = field.group_schema ?? []

      rows.forEach((row, rowIndex) => {
        const rowValues = {
          ...values,
          ...row,
        }

        validateFieldsRecursive({
          fields: groupSchema,
          values: rowValues,
          getValue: (fieldId) => row[fieldId],
          errors,
          errorPrefix: `${errorPrefix}${field.id}.${rowIndex}.`,
          personNumber,
        })
      })
      continue
    }

    if (field.type === "income_checklist") {
      const checklistValue = (fieldValue as Record<string, Record<string, unknown>>) ?? {}

      for (const item of field.items ?? []) {
        const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
        if (!itemValue.selected) {
          continue
        }

        const amount = itemValue.amount
        const frequency = itemValue.frequency

        if (!isFilled(amount)) {
          errors[`${errorPrefix}${field.id}.${item.id}.amount`] = "Amount is required."
        } else if (parseCurrency(String(amount)) < 0) {
          errors[`${errorPrefix}${field.id}.${item.id}.amount`] = "Amount cannot be negative."
        }

        if (!isFilled(frequency)) {
          errors[`${errorPrefix}${field.id}.${item.id}.frequency`] = "Frequency is required."
        }

        for (const extra of item.extra_fields ?? []) {
          const extraValue = itemValue[extra]
          if (!isFilled(extraValue)) {
            errors[`${errorPrefix}${field.id}.${item.id}.${extra}`] = "This field is required."
          }
        }
      }
      continue
    }

    if (field.type === "deduction_checklist") {
      const checklistValue = (fieldValue as Record<string, Record<string, unknown>>) ?? {}

      for (const item of field.items ?? []) {
        const itemValue = (checklistValue[item.id] ?? {}) as Record<string, unknown>
        if (!itemValue.selected || item.id === "ded_none") {
          continue
        }

        const yearlyAmount = itemValue.yearly_amount
        if (!isFilled(yearlyAmount)) {
          errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`] = "Yearly amount is required."
        } else if (parseCurrency(String(yearlyAmount)) < 0) {
          errors[`${errorPrefix}${field.id}.${item.id}.yearly_amount`] = "Amount cannot be negative."
        }
      }
      continue
    }

    if (field.id === "spouse_name_dob") {
      const spouseName = String(getValue(`${field.id}__name`) ?? "").trim()
      const spouseDobUs = String(getValue(`${field.id}__dob`) ?? "").trim()

      if (isRequired && spouseName.length === 0) {
        errors[`${errorPrefix}${field.id}__name`] = "Spouse name is required."
      } else if (spouseName.length > 0 && !hasFirstAndLastName(spouseName)) {
        errors[`${errorPrefix}${field.id}__name`] = "Enter first and last name."
      }

      if (isRequired && spouseDobUs.length === 0) {
        errors[`${errorPrefix}${field.id}__dob`] = "Spouse date of birth is required."
      } else if (spouseDobUs.length > 0) {
        const spouseDobDate = parseDate(spouseDobUs)
        if (!spouseDobDate) {
          errors[`${errorPrefix}${field.id}__dob`] = "Enter date as MM/DD/YYYY."
        } else {
          const dobBoundsError = validateDobBounds(spouseDobDate)
          if (dobBoundsError) {
            errors[`${errorPrefix}${field.id}__dob`] = dobBoundsError
          }
        }
      }

      continue
    }

    if (field.id === "dependents_list") {
      const rawRows = getValue(`${field.id}__rows`)
      const parsedRows =
        typeof fieldValue === "string" ? parseDependentsListValue(fieldValue) : []
      const rows = Array.isArray(rawRows)
        ? (rawRows as Array<Record<string, unknown>>).map((row) => ({
            name: String(row.name ?? "").trim(),
            dob: String(row.dob ?? "").trim(),
          }))
        : parsedRows.map((row) => ({
            name: row.name.trim(),
            dob: row.dob.trim(),
          }))

      const enteredRows = rows.filter((row) => row.name.length > 0 || row.dob.length > 0)

      if (isRequired && enteredRows.length === 0) {
        errors[`${errorPrefix}${field.id}__rows`] = "Add at least one dependent with name and date of birth."
      }

      enteredRows.forEach((row, rowIndex) => {
        if (!row.name) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`] = "Dependent name is required."
        } else if (!hasFirstAndLastName(row.name)) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.name`] = "Enter first and last name."
        }

        if (!row.dob) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] = "Dependent date of birth is required."
          return
        }

        const dobDate = parseDate(row.dob)
        if (!dobDate) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] = "Enter date as MM/DD/YYYY."
          return
        }

        const dobBoundsError = validateDobBounds(dobDate)
        if (dobBoundsError) {
          errors[`${errorPrefix}${field.id}__rows.${rowIndex}.dob`] = dobBoundsError
        }
      })

      continue
    }

    const fieldError = validateFieldValue(field, fieldValue, isRequired)
    if (fieldError) {
      errors[`${errorPrefix}${field.id}`] = fieldError
    }

    const activeSubFields = getActiveSubFields(field, fieldValue)

    if (activeSubFields.length > 0) {
      validateFieldsRecursive({
        fields: activeSubFields,
        values,
        getValue,
        errors,
        errorPrefix,
        personNumber,
      })
    }
  }
}

export function sectionHasAnyAnswer(fields: SchemaField[], getValue: (fieldId: string) => unknown): boolean {
  for (const field of fields) {
    const value = getValue(field.id)
    if (isFilled(value)) {
      return true
    }

    if (field.type === "address_group" && field.fields) {
      if (Object.values(field.fields).some((subField) => isFilled(getValue(subField.id)))) {
        return true
      }
    }

    if (field.sub_fields) {
      const subGroups = Object.values(field.sub_fields)
      if (subGroups.some((subFields) => sectionHasAnyAnswer(subFields, getValue))) {
        return true
      }
    }
  }

  return false
}

export function PersonTabStatus({ complete }: { complete: boolean }) {
  return complete ? (
    <CircleCheck className="h-4 w-4 text-emerald-500" />
  ) : (
    <AlertTriangle className="h-4 w-4 text-amber-500" />
  )
}

export function validateStepWithWizardRules(step: number, data: WizardData): Record<string, string> {
  const errors: Record<string, string> = {}
  const personCount = clampPersonCount(data.contact.p1_num_people || data.persons.length || 1)

  if (step === 1) {
    return errors
  }

  if (step === 2) {
    const contactValues = {
      ...data.preApp,
      ...data.contact,
    }

    validateFieldsRecursive({
      fields: ACA3_SCHEMA.step1_contact.fields,
      values: contactValues,
      getValue: (fieldId) => data.contact[fieldId],
      errors,
      errorPrefix: "step2.contact.",
    })

    if (data.assisterEnabled) {
      validateFieldsRecursive({
        fields: ACA3_SCHEMA.enrollment_assister.fields,
        values: {
          ...contactValues,
          ...data.assister,
        },
        getValue: (fieldId) => data.assister[fieldId],
        errors,
        errorPrefix: "step2.assister.",
      })
    }

    return errors
  }

  if (step === 3) {
    const identitySection = ACA3_PERSON_SECTIONS_BY_ID.get("ss_identity")
    if (!identitySection) {
      return errors
    }

    for (let personIndex = 1; personIndex < personCount; personIndex += 1) {
      const person = data.persons[personIndex]
      if (!person) {
        continue
      }

      validateFieldsRecursive({
        fields: identitySection.fields,
        values: {
          ...data.contact,
          ...person.identity,
        },
        getValue: (fieldId) => person.identity[fieldId],
        errors,
        errorPrefix: `step3.person${personIndex + 1}.identity.`,
        personNumber: personIndex + 1,
      })
    }

    return errors
  }

  const sectionIds = PERSON_STEP_SECTION_IDS[step]
  if (!sectionIds) {
    return errors
  }

  for (let personIndex = 0; personIndex < personCount; personIndex += 1) {
    const person = data.persons[personIndex]
    if (!person) {
      continue
    }

    for (const sectionId of sectionIds) {
      const section = ACA3_PERSON_SECTIONS_BY_ID.get(sectionId)
      const sectionKey = PERSON_SECTION_MAP[sectionId]
      if (!section || !sectionKey) {
        continue
      }
      const skippedOptionalSection =
        step === 4 && section.optional && Boolean(person.skippedOptional[sectionId])

      if (skippedOptionalSection) {
        continue
      }

      const sectionValues = person[sectionKey]
      const contextValues = {
        ...data.preApp,
        ...data.contact,
        ...person.identity,
        ...person.demographics,
        ...person.ssn,
        ...person.tax,
        ...person.coverage,
        ...person.income,
      }

      validateFieldsRecursive({
        fields: section.fields,
        values: contextValues,
        getValue: (fieldId) => sectionValues[fieldId],
        errors,
        errorPrefix: `step${step}.person${personIndex + 1}.${sectionId}.`,
        personNumber: personIndex + 1,
      })

      if (step === 4 && section.optional) {
        const skipped = Boolean(person.skippedOptional[sectionId])
        const hasAnyAnswer = sectionHasAnyAnswer(section.fields, (fieldId) => sectionValues[fieldId])

        if (!skipped && !hasAnyAnswer) {
          errors[`step4.person${personIndex + 1}.${sectionId}.skip`] =
            "Complete this optional section or explicitly skip it for this person."
        }
      }
    }
  }

  return errors
}

export function useStepValidation() {
  const { state } = useFormContext()

  return useCallback(
    (step: number): Record<string, string> => validateStepWithWizardRules(step, state.data),
    [state.data],
  )
}
