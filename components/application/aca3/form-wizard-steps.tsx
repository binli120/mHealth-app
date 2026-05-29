/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Step components extracted from form-wizard.tsx:
 *   StepContainer, Step1ProgramSelection, Step2PrimaryApplicant,
 *   PersonIdentitySummaryCard, Step3HouseholdMembers, PersonStepTabs
 */

"use client"

import { type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ACA3_PERSON_SECTIONS_BY_ID,
  ACA3_SCHEMA,
  HOUSEHOLD_SIZE_OPTIONS,
  MAX_PERSON_COUNT,
  PERSON_SECTION_MAP,
  PERSON_STEP_SECTION_IDS,
  STEP_METADATA,
} from "@/lib/constant"
import { cn } from "@/lib/utils"
import { clampPersonCount } from "./wizard-reducer"
import { useFormContext } from "./form-wizard-context"
import { FieldRenderer } from "./form-wizard-field-renderer"
import { validateFieldsRecursive, sectionHasAnyAnswer, PersonTabStatus } from "./form-wizard-validation"
import type { SchemaField } from "./types"

export function StepContainer({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

export function Step1ProgramSelection() {
  const { state, dispatch } = useFormContext()
  const values = state.data.preApp

  return (
    <StepContainer title={ACA3_SCHEMA.pre_application.title} description={ACA3_SCHEMA.pre_application.description}>
      {ACA3_SCHEMA.pre_application.fields.map((field) => (
        <FieldRenderer
          key={`step1.${field.id}`}
          field={field}
          formValues={values}
          getValue={(fieldId) => values[fieldId]}
          setValue={(fieldId, value) => {
            dispatch({
              type: "set_root_field",
              payload: {
                scope: "preApp",
                fieldId,
                value,
              },
            })
          }}
          errors={state.errors}
          errorPrefix="step1.preapp."
        />
      ))}
    </StepContainer>
  )
}

export function Step2PrimaryApplicant() {
  const { state, dispatch } = useFormContext()
  const values = {
    ...state.data.preApp,
    ...state.data.contact,
  }
  const applicantIdentityFieldIds = ["p1_dob", "p1_email"] as const
  const phoneFieldIds = ["p1_phone", "p1_other_phone"] as const
  const languageFieldIds = ["p1_language_spoken", "p1_language_written"] as const
  const step2FieldMap = new Map(ACA3_SCHEMA.step1_contact.fields.map((field) => [field.id, field]))

  const renderContactField = (field: SchemaField, key: string) => (
    <FieldRenderer
      key={key}
      field={field}
      formValues={values}
      getValue={(fieldId) => state.data.contact[fieldId]}
      setValue={(fieldId, value) => {
        if (fieldId === "p1_num_people") {
          const nextCount = clampPersonCount(value)
          dispatch({
            type: "set_person_count",
            payload: nextCount,
          })
          return
        }

        dispatch({
          type: "set_root_field",
          payload: {
            scope: "contact",
            fieldId,
            value,
          },
        })
      }}
      errors={state.errors}
      errorPrefix="step2.contact."
    />
  )

  return (
    <StepContainer title="Primary Applicant & Household Setup" description="Person 1 identity comes from this step.">
      <div className="space-y-4">
        {ACA3_SCHEMA.step1_contact.fields.map((field) => (
          field.id === applicantIdentityFieldIds[0] ? (
            <div key="step2.group.applicant-identity" className="grid gap-4 md:grid-cols-2">
              {applicantIdentityFieldIds.map((fieldId) => {
                const identityField = step2FieldMap.get(fieldId)
                if (!identityField) {
                  return null
                }
                return renderContactField(identityField, `step2.${fieldId}`)
              })}
            </div>
          ) : field.id === applicantIdentityFieldIds[1] ? null : field.id === phoneFieldIds[0] ? (
            <div key="step2.group.phone" className="grid gap-4 md:grid-cols-2">
              {phoneFieldIds.map((fieldId) => {
                const phoneField = step2FieldMap.get(fieldId)
                if (!phoneField) {
                  return null
                }
                return renderContactField(phoneField, `step2.${fieldId}`)
              })}
            </div>
          ) : field.id === phoneFieldIds[1] ? null : field.id === languageFieldIds[0] ? (
            <div key="step2.group.language" className="grid gap-4 md:grid-cols-2">
              {languageFieldIds.map((fieldId) => {
                const languageField = step2FieldMap.get(fieldId)
                if (!languageField) {
                  return null
                }
                return renderContactField(languageField, `step2.${fieldId}`)
              })}
            </div>
          ) : field.id === languageFieldIds[1] ? null : (
            renderContactField(field, `step2.${field.id}`)
          )
        ))}
      </div>

      <Collapsible open={state.data.assisterEnabled} onOpenChange={(open) => dispatch({ type: "set_assister_enabled", payload: open })}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            I am an enrollment assister completing this on someone&apos;s behalf
            <ChevronDown className={cn("h-4 w-4 transition-transform", state.data.assisterEnabled ? "rotate-180" : "")}/>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          {ACA3_SCHEMA.enrollment_assister.fields.map((field) => (
            <FieldRenderer
              key={`step2.assister.${field.id}`}
              field={field}
              formValues={{
                ...values,
                ...state.data.assister,
              }}
              getValue={(fieldId) => state.data.assister[fieldId]}
              setValue={(fieldId, value) => {
                dispatch({
                  type: "set_root_field",
                  payload: {
                    scope: "assister",
                    fieldId,
                    value,
                  },
                })
              }}
              errors={state.errors}
              errorPrefix="step2.assister."
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </StepContainer>
  )
}

export function PersonIdentitySummaryCard() {
  const { state } = useFormContext()

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">You (Person 1)</CardTitle>
        <CardDescription>Read-only summary from Step 2 contact fields.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          <span className="text-muted-foreground">Name:</span> {String(state.data.contact.p1_name || "—")}
        </div>
        <div>
          <span className="text-muted-foreground">DOB:</span> {String(state.data.contact.p1_dob || "—")}
        </div>
        <div>
          <span className="text-muted-foreground">Email:</span> {String(state.data.contact.p1_email || "—")}
        </div>
        <div>
          <span className="text-muted-foreground">Phone:</span> {String(state.data.contact.p1_phone || "—")}
        </div>
      </CardContent>
    </Card>
  )
}

export function Step3HouseholdMembers() {
  const { state, dispatch } = useFormContext()
  const personCount = clampPersonCount(state.data.contact.p1_num_people || state.data.persons.length || 1)
  const identitySection = ACA3_PERSON_SECTIONS_BY_ID.get("ss_identity")

  if (!identitySection) {
    return null
  }

  return (
    <StepContainer title="Household Members" description="Persons 2 through N are editable here using ss_identity.">
      <PersonIdentitySummaryCard />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">How many people are on this application?</CardTitle>
          <CardDescription>Person 1 is you. Add Person to enter Person 2, 3, 4, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-28">
              <Label htmlFor="step3-household-count">Household size</Label>
              <Select
                value={String(personCount)}
                onValueChange={(value) => {
                  dispatch({
                    type: "set_person_count",
                    payload: Number.parseInt(value, 10),
                  })
                }}
              >
                <SelectTrigger id="step3-household-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUSEHOLD_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={`step3-household-count-${option}`} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                dispatch({
                  type: "set_person_count",
                  payload: personCount + 1,
                })
              }}
              disabled={personCount >= MAX_PERSON_COUNT}
            >
              Add Person
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Maximum supported household size is {MAX_PERSON_COUNT} people.
          </p>
        </CardContent>
      </Card>

      {Array.from({ length: Math.max(0, personCount - 1) }, (_, offset) => {
        const personIndex = offset + 1
        const person = state.data.persons[personIndex]

        if (!person) {
          return null
        }

        const contextValues = {
          ...state.data.contact,
          ...person.identity,
        }

        return (
          <Card key={`step3-person-${personIndex + 1}`}>
            <CardHeader>
              <CardTitle className="text-base">Person {personIndex + 1}</CardTitle>
              <CardDescription>Identity fields from `person_schema.ss_identity`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {identitySection.fields.map((field) => (
                <FieldRenderer
                  key={`step3.person${personIndex + 1}.${field.id}`}
                  field={field}
                  formValues={contextValues}
                  getValue={(fieldId) => person.identity[fieldId]}
                  setValue={(fieldId, value) => {
                    dispatch({
                      type: "set_person_field",
                      payload: {
                        personIndex,
                        section: "identity",
                        fieldId,
                        value,
                      },
                    })
                  }}
                  errors={state.errors}
                  errorPrefix={`step3.person${personIndex + 1}.identity.`}
                  personNumber={personIndex + 1}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}

      {personCount === 1 ? (
        <p className="text-sm text-muted-foreground">
          No additional people yet. Increase household size above 1 to enter Person 2 and beyond.
        </p>
      ) : null}
    </StepContainer>
  )
}

export function PersonStepTabs({ step }: { step: 4 | 5 | 6 | 7 }) {
  const { state, dispatch } = useFormContext()
  const personCount = clampPersonCount(state.data.contact.p1_num_people || state.data.persons.length || 1)
  const sectionIds = PERSON_STEP_SECTION_IDS[step] ?? []
  const activeTab = state.tabByStep[step] ?? 0
  const singlePerson = personCount === 1

  const getTabCompletion = (personIndex: number): boolean => {
    const person = state.data.persons[personIndex]
    if (!person) {
      return false
    }

    const tabErrors: Record<string, string> = {}

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
        ...state.data.preApp,
        ...state.data.contact,
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
        errors: tabErrors,
        errorPrefix: `step${step}.person${personIndex + 1}.${sectionId}.`,
        personNumber: personIndex + 1,
      })

      if (step === 4 && section.optional) {
        const skipped = Boolean(person.skippedOptional[sectionId])
        const hasAnyAnswer = sectionHasAnyAnswer(section.fields, (fieldId) => sectionValues[fieldId])
        if (!skipped && !hasAnyAnswer) {
          tabErrors[`step4.person${personIndex + 1}.${sectionId}.skip`] =
            "Complete this optional section or skip it."
        }
      }
    }

    return Object.keys(tabErrors).length === 0
  }

  const renderPersonSections = (personIndex: number) => {
    const person = state.data.persons[personIndex]
    if (!person) {
      return null
    }

    return (
      <div className="space-y-6">
        {sectionIds.map((sectionId) => {
          const section = ACA3_PERSON_SECTIONS_BY_ID.get(sectionId)
          const sectionKey = PERSON_SECTION_MAP[sectionId]
          if (!section || !sectionKey) {
            return null
          }

          const sectionValues = person[sectionKey]
          const isOptionalSkipped = section.optional && Boolean(person.skippedOptional[sectionId])
          const contextValues = {
            ...state.data.preApp,
            ...state.data.contact,
            ...person.identity,
            ...person.demographics,
            ...person.ssn,
            ...person.tax,
            ...person.coverage,
            ...person.income,
          }

          return (
            <Card key={`step${step}-person${personIndex + 1}-${sectionId}`}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                {section.description ? <CardDescription>{section.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {section.optional ? (
                  <div className="rounded-md border border-dashed bg-muted/20 p-3">
                    <p className="text-sm text-muted-foreground">Optional section</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={person.skippedOptional[sectionId] ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          dispatch({
                            type: "set_person_optional_skip",
                            payload: {
                              personIndex,
                              sectionId,
                              value: !Boolean(person.skippedOptional[sectionId]),
                            },
                          })
                        }}
                      >
                        {person.skippedOptional[sectionId] ? "Skipped" : "Skip this optional section"}
                      </Button>
                    </div>
                    {state.errors[`step${step}.person${personIndex + 1}.${sectionId}.skip`] ? (
                      <p className="mt-2 text-sm text-destructive">{state.errors[`step${step}.person${personIndex + 1}.${sectionId}.skip`]}</p>
                    ) : null}
                  </div>
                ) : null}

                {isOptionalSkipped ? (
                  <p className="text-sm text-muted-foreground">
                    This optional section is skipped for this person. Toggle off &quot;Skipped&quot; to edit these fields.
                  </p>
                ) : (
                  section.fields.map((field) => (
                    <FieldRenderer
                      key={`step${step}.person${personIndex + 1}.${sectionId}.${field.id}`}
                      field={field}
                      formValues={contextValues}
                      getValue={(fieldId) => sectionValues[fieldId]}
                      setValue={(fieldId, value) => {
                        dispatch({
                          type: "set_person_field",
                          payload: {
                            personIndex,
                            section: sectionKey,
                            fieldId,
                            value,
                          },
                        })
                      }}
                      errors={state.errors}
                      errorPrefix={`step${step}.person${personIndex + 1}.${sectionId}.`}
                      personNumber={personIndex + 1}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  if (singlePerson) {
    return (
      <StepContainer title={STEP_METADATA[step - 1].title}>
        {renderPersonSections(0)}
      </StepContainer>
    )
  }

  return (
    <StepContainer title={STEP_METADATA[step - 1].title}>
      <Tabs value={String(activeTab)} onValueChange={(value) => dispatch({ type: "set_tab", payload: { step, tab: Number.parseInt(value, 10) || 0 } })}>
        <TabsList className="h-auto w-full flex-wrap items-stretch justify-start gap-2 bg-transparent p-0">
          {Array.from({ length: personCount }, (_, personIndex) => {
            const complete = getTabCompletion(personIndex)
            const label = personIndex === 0 ? "You (Person 1)" : `Person ${personIndex + 1}`

            return (
              <TabsTrigger
                key={`step${step}-tab-${personIndex}`}
                value={String(personIndex)}
                className="h-auto min-w-44 justify-between rounded-md border bg-card px-3 py-2"
              >
                <span className="text-sm">{label}</span>
                <PersonTabStatus complete={complete} />
              </TabsTrigger>
            )
          })}
        </TabsList>

        {Array.from({ length: personCount }, (_, personIndex) => (
          <TabsContent key={`step${step}-tab-content-${personIndex}`} value={String(personIndex)} className="mt-5">
            {renderPersonSections(personIndex)}
          </TabsContent>
        ))}
      </Tabs>
    </StepContainer>
  )
}
