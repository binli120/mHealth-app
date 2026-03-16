import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { UserProfile, UserProfileData } from "@/lib/user-profile/types"

export interface UserProfileState {
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

const initialState: UserProfileState = {
  profile: null,
  loading: false,
  error: null,
}

const userProfileSlice = createSlice({
  name: "userProfile",
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<UserProfile>) {
      state.profile = action.payload
      state.loading = false
      state.error = null
    },
    updateProfileData(state, action: PayloadAction<Partial<UserProfileData>>) {
      if (state.profile) {
        state.profile = {
          ...state.profile,
          profileData: { ...state.profile.profileData, ...action.payload },
        }
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
      if (action.payload) state.error = null
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
      state.loading = false
    },
    resetProfile(state) {
      state.profile = null
      state.loading = false
      state.error = null
    },
  },
})

export const { setProfile, updateProfileData, setLoading, setError, resetProfile } =
  userProfileSlice.actions

export const userProfileReducer = userProfileSlice.reducer
