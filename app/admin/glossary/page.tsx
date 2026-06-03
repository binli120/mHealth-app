"use client"

/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Admin glossary management page.
 */

import { useEffect, useState, useCallback } from "react"
import { Search, Plus, Pencil, Trash2, Loader2, X, BookOpen } from "lucide-react"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"
import {
  AdminPageHeader,
  AdminPageShell,
  AdminTablePanel,
  AdminToolbar,
} from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import type { GlossaryTerm, GlossaryCategory } from "@/lib/glossary/types"

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: GlossaryCategory | ""; label: string }[] = [
  { value: "", label: "All Categories" },
  { value: "program", label: "Program" },
  { value: "insurance", label: "Insurance" },
  { value: "aca", label: "ACA" },
  { value: "medical", label: "Medical" },
]

const LANG_BADGES: { key: keyof GlossaryTerm; label: string }[] = [
  { key: "definition_es",    label: "ES" },
  { key: "definition_zh_cn", label: "ZH" },
  { key: "definition_ht",    label: "HT" },
  { key: "definition_pt_br", label: "PT" },
  { key: "definition_vi",    label: "VI" },
]

const EMPTY_FORM: TermForm = {
  slug: "",
  term_en: "",
  definition_en: "",
  definition_es: "",
  definition_zh_cn: "",
  definition_ht: "",
  definition_pt_br: "",
  definition_vi: "",
  category: "program",
  aliases: "",
  related_slugs: "",
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TermForm {
  slug: string
  term_en: string
  definition_en: string
  definition_es: string
  definition_zh_cn: string
  definition_ht: string
  definition_pt_br: string
  definition_vi: string
  category: GlossaryCategory
  aliases: string        // comma-separated
  related_slugs: string  // comma-separated
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminGlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<GlossaryCategory | "">("")

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null) // null = new
  const [form, setForm] = useState<TermForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirm
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchTerms = useCallback(() => {
    authenticatedFetch("/api/admin/glossary")
      .then((res) => res.json())
      .then((data: { terms?: GlossaryTerm[] }) => {
        if (data.terms) setTerms(data.terms)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchTerms() }, [fetchTerms])

  // ── Filtered list ────────────────────────────────────────────────────────

  const filtered = terms.filter((t) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      t.term_en.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q)
    const matchCat = !categoryFilter || t.category === categoryFilter
    return matchSearch && matchCat
  })

  // ── Dialog helpers ───────────────────────────────────────────────────────

  const openNew = () => {
    setEditingSlug(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (term: GlossaryTerm) => {
    setEditingSlug(term.slug)
    setForm({
      slug: term.slug,
      term_en: term.term_en,
      definition_en: term.definition_en,
      definition_es: term.definition_es ?? "",
      definition_zh_cn: term.definition_zh_cn ?? "",
      definition_ht: term.definition_ht ?? "",
      definition_pt_br: term.definition_pt_br ?? "",
      definition_vi: term.definition_vi ?? "",
      category: term.category,
      aliases: term.aliases.join(", "),
      related_slugs: term.related_slugs.join(", "),
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setFormError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const body = {
        ...form,
        aliases: form.aliases.split(",").map((s) => s.trim()).filter(Boolean),
        related_slugs: form.related_slugs.split(",").map((s) => s.trim()).filter(Boolean),
      }
      const isNew = editingSlug === null
      const res = await authenticatedFetch(
        isNew ? "/api/admin/glossary" : `/api/admin/glossary/${editingSlug}`,
        {
          method: isNew ? "POST" : "PATCH",
          body: JSON.stringify(body),
        },
      )
      const data = await res.json() as { term?: unknown; error?: string }
      if (res.ok) {
        closeDialog()
        void fetchTerms()
      } else {
        setFormError(data.error ?? "Failed to save term.")
      }
    } catch {
      setFormError("An unexpected error occurred.")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteSlug) return
    setDeleting(true)
    try {
      const res = await authenticatedFetch(`/api/admin/glossary/${deleteSlug}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteSlug(null)
        void fetchTerms()
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminPageShell size="wide">
      <AdminPageHeader
        title="Glossary"
        description={`${filtered.length} term${filtered.length !== 1 ? "s" : ""}${categoryFilter || search ? " (filtered)" : ""}`}
        action={
          <Button onClick={openNew}>
            <Plus className="size-4" />
            Add Term
          </Button>
        }
      />

      {/* Filters */}
      <AdminToolbar>
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by term or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as GlossaryCategory | "")}
          className="h-9 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(search || categoryFilter) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearch(""); setCategoryFilter("") }}
          >
            <X className="size-3" /> Clear
          </Button>
        )}
      </AdminToolbar>

      {/* Table */}
      <AdminTablePanel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Term</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Translations</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <BookOpen className="mx-auto mb-2 size-8 opacity-30" />
                    No terms found
                  </td>
                </tr>
              ) : (
                filtered.map((term) => (
                  <tr key={term.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{term.term_en}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{term.slug}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                        {term.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {LANG_BADGES.map(({ key, label }) => {
                          const has = Boolean(term[key])
                          return (
                            <span
                              key={label}
                              title={has ? `${label} translation present` : `${label} missing`}
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                has
                                  ? "bg-success/15 text-success"
                                  : "border border-dashed border-muted-foreground/30 text-muted-foreground/50"
                              }`}
                            >
                              {label}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(term)}
                          title="Edit"
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => setDeleteSlug(term.slug)}
                          title="Delete"
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminTablePanel>

      {/* ── Edit / Add Dialog ──────────────────────────────────────────────── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {editingSlug ? "Edit Term" : "Add Term"}
              </h2>
              <button
                onClick={closeDialog}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={(e) => void handleSave(e)} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {/* Slug + Term EN */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Slug <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                      required
                      disabled={editingSlug !== null}
                      placeholder="e.g. copay"
                      className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Term (EN) <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.term_en}
                      onChange={(e) => setForm((f) => ({ ...f, term_en: e.target.value }))}
                      required
                      placeholder="e.g. Copay"
                      className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as GlossaryCategory }))}
                    className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORY_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Definition EN */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Definition (EN) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.definition_en}
                    onChange={(e) => setForm((f) => ({ ...f, definition_en: e.target.value }))}
                    required
                    rows={3}
                    placeholder="English definition..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Definition ES */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Definition (ES)</label>
                  <textarea
                    value={form.definition_es}
                    onChange={(e) => setForm((f) => ({ ...f, definition_es: e.target.value }))}
                    rows={3}
                    placeholder="Spanish definition..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Other translations in a 2-col grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {(
                    [
                      { key: "definition_zh_cn", label: "Definition (ZH-CN)" },
                      { key: "definition_ht",    label: "Definition (HT)" },
                      { key: "definition_pt_br", label: "Definition (PT-BR)" },
                      { key: "definition_vi",    label: "Definition (VI)" },
                    ] as { key: keyof TermForm; label: string }[]
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
                      <textarea
                        value={form[key] as string}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>

                {/* Aliases + related slugs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Aliases <span className="text-xs text-gray-400">(comma-separated)</span>
                    </label>
                    <input
                      value={form.aliases}
                      onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
                      placeholder="e.g. co-pay, copayment"
                      className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Related Slugs <span className="text-xs text-gray-400">(comma-separated)</span>
                    </label>
                    <input
                      value={form.related_slugs}
                      onChange={(e) => setForm((f) => ({ ...f, related_slugs: e.target.value }))}
                      placeholder="e.g. deductible, premium"
                      className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {formError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {formError}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 gap-2 border-t px-6 pb-5 pt-4">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving ? "Saving…" : editingSlug ? "Save Changes" : "Add Term"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      {deleteSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="px-6 py-5">
              <h2 className="mb-1 text-base font-semibold text-gray-900">Delete Term</h2>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete{" "}
                <span className="font-mono font-medium text-gray-700">{deleteSlug}</span>? This
                action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 border-t px-6 pb-5 pt-4">
              <button
                onClick={() => setDeleteSlug(null)}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
