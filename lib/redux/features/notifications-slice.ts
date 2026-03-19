import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { Notification } from "@/lib/notifications/types"

export interface NotificationsState {
  items: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,
}

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<Notification[]>) {
      state.items = action.payload
      state.unreadCount = action.payload.filter((n) => !n.readAt).length
      state.loading = false
      state.error = null
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload
    },
    markRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload)
      if (item && !item.readAt) {
        item.readAt = new Date().toISOString()
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
    markAllRead(state) {
      const now = new Date().toISOString()
      state.items.forEach((n) => {
        if (!n.readAt) n.readAt = now
      })
      state.unreadCount = 0
    },
    revertMarkRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload)
      if (item && item.readAt) {
        item.readAt = null
        state.unreadCount += 1
      }
    },
    revertMarkAllRead(state, action: PayloadAction<{ unreadIds: string[]; prevCount: number }>) {
      for (const id of action.payload.unreadIds) {
        const item = state.items.find((n) => n.id === id)
        if (item) item.readAt = null
      }
      state.unreadCount = action.payload.prevCount
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
      if (action.payload) state.error = null
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
      state.loading = false
    },
  },
})

export const {
  setNotifications,
  setUnreadCount,
  markRead,
  markAllRead,
  revertMarkRead,
  revertMarkAllRead,
  setLoading,
  setError,
} = notificationsSlice.actions

export const notificationsReducer = notificationsSlice.reducer
