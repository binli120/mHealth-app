import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

export interface AppState {
  language: string
}

const initialState: AppState = {
  language: "en",
}

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload
    },
  },
})

export const { setLanguage } = appSlice.actions
export const appReducer = appSlice.reducer
