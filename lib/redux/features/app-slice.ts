import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import { DEFAULT_LANGUAGE, type SupportedLanguage } from "@/lib/i18n/languages"

export interface AppState {
  language: SupportedLanguage
}

const initialState: AppState = {
  language: DEFAULT_LANGUAGE,
}

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<SupportedLanguage>) => {
      state.language = action.payload
    },
  },
})

export const { setLanguage } = appSlice.actions
export const appReducer = appSlice.reducer
