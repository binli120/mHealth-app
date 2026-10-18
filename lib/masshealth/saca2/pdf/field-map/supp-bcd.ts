/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import {
  SUPP_B_MEMBERS_PATH,
  SUPP_B_PAGES,
  SUPP_B_PER_PAGE,
  SUPP_C_ACTIVITIES,
  SUPP_C_CAREGIVER_LINES,
  SUPP_C_HEALTH_LINES,
  SUPP_C_PAGES,
  SUPP_D_JOBS_PATH,
  SUPP_D_PAGES,
} from "../derived-supp-bcd"
import { copyFieldName } from "../page-duplication"
import type { Encoder, FieldEntry } from "../types"

/** Every Yes/No group on Supplements B and D names its states Yes (left) / No (read from the template, asserted by the coverage test). */
const YES_NO: Encoder = { kind: "yesNo", yes: "Yes", no: "No" }

const derived = (field: string, id: string, encode: Encoder = "text"): FieldEntry => ({
  fields: [field],
  source: { kind: "derived", id },
  encode,
})

/**
 * The entries of one page of a region. `name` renames a template field for the page: the template page
 * keeps its names, copy `n` of the page gets `<name>__copy<n>` (page-duplication.ts), so one function
 * describes the page and every copy of it.
 */
type PageEntries = (page: number, name: (field: string) => string) => FieldEntry[]

const pagesOf = (build: PageEntries, count: number, from: number): FieldEntry[] =>
  Array.from({ length: count - from }, (_, i) => from + i).flatMap((page) =>
    build(page, (field) => copyFieldName(field, page)),
  )

// ---------------------------------------------------------------------------------------------
// Supplement B (form page 29, PDF index 30): two AI/AN people side by side
// ---------------------------------------------------------------------------------------------

interface BColumn {
  name: string
  federal: string
  federalTribe: string
  mass: string
  massTribe: string
  receivedIhs: string
  eligible: string
  amount: string
  frequency: string
}

const B_COLUMNS: BColumn[] = [
  {
    name: "AI/AN Person 1. Name first middle last",
    federal: "AI/AN Person 1. Member of a federally recognized tribe?",
    federalTribe: "AI/AN Person 1. If Yes tribe name",
    mass: "AI/AN Person 1. Member of a Massachusetts recognized tribe?",
    massTribe: "AI/AN Person 1. If Yes tribe name_2",
    receivedIhs: "AI/AN Person 1. Has this person ever gotten a service from programs?",
    eligible: "AI/AN Person 1. If No, is this person eligible to get services?",
    amount: "AI/AN Person 1. Money from selling things that have cultural significance",
    frequency: "AI/AN Person 1. How often",
  },
  {
    name: "AI/AN Person 2. Name first middle last_2",
    federal: "AI/AN Person 2. Member of a federally recognized tribe?",
    federalTribe: "AI/AN Person 2. If Yes tribe name_3",
    mass: "AI/AN Person 2. Member of a Massachusetts recognized tribe?",
    massTribe: "AI/AN Person 2. If Yes tribe name_4",
    receivedIhs: "AI/AN Person 2. Has this person ever gotten a service from programs?",
    eligible: "AI/AN Person 2. If No, is this person eligible to get services?",
    amount: "AI/AN Person 2. Money from selling things that have cultural significance_2",
    frequency: "AI/AN Person 2. How often_2",
  },
]

/** Page `page` holds members `2 * page` and `2 * page + 1`, left to right. */
const suppBPage: PageEntries = (page, name) =>
  B_COLUMNS.flatMap((column, side) => {
    const member = page * SUPP_B_PER_PAGE + side
    const row = (field: string, key: string, encode: Encoder): FieldEntry => ({
      fields: [name(field)],
      source: { kind: "row", stepId: "suppB", path: SUPP_B_MEMBERS_PATH, index: member, key },
      encode,
    })
    return [
      row(column.name, "name", "text"),
      row(column.federal, "federallyRecognizedTribe", YES_NO),
      row(column.federalTribe, "tribeName", "text"),
      row(column.mass, "massRecognizedTribe", YES_NO),
      row(column.massTribe, "massTribeName", "text"),
      row(column.receivedIhs, "receivedIhsService", YES_NO),
      row(column.eligible, "eligibleForIhs", YES_NO),
      row(column.amount, "excludedIncomeAmount", "money"),
      derived(name(column.frequency), `suppB.${member}.excludedIncomeFrequency`),
    ]
  })

// ---------------------------------------------------------------------------------------------
// Supplement C (form page 30, PDF index 31): one person per page
// ---------------------------------------------------------------------------------------------

/** The grid's rows in printed order; the first row's times/days fields have no numeric suffix. */
const gridField = (base: string, row: number): string => (row === 0 ? base : `${base}_${row + 1}`)

const CAREGIVER_FIELDS = [
  { name: "Caregiver name_SuppC", relationship: "Relationship to you_SuppC" },
  { name: "Caregiver name_SuppC_2", relationship: "Relationship to you_SuppC_2" },
]

