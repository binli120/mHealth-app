import { configureStore } from "@reduxjs/toolkit"

import { applicationReducer } from "@/lib/redux/features/application-slice"
import { appReducer } from "@/lib/redux/features/app-slice"
import { extractWorkflowReducer } from "@/lib/redux/features/extract-workflow-slice"
import { benefitOrchestrationReducer } from "@/lib/redux/features/benefit-orchestration-slice"
import { userProfileReducer } from "@/lib/redux/features/user-profile-slice"

export const makeStore = () =>
  configureStore({
    devTools: false,
    reducer: {
      app: appReducer,
      application: applicationReducer,
      extractWorkflow: extractWorkflowReducer,
      benefitOrchestration: benefitOrchestrationReducer,
      userProfile: userProfileReducer,
    },
  })

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore["getState"]>
export type AppDispatch = AppStore["dispatch"]
