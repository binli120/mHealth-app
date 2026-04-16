"use client"

/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

import { useEffect, useReducer, useCallback } from "react"
import {
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  Loader2,
  Users,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import { toUserFacingError } from "@/lib/errors/user-facing"
import { PERMISSION_GROUPS } from "@/lib/constants/permissions"
import type { Permission } from "@/lib/constants/permissions"

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleRow = {
  name: string
  description: string | null
  color: string
  is_system: boolean
  user_count: number
  permissions: Permission[]
}

type PageState = {
  status: "loading" | "ready" | "error"
  roles: RoleRow[]
  selectedRole: string | null
  // Editing state for the right panel
  editPerms: Set<Permission>
  saving: boolean
  saveMsg: string | null
  saveMsgType: "success" | "error"
  deleting: boolean
  // New-role modal
  showNew: boolean
  newName: string
  newDesc: string
  newColor: string
  newError: string | null
  creating: boolean
}

type PageAction =
  | { type: "fetch_start" }
  | { type: "fetch_ok"; roles: RoleRow[] }
  | { type: "fetch_err" }
  | { type: "select_role"; name: string }
  | { type: "toggle_perm"; perm: Permission }
  | { type: "save_start" }
  | { type: "save_ok" }
  | { type: "save_err"; msg: string }
  | { type: "save_clear" }
  | { type: "delete_start" }
  | { type: "delete_ok"; roleName: string }
  | { type: "delete_err"; msg: string }
  | { type: "open_new" }
  | { type: "close_new" }
  | { type: "set_new_name"; value: string }
  | { type: "set_new_desc"; value: string }
  | { type: "set_new_color"; value: string }
  | { type: "create_start" }
  | { type: "create_ok"; role: RoleRow }
  | { type: "create_err"; msg: string }

function initState(): PageState {
  return {
    status: "loading",
    roles: [],
    selectedRole: null,
    editPerms: new Set(),
    saving: false,
    saveMsg: null,
    saveMsgType: "success",
    deleting: false,
    showNew: false,
    newName: "",
    newDesc: "",
    newColor: "#6b7280",
    newError: null,
    creating: false,
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
        roles: action.roles,
        selectedRole: state.selectedRole ?? (action.roles[0]?.name ?? null),
        editPerms: new Set(
          action.roles.find((r) => r.name === (state.selectedRole ?? action.roles[0]?.name))
            ?.permissions ?? [],
        ),
      }
    case "fetch_err":
      return { ...state, status: "error" }

    case "select_role": {
      const role = state.roles.find((r) => r.name === action.name)
      return {
        ...state,
        selectedRole: action.name,
        editPerms: new Set(role?.permissions ?? []),
        saveMsg: null,
      }
    }

    case "toggle_perm": {
      const next = new Set(state.editPerms)
      if (next.has(action.perm)) next.delete(action.perm)
      else next.add(action.perm)
      return { ...state, editPerms: next }
    }

    case "save_start":
      return { ...state, saving: true, saveMsg: null }
    case "save_ok": {
      const updated = state.roles.map((r) =>
        r.name === state.selectedRole
          ? { ...r, permissions: [...state.editPerms] as Permission[] }
          : r,
      )
      return { ...state, saving: false, saveMsg: "Permissions saved", saveMsgType: "success", roles: updated }
    }
    case "save_err":
      return { ...state, saving: false, saveMsg: action.msg, saveMsgType: "error" }
    case "save_clear":
      return { ...state, saveMsg: null }

    case "delete_start":
      return { ...state, deleting: true }
    case "delete_ok": {
      const remaining = state.roles.filter((r) => r.name !== action.roleName)
      return {
        ...state,
        deleting: false,
        roles: remaining,
        selectedRole: remaining[0]?.name ?? null,
        editPerms: new Set(remaining[0]?.permissions ?? []),
      }
    }
    case "delete_err":
      return { ...state, deleting: false, saveMsg: action.msg, saveMsgType: "error" }

    case "open_new":
      return { ...state, showNew: true, newName: "", newDesc: "", newColor: "#6b7280", newError: null }
    case "close_new":
      return { ...state, showNew: false }
    case "set_new_name":
      return { ...state, newName: action.value.toLowerCase().replace(/[^a-z_]/g, "") }
    case "set_new_desc":
      return { ...state, newDesc: action.value }
    case "set_new_color":
      return { ...state, newColor: action.value }
    case "create_start":
      return { ...state, creating: true, newError: null }
    case "create_ok":
      return {
        ...state,
        creating: false,
        showNew: false,
        roles: [...state.roles, action.role],
        selectedRole: action.role.name,
        editPerms: new Set(action.role.permissions),
      }
    case "create_err":
      return { ...state, creating: false, newError: action.msg }

    default:
      return state
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminRolesPage() {
  const [state, dispatch] = useReducer(pageReducer, undefined, initState)

  const fetchRoles = useCallback(async () => {
    dispatch({ type: "fetch_start" })
    try {
      const res = await authenticatedFetch("/api/admin/roles")
      const data = await res.json()
      if (data.ok) dispatch({ type: "fetch_ok", roles: data.roles })
      else dispatch({ type: "fetch_err" })
    } catch {
      dispatch({ type: "fetch_err" })
    }
  }, [])

  useEffect(() => { void fetchRoles() }, [fetchRoles])

  // Auto-clear save message after 3 s
  useEffect(() => {
    if (!state.saveMsg) return
    const t = setTimeout(() => dispatch({ type: "save_clear" }), 3000)
    return () => clearTimeout(t)
  }, [state.saveMsg])

  const handleSave = async () => {
    if (!state.selectedRole) return
    dispatch({ type: "save_start" })
    try {
      const res = await authenticatedFetch("/api/admin/roles", {
        method: "PATCH",
        body: JSON.stringify({
          action: "update_permissions",
          roleName: state.selectedRole,
          permissions: [...state.editPerms],
        }),
      })
      const data = await res.json()
      if (data.ok) dispatch({ type: "save_ok" })
      else dispatch({ type: "save_err", msg: toUserFacingError(data.error, "Save failed.") })
    } catch (err) {
      dispatch({ type: "save_err", msg: toUserFacingError(err, "Save failed.") })
    }
  }

  const handleDelete = async () => {
    if (!state.selectedRole) return
    if (!confirm(`Delete role "${state.selectedRole}"? This cannot be undone.`)) return
    dispatch({ type: "delete_start" })
    try {
      const res = await authenticatedFetch("/api/admin/roles", {
        method: "PATCH",
        body: JSON.stringify({ action: "delete", roleName: state.selectedRole }),
      })
      const data = await res.json()
      if (data.ok) dispatch({ type: "delete_ok", roleName: state.selectedRole! })
      else dispatch({ type: "delete_err", msg: toUserFacingError(data.error, "Delete failed.") })
    } catch (err) {
      dispatch({ type: "delete_err", msg: toUserFacingError(err, "Delete failed.") })
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.newName.trim()) return
    dispatch({ type: "create_start" })
    try {
      const res = await authenticatedFetch("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          name: state.newName.trim(),
          description: state.newDesc.trim(),
          color: state.newColor,
          permissions: [],
        }),
      })
      const data = await res.json()
      if (data.ok) {
        dispatch({
          type: "create_ok",
          role: {
            name: state.newName.trim(),
            description: state.newDesc.trim() || null,
            color: state.newColor,
            is_system: false,
            user_count: 0,
            permissions: [],
          },
        })
      } else {
        dispatch({ type: "create_err", msg: toUserFacingError(data.error, "Create failed.") })
      }
    } catch (err) {
      dispatch({ type: "create_err", msg: toUserFacingError(err, "Create failed.") })
    }
  }

  const selectedRoleRow = state.roles.find((r) => r.name === state.selectedRole)

  // ── Loading / error states ────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading roles…
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm">Failed to load roles. <button onClick={fetchRoles} className="text-blue-600 underline">Retry</button></p>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role & Permission Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Define what each role can access across the platform</p>
        </div>
        <button
          onClick={() => dispatch({ type: "open_new" })}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </div>

      <div className="flex gap-5">
        {/* ── Left sidebar: role list ──────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 space-y-1">
          {state.roles.map((role) => (
            <button
              key={role.name}
              onClick={() => dispatch({ type: "select_role", name: role.name })}
              className={`
                w-full text-left px-3 py-3 rounded-xl border transition-all
                ${state.selectedRole === role.name
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-transparent hover:bg-gray-50"
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: role.color }}
                />
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {role.name.replace(/_/g, " ")}
                </span>
                {role.is_system && (
                  <span className="ml-auto text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
                    system
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 pl-4">
                <Users className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">{role.user_count} users</span>
                <span className="ml-auto text-xs text-gray-400">{role.permissions.length} perms</span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Right panel: permission matrix ──────────────────────────────── */}
        {selectedRoleRow ? (
          <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedRoleRow.color }}
                />
                <div>
                  <h2 className="text-base font-semibold text-gray-900 capitalize">
                    {selectedRoleRow.name.replace(/_/g, " ")}
                  </h2>
                  {selectedRoleRow.description && (
                    <p className="text-xs text-gray-500">{selectedRoleRow.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {state.saveMsg && (
                  <span
                    className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      state.saveMsgType === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {state.saveMsgType === "success"
                      ? <CheckCircle2 className="w-3 h-3" />
                      : <AlertCircle className="w-3 h-3" />}
                    {state.saveMsg}
                  </span>
                )}

                {!selectedRoleRow.is_system && (
                  <button
                    onClick={handleDelete}
                    disabled={state.deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
                  >
                    {state.deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </button>
                )}

                <button
                  onClick={handleSave}
                  disabled={state.saving || selectedRoleRow.is_system && selectedRoleRow.name === "admin"}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {state.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </div>

            {/* Permission matrix */}
            <div className="p-6 space-y-6">
              {selectedRoleRow.name === "admin" && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  Admin has all permissions and they cannot be modified.
                </div>
              )}

              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {group.label}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.permissions.map(({ key, label, description }) => {
                      const checked = state.editPerms.has(key)
                      const locked = selectedRoleRow.name === "admin"
                      return (
                        <label
                          key={key}
                          className={`
                            flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                            ${checked ? "border-blue-200 bg-blue-50" : "border-gray-100 hover:bg-gray-50"}
                            ${locked ? "opacity-60 cursor-not-allowed" : ""}
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => dispatch({ type: "toggle_perm", perm: key })}
                            className="mt-0.5 w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800">{label}</div>
                            <div className="text-xs text-gray-500 leading-snug">{description}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a role to manage its permissions
          </div>
        )}
      </div>

      {/* ── New Role Modal ─────────────────────────────────────────────────── */}
      {state.showNew && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">New Role</h2>
              </div>
              <button onClick={() => dispatch({ type: "close_new" })} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={state.newName}
                  onChange={(e) => dispatch({ type: "set_new_name", value: e.target.value })}
                  placeholder="e.g. billing_staff"
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Lowercase letters and underscores only</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={state.newDesc}
                  onChange={(e) => dispatch({ type: "set_new_desc", value: e.target.value })}
                  placeholder="Short description…"
                  maxLength={200}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={state.newColor}
                    onChange={(e) => dispatch({ type: "set_new_color", value: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-200"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {["#dc2626","#f59e0b","#16a34a","#2563eb","#7c3aed","#8b5cf6","#64748b","#0891b2"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => dispatch({ type: "set_new_color", value: c })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${state.newColor === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {state.newError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {state.newError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "close_new" })}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={state.creating || !state.newName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {state.creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