/** Page `page` is the `page`-th qualifying person's (derived `suppC.<page>.*`). */
const suppCPage: PageEntries = (page, name) => {
  const id = (rest: string) => `suppC.${page}.${rest}`
  return [
    derived(name("Last name_SuppC"), id("person.lastName")),
    derived(name("First name_SuppC"), id("person.firstName")),
    derived(name("MI_SuppC"), id("person.middleInitial")),
    derived(name("Telephone number_SuppC"), id("person.phone"), "phone"),
    derived(name("Social security number_SuppC"), id("person.ssn")),
    derived(name("Date of birth mmddyyyy_SuppC"), id("person.dateOfBirth"), "date"),
    derived(name("Gender_SuppC"), id("person.sex"), { kind: "pick", states: { male: "M", female: "F" } }),
    derived(name("Street address_SuppC"), id("person.street")),
    derived(name("City_SuppC"), id("person.city")),
    derived(name("State_SuppC"), id("person.state"), "upper"),
    derived(name("ZIP_SuppC"), id("person.zip")),
    ...Array.from({ length: SUPP_C_HEALTH_LINES }, (_, line) =>
      derived(name(`SuppC_Health info_${line + 1}`), id(`health.${line}`)),
    ),
    ...SUPP_C_ACTIVITIES.flatMap((activity, row) => [
      derived(name(`Do you need hands-on help?_${row + 1}`), id(`activity.${activity}.needsHandsOnHelp`), YES_NO),
      derived(name(gridField("How many times a day do you need handson help", row)), id(`activity.${activity}.timesPerDay`), "number"),
      derived(name(gridField("How many days a week do you need handson help", row)), id(`activity.${activity}.daysPerWeek`), "number"),
    ]),
    ...CAREGIVER_FIELDS.slice(0, SUPP_C_CAREGIVER_LINES).flatMap((fields, line) => [
      derived(name(fields.name), id(`caregiver.${line}.name`)),
      derived(name(fields.relationship), id(`caregiver.${line}.relationship`)),
    ]),
  ]
}

// ---------------------------------------------------------------------------------------------
// Supplement D (form page 31, PDF index 32): one job per page
// ---------------------------------------------------------------------------------------------

const boxes = (base: string): string[] => Array.from({ length: 9 }, (_, i) => `${base}_${i + 1}`)

/** Page `page` is job `page` (the wizard's row `page`). */
const suppDPage: PageEntries = (page, name) => {
  const row = (field: string | string[], key: string, encode: Encoder): FieldEntry => ({
    fields: (Array.isArray(field) ? field : [field]).map(name),
    source: { kind: "row", stepId: "suppD", path: SUPP_D_JOBS_PATH, index: page, key },
    encode,
  })
  const id = (rest: string) => `suppD.${page}.${rest}`
  return [
    row("1. Employee name first middle last_SuppD", "employeeName", "text"),
    row(boxes("Employee social security number_SuppD"), "employeeSsn", { kind: "ssn" }),
    row("3a Is at least one person eligible?", "eligibleWithinThreeMonths", YES_NO),
    row("1b. If any person is in a waiting or probationary period when can this person enroll in coverage mmddyyyy", "waitingPeriodEnds", "date"),

    row("4 Employer name_SuppD", "employerName", "text"),
    // nine single-digit boxes; an ID that is not nine digits goes on the continuation sheet instead
    row(boxes("Federal Tax ID if known_SuppD"), "employerFederalTaxId", { kind: "ssn" }),
    row("6. Employer address_SuppD", "employerAddress", "text"),
    row("7. Employer phone number_SuppD", "employerPhone", "phone"),
    row("8. City_SuppD", "employerCity", "text"),
    row("9  State_SuppD", "employerState", "upper"),
    row("10.  ZIP code_suppD", "employerZip", "text"),
    row("11. Who can we contact about employee heath coverage at this job?_SuppD", "contactName", "text"),
    row("12 Phone number if different from above_SuppD", "contactPhone", "phone"),
    row("13. Email address_SuppD", "contactEmail", "text"),

    // Item 14a (the name of the lowest-cost individual plan) has NO field on the template: its line is
    // printed without one, so the name goes on the continuation sheet (overflow-supp-bcd.ts).
    row("14. Does the employer offer a health plan that meets the minimum value standard*?", "individualMeetsMinimumValue", YES_NO),
    row("14c. How much would this employee pay in premiums for this plan?", "individualPremium", "money"),
    derived(name("14d. How often would the employee pay this amount?"), id("frequency.individual")),

    // The template's "15a ... self-only" field is the line under question 15a (the other-household-members plan)
    row("15a.   What is the name of the lowest cost self-only health plan offered to the employee?", "familyPlanName", "text"),
    row("15b. Does the health plan offered by the employer meet the minimum value standard for coverage?", "familyMeetsMinimumValue", YES_NO),
    row("15c. How much does the employee have to pay in premiums for the lowest cost plan that meets the minimum value standard", "familyPremium", "money"),
    derived(name("15d. Only tell us about the cost of the individual selfonly health plans not the cost of a family health plan"), id("frequency.family")),

    derived(name("16a. Employer will not offer health coverage. Coverage end date (mm/dd/yyyy)"), id("endDate.employerWillNotOffer"), "date"),
    derived(name("16b. Date of change_SuppD"), id("endDate.personWillDrop"), "date"),
    row("16c. individual cost", "changePremium", "money"),
    derived(name("16c. How often?"), id("frequency.change")),
    row("16c. Date of change_SuppD", "changeDate", "date"),
  ]
}

/** The template pages' entries: part of FIELD_MAP, checked against the inventory by the coverage test. */
export const SUPP_BCD_ENTRIES: FieldEntry[] = [suppBPage, suppCPage, suppDPage].flatMap((build) =>
  pagesOf(build, 1, 0),
)

/**
 * The entries of the pages COPIED at fill time (`<template field>__copy<n>`): Supplement B pages 2-3
 * (members 3-6), Supplement C's second person, and Supplement D jobs 2-4. They are not in FIELD_MAP, because
 * the inventory describes the template; the fill adds them to the map (see FILL_MAP in field-map/index.ts).
 */
export const SUPP_BCD_COPY_ENTRIES: FieldEntry[] = [
  ...pagesOf(suppBPage, SUPP_B_PAGES, 1),
  ...pagesOf(suppCPage, SUPP_C_PAGES, 1),
  ...pagesOf(suppDPage, SUPP_D_PAGES, 1),
]
