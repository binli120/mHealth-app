/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import {
  addHouseholdMember,
  addIncomeSource,
  applicationReducer,
  createApplication,
  DEFAULT_APPLICATION_ID,
  initialApplicationFormData,
  patchNewApplicationForm,
  removeHouseholdMember,
  removeIncomeSource,
  resetNewApplicationForm,
  setActiveApplication,
  setApplicationWizardState,
  setNewApplicationForm,
} from "@/lib/redux/features/application-slice"

describe("lib/redux/features/application-slice", () => {
  it("returns initial state with default active application", () => {
    const state = applicationReducer(undefined, { type: "unknown" })

    expect(state.activeApplicationId).toBe(DEFAULT_APPLICATION_ID)
    expect(state.applicationOrder).toEqual([DEFAULT_APPLICATION_ID])
    expect(state.applicationsById[DEFAULT_APPLICATION_ID]?.newApplicationForm).toEqual(
      initialApplicationFormData,
    )
  })

  it("creates multiple applications and isolates form patches by application", () => {
    let state = applicationReducer(
      undefined,
      createApplication({
        applicationId: "app-1",
        applicationType: "ACA-3",
      }),
    )

    state = applicationReducer(
      state,
      createApplication({
        applicationId: "app-2",
        applicationType: "ACA-1",
      }),
    )

    state = applicationReducer(
      state,
      patchNewApplicationForm({
        applicationId: "app-1",
        patch: { firstName: "Jane" },
      }),
    )
    state = applicationReducer(
      state,
      patchNewApplicationForm({
        applicationId: "app-2",
        patch: { firstName: "John" },
      }),
    )

    expect(state.applicationsById["app-1"]?.newApplicationForm.firstName).toBe("Jane")
    expect(state.applicationsById["app-2"]?.newApplicationForm.firstName).toBe("John")
  })

  it("patches form fields for the active application by default", () => {
    let state = applicationReducer(undefined, createApplication({ applicationId: "app-main" }))
    state = applicationReducer(state, setActiveApplication("app-main"))
    state = applicationReducer(
      state,
      patchNewApplicationForm({
        firstName: "Pat",
        lastName: "Doe",
        aca3QuestionResponses: { "aca3-q-001": "Yes" },
      }),
    )

    expect(state.applicationsById["app-main"]?.newApplicationForm.firstName).toBe("Pat")
    expect(state.applicationsById["app-main"]?.newApplicationForm.lastName).toBe("Doe")
    expect(state.applicationsById["app-main"]?.newApplicationForm.aca3QuestionResponses["aca3-q-001"]).toBe("Yes")
  })

  it("sets full form snapshot for a specific application", () => {
    let state = applicationReducer(undefined, createApplication({ applicationId: "app-set" }))
    state = applicationReducer(
      state,
      setNewApplicationForm({
        applicationId: "app-set",
        form: {
          ...initialApplicationFormData,
          firstName: "John",
          state: "NY",
        },
      }),
    )

    expect(state.applicationsById["app-set"]?.newApplicationForm.firstName).toBe("John")
    expect(state.applicationsById["app-set"]?.newApplicationForm.state).toBe("NY")
  })

  it("adds and removes household members on the active application", () => {
    let state = applicationReducer(undefined, createApplication({ applicationId: "app-hh" }))
    state = applicationReducer(state, setActiveApplication("app-hh"))

    state = applicationReducer(
      state,
      addHouseholdMember({
        id: "m1",
        firstName: "Sam",
        lastName: "Doe",
        relationship: "child",
        dob: "2015-01-01",
        ssn: "",
        pregnant: false,
        disabled: false,
        over65: false,
      }),
    )

    expect(state.applicationsById["app-hh"]?.newApplicationForm.householdMembers).toHaveLength(1)

    state = applicationReducer(state, removeHouseholdMember("m1"))

    expect(state.applicationsById["app-hh"]?.newApplicationForm.householdMembers).toHaveLength(0)
  })

  it("adds and removes income sources on the active application", () => {
    let state = applicationReducer(undefined, createApplication({ applicationId: "app-income" }))
    state = applicationReducer(state, setActiveApplication("app-income"))

    state = applicationReducer(
      state,
      addIncomeSource({
        id: "i1",
        type: "employment",
        employer: "ACME",
        amount: "1000",
        frequency: "monthly",
      }),
    )

    expect(state.applicationsById["app-income"]?.newApplicationForm.incomeSources).toHaveLength(1)

    state = applicationReducer(state, removeIncomeSource("i1"))

    expect(state.applicationsById["app-income"]?.newApplicationForm.incomeSources).toHaveLength(0)
  })

  it("stores ACA-3 wizard snapshot under application context", () => {
    const wizardState = {
      currentStep: 5,
      data: {
        contact: {
          p1_name: "Jane Doe",
        },
      },
    }

    let state = applicationReducer(undefined, createApplication({ applicationId: "app-wizard" }))
    state = applicationReducer(
      state,
      setApplicationWizardState({
        applicationId: "app-wizard",
        wizardState,
      }),
    )

    expect(state.applicationsById["app-wizard"]?.aca3Wizard).toEqual(wizardState)
  })

  it("resets form data and wizard state for a specific application", () => {
    let state = applicationReducer(undefined, createApplication({ applicationId: "app-reset" }))
    state = applicationReducer(
      state,
      patchNewApplicationForm({
        applicationId: "app-reset",
        patch: { firstName: "Pat", certify: true },
      }),
    )
    state = applicationReducer(
      state,
      setApplicationWizardState({
        applicationId: "app-reset",
        wizardState: { currentStep: 3 },
      }),
    )
    state = applicationReducer(state, resetNewApplicationForm({ applicationId: "app-reset" }))

    expect(state.applicationsById["app-reset"]?.newApplicationForm).toEqual(
      initialApplicationFormData,
    )
    expect(state.applicationsById["app-reset"]?.aca3Wizard).toBeNull()
  })
})
