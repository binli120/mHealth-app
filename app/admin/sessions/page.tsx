"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useReducer, useCallback } from "react"
import {
  Monitor,
  LogOut,
  LogIn,
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  RefreshCw,
} from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionRow = {
  id: string
  user_id: string | null
  email: string | null
  full_name: string | null
  event_type: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

type PageState = {
  status: "loading" | "ready" | "error"
  sessions: SessionRow[]
  settings: Record<string, string>
  // Settings form (local edits)
  settingsForm: Record<string, string>
  settingsChanged: boolean
  savingSettings: boolean
  settingsMsg: string | null
  settingsMsgType: "success" | "error"
  // Force logout
  forcingOut: string | null   // userId being force-logged-out, or "all"
  forceMsg: string | null
  forceMsgType: "success" | "error"
}

type PageAction =
  | { type: "fetch_start" }
  | { type: "fetch_ok"; sessions: SessionRow[]; settings: Record<string, string> }
  | { type: "fetch_err" }
  | { type: "set_setting"; key: string; value: string }
  | { type: "save_settings_start" }
  | { type: "save_settings_ok"; settings: Record<string, string> }
  | { type: "save_settings_err"; msg: string }
  | { type: "settings_msg_clear" }
  | { type: "force_logout_start"; target: string }
  | { type: "force_logout_ok"; target: string }
  | { type: "force_logout_err"; msg: string }
  | { type: "force_msg_clear" }

function initState(): PageState {
  return {
    status: "loading",
    sessions: [],
    settings: {},
    settingsForm: {},
    settingsChanged: false,
    savingSettings: false,
    settingsMsg: null,
    settingsMsgType: "success",
    forcingOut: null,
    forceMsg: null,
    forceMsgType: "success",
  }
}

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, status: "loading" }
    case "fetch_ok":
      return {
        ...state,
        status: "ready",
        sessions: action.sessions,
        settings: action.settings,
        settingsForm: { ...action.settings },
        settingsChanged: false,
      }
    case "fetch_err":
      return { ...state, status: "error" }

    case "set_setting": {
      const form = { ...state.settingsForm, [action.key]: action.value }
      const changed = Object.entries(form).some(([k, v]) => v !== state.settings[k])
      return { ...state, settingsForm: form, settingsChanged: changed }
    }

    case "save_settings_start":
      return { ...state, savingSettings: true, settingsMsg: null }
    case "save_settings_ok":
      return {
        ...state,
        savingSettings: false,
        settingsMsg: "Settings saved",
        settingsMsgType: "success",
        settings: action.settings,
        settingsChanged: false,
      }
    case "save_settings_err":
      return { ...state, savingSettings: false, settingsMsg: action.msg, settingsMsgType: "error" }
    case "settings_msg_clear":
      return { ...state, settingsMsg: null }

    case "force_logout_start":
      return { ...state, forcingOut: action.target, forceMsg: null }
    case "force_logout_ok": {
      // Mark those sessions as force_logout in the list
      const updated = state.sessions.map((s) =>
        s.user_id === action.target || action.target === "all"
          ? { ...s, event_type: "force_logout" }
          : s,
      )
      return {
        ...state,
        forcingOut: null,
        forceMsg: action.target === "all" ? "All users have been signed out" : "User signed out",
        forceMsgType: "success",
        sessions: updated,
      }
    }
    case "force_logout_err":
      return { ...state, forcingOut: null, forceMsg: action.msg, forceMsgType: "error" }
    case "force_msg_clear":
      return { ...state, forceMsg: null }

    default:
      return state
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function formatUA(ua: string | null): string {
  if (!ua) return "Unknown"
  if (ua.includes("iPhone") || ua.includes("Android")) return "Mobile"
  if (ua.includes("Chrome")) return "Chrome"
  if (ua.includes("Firefox")) return "Firefox"
  if (ua.includes("Safari")) return "Safari"
  if (ua.includes("Edge")) return "Edge"
  return ua.slice(0, 32)
}

function EventBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    login:        { label: "Login",       cls: "bg-emerald-50 text-emerald-700", icon: <LogIn className="w-3 h-3" /> },
    logout:       { label: "Logout",      cls: "bg-gray-100 text-gray-600",      icon: <LogOut className="w-3 h-3" /> },
    force_logout: { label: "Force logout",cls: "bg-red-50 text-red-700",         icon: <ShieldAlert className="w-3 h-3" /> },
  }
  const cfg = map[type] ?? { label: type, cls: "bg-gray-100 text-gray-600", icon: null }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminSessionsPage() {
  const [state, dispatch] = useReducer(pageReducer, undefined, initState)

  const fetchData = useCallback(async () => {
    dispatch({ type: "fetch_start" })
    try {
      const res = await authenticatedFetch("/api/admin/sessions")
      const data = await res.json()
      if (data.ok) dispatch({ type: "fetch_ok", sessions: data.sessions, settings: data.settings })
      else dispatch({ type: "fetch_err" })
    } catch {
      dispatch({ type: "fetch_err" })
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  useEffect(() => {
    if (!state.settingsMsg) return
    const t = setTimeout(() => dispatch({ type: "settings_msg_clear" }), 3000)
    return () => clearTimeout(t)
  }, [state.settingsMsg])

  useEffect(() => {
    if (!state.forceMsg) return
    const t = setTimeout(() => dispatch({ type: "force_msg_clear" }), 3000)
    return () => clearTimeout(t)
  }, [state.forceMsg])

  const handleSaveSettings = async () => {
    dispatch({ type: "save_settings_start" })
    try {
      const res = await authenticatedFetch("/api/admin/sessions", {
        method: "PATCH",
        body: JSON.stringify({ action: "update_settings", settings: state.settingsForm }),
      })
      const data = await res.json()
      if (data.ok) dispatch({ type: "save_settings_ok", settings: state.settingsForm })
      else dispatch({ type: "save_settings_err", msg: data.error ?? "Save failed" })
    } catch (err) {
      dispatch({ type: "save_settings_err", msg: String(err) })
    }
  }

  const handleForceLogout = async (userId: string) => {
    if (!confirm("Force-sign out this user? They will need to log in again.")) return
    dispatch({ type: "force_logout_start", target: userId })
    try {
      const res = await authenticatedFetch("/api/admin/sessions", {
        method: "PATCH",
        body: JSON.stringify({ action: "force_logout", userId }),
      })
      const data = await res.json()
      if (data.ok) dispatch({ type: "force_logout_ok", target: userId })
      else dispatch({ type: "force_logout_err", msg: data.error ?? "Force logout failed" })
    } catch (err) {
      dispatch({ type: "force_logout_err", msg: String(err) })
    }
  }

  const handleForceLogoutAll = async () => {
    if (!confirm("Sign out ALL active users? This cannot be undone.")) return
    dispatch({ type: "force_logout_start", target: "all" })
    try {
      const res = await authenticatedFetch("/api/admin/sessions", {
        method: "PATCH",
        body: JSON.stringify({ action: "force_logout_all" }),
      })
      const data = await res.json()
      if (data.ok) dispatch({ type: "force_logout_ok", target: "all" })
      else dispatch({ type: "force_logout_err", msg: data.error ?? "Force logout failed" })
    } catch (err) {
      dispatch({ type: "force_logout_err", msg: String(err) })
    }
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading sessions…
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm">Failed to load sessions. <button onClick={fetchData} className="text-blue-600 underline">Retry</button></p>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Session Management</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor login activity and manage active sessions</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Session Policy ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Session Policy</h2>
            <p className="text-xs text-gray-500 mt-0.5">Configure global session timeout and security settings</p>
          </div>
          <div className="flex items-center gap-2">
            {state.settingsMsg && (
              <span
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                  state.settingsMsgType === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {state.settingsMsgType === "success"
                  ? <CheckCircle2 className="w-3 h-3" />
                  : <AlertCircle className="w-3 h-3" />}
                {state.settingsMsg}
              </span>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={state.savingSettings || !state.settingsChanged}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {state.savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Session Timeout
              <span className="ml-1 font-normal text-gray-400">(minutes)</span>
            </label>
            <input
              type="number"
              min="5"
              max="1440"
              value={state.settingsForm.session_timeout_minutes ?? "60"}
              onChange={(e) => dispatch({ type: "set_setting", key: "session_timeout_minutes", value: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">1–1440 minutes (1 day max)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Max Sessions Per User
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={state.settingsForm.max_sessions_per_user ?? "5"}
              onChange={(e) => dispatch({ type: "set_setting", key: "max_sessions_per_user", value: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Concurrent sessions allowed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Require 2FA for Admin
            </label>
            <select
              value={state.settingsForm.require_2fa_admin ?? "false"}
              onChange={(e) => dispatch({ type: "set_setting", key: "require_2fa_admin", value: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Enforces 2FA for admin accounts</p>
          </div>
        </div>
      </div>

      {/* ── Active Sessions ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recent Session Activity</h2>
            <p className="text-xs text-gray-500 mt-0.5">{state.sessions.length} events shown</p>
          </div>

          <div className="flex items-center gap-2">
            {state.forceMsg && (
              <span
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                  state.forceMsgType === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {state.forceMsgType === "success"
                  ? <CheckCircle2 className="w-3 h-3" />
                  : <AlertCircle className="w-3 h-3" />}
                {state.forceMsg}
              </span>
            )}
            <button
              onClick={handleForceLogoutAll}
              disabled={state.forcingOut !== null}
              className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              {state.forcingOut === "all"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ShieldAlert className="w-3.5 h-3.5" />}
              Sign Out All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Event</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">IP Address</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Browser</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    <Monitor className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No session events found
                  </td>
                </tr>
              ) : (
                state.sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs">{s.full_name || "—"}</div>
                      <div className="text-xs text-gray-500">{s.email ?? s.user_id ?? "unknown"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <EventBadge type={s.event_type} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {s.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatUA(s.user_agent)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.user_id && s.event_type === "login" && (
                        <button
                          onClick={() => handleForceLogout(s.user_id!)}
                          disabled={state.forcingOut !== null}
                          title="Force sign out"
                          className="flex items-center gap-1 ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-red-50"
                        >
                          {state.forcingOut === s.user_id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <LogOut className="w-3.5 h-3.5" />}
                          Sign out
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
