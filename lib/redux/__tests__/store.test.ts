/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { describe, expect, it } from "vitest"

import {
  createApplication,
  DEFAULT_APPLICATION_ID,
  patchNewApplicationForm,
  resetNewApplicationForm,
  setActiveApplication,
  setApplicationWizardState,
} from "@/lib/redux/features/application-slice"
import { setLanguage } from "@/lib/redux/features/app-slice"
import { makeStore } from "@/lib/redux/store"

describe("lib/redux/store", () => {
  it("creates store with default app state and default application context", () => {
    const store = makeStore()

    expect(store.getState().app.language).toBe("en")
    expect(store.getState().application.activeApplicationId).toBe(DEFAULT_APPLICATION_ID)
    expect(
      store.getState().application.applicationsById[DEFAULT_APPLICATION_ID]?.newApplicationForm.state,
    ).toBe("MA")
  })

  it("applies app language updates", () => {
    const store = makeStore()

    store.dispatch(setLanguage("vi"))

    expect(store.getState().app.language).toBe("vi")
  })

  it("stores multiple applications and keeps their data isolated", () => {
    const store = makeStore()

    store.dispatch(createApplication({ applicationId: "app-a", applicationType: "ACA-3" }))
    store.dispatch(createApplication({ applicationId: "app-b", applicationType: "ACA-1" }))

    store.dispatch(
      patchNewApplicationForm({
        applicationId: "app-a",
        patch: { firstName: "Jane", certify: true },
      }),
    )
    store.dispatch(
      patchNewApplicationForm({
        applicationId: "app-b",
        patch: { firstName: "John", certify: false },
      }),
    )

    expect(store.getState().application.applicationsById["app-a"]?.newApplicationForm.firstName).toBe("Jane")
    expect(store.getState().application.applicationsById["app-a"]?.newApplicationForm.certify).toBe(true)
    expect(store.getState().application.applicationsById["app-b"]?.newApplicationForm.firstName).toBe("John")
    expect(store.getState().application.applicationsById["app-b"]?.newApplicationForm.certify).toBe(false)
  })

  it("stores ACA-3 wizard state under the selected application and resets cleanly", () => {
    const store = makeStore()

    store.dispatch(createApplication({ applicationId: "app-wizard", applicationType: "ACA-3" }))
    store.dispatch(setActiveApplication("app-wizard"))
    store.dispatch(
      setApplicationWizardState({
        wizardState: {
          currentStep: 6,
          data: {
            contact: {
              p1_name: "Taylor",
            },
          },
        },
      }),
    )

    expect(store.getState().application.applicationsById["app-wizard"]?.aca3Wizard).toEqual({
      currentStep: 6,
      data: {
        contact: {
          p1_name: "Taylor",
        },
      },
    })

    store.dispatch(resetNewApplicationForm({ applicationId: "app-wizard" }))

    expect(store.getState().application.applicationsById["app-wizard"]?.aca3Wizard).toBeNull()
  })
})
