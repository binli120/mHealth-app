/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * Patient-side panel: search for social workers and send engagement requests.
 */

"use client"

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react"
import {
  Building2,
  Clock,
  Loader2,
  Search,
  SendHorizontal,
  UserCheck,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authenticatedFetch } from "@/lib/supabase/authenticated-fetch"

// ── Types ────────────────────────────────────────────────────────────────────

interface SwResult {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company_name: string
}

interface EngagementRequest {
  id: string
  swUserId: string
  status: "pending" | "accepted" | "rejected" | "cancelled"
  swName: string | null
  swEmail: string
  companyName: string
  createdAt: string
}

interface SwFinderPanelProps {
  /** Called when an accepted SW is clicked so the chat panel can open */
  onOpenChat: (swUserId: string, swName: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function swDisplayName(sw: SwResult | null | undefined, fallback?: string): string {
  if (!sw) return fallback ?? "Social Worker"
  const name = [sw.first_name, sw.last_name].filter(Boolean).join(" ")
  return name || sw.email
}

function StatusBadge() {
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SwFinderPanel({ onOpenChat }: SwFinderPanelProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SwResult[]>([])
  const [searching, setSearching] = useState(false)
  const [requests, setRequests] = useState<EngagementRequest[]>([])
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [selectedSw, setSelectedSw] = useState<SwResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load existing requests on mount ────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const res = await authenticatedFetch("/api/patient/sw-request")
        const data = await res.json()
        if (data.ok) setRequests(data.requests ?? [])
      } catch {
        // non-critical
      }
    })()
  }, [])

  // ── Search with debounce ───────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    setSearching(true)
    try {
      const res = await authenticatedFetch(
        `/api/social-worker/search?q=${encodeURIComponent(q)}`,
      )
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void doSearch(value), 350)
  }

  // ── Send request ───────────────────────────────────────────────────────────

  const handleSendRequest = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedSw) return
    setRequestingId(selectedSw.user_id)
    try {
      const res = await authenticatedFetch("/api/patient/sw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swUserId: selectedSw.user_id, message: message || undefined }),
      })
      const data = await res.json()
      if (data.ok) {
        setRequests((prev) => [data.request, ...prev])
        setSelectedSw(null)
        setMessage("")
      }
    } finally {
      setRequestingId(null)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const requestedSwIds = new Set(
    requests.filter((r) => r.status === "pending" || r.status === "accepted").map((r) => r.swUserId),
  )
  const acceptedSws = requests.filter((r) => r.status === "accepted")

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">

      {/* My Social Workers ─────────────────────────────────────────────────── */}
      {acceptedSws.length > 0 && (
        <div className="border-b px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            My Social Workers
          </p>
          <div className="space-y-1.5">
            {acceptedSws.map((req) => (
              <button
                key={req.id}
                type="button"
                onClick={() => onOpenChat(req.swUserId, req.swName ?? req.swEmail)}
                className="flex w-full items-center gap-3 rounded-lg border bg-green-50 px-3 py-2 text-left text-sm transition-colors hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50"
              >
                <UserCheck className="h-4 w-4 shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{req.swName ?? req.swEmail}</p>
                  <p className="truncate text-xs text-muted-foreground">{req.companyName}</p>
                </div>
                <span className="shrink-0 text-xs text-green-600 font-medium">Chat →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending requests ─────────────────────────────────────────────────── */}
      {requests.filter((r) => r.status === "pending").length > 0 && (
        <div className="border-b px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pending Requests
          </p>
          <div className="space-y-1.5">
            {requests
              .filter((r) => r.status === "pending")
              .map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{req.swName ?? req.swEmail}</p>
                    <p className="truncate text-xs text-muted-foreground">{req.companyName}</p>
                  </div>
                  <StatusBadge />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Request compose modal ───────────────────────────────────────────── */}
      {selectedSw && (
        <div className="border-b bg-muted/30 px-4 py-3">
          <p className="mb-2 text-sm font-medium">
            Send request to{" "}
            <span className="text-primary">{swDisplayName(selectedSw)}</span>
          </p>
          <form onSubmit={(e) => void handleSendRequest(e)} className="space-y-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional: introduce yourself or describe your situation…"
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={requestingId === selectedSw.user_id}
                className="gap-1"
              >
                {requestingId === selectedSw.user_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SendHorizontal className="h-3.5 w-3.5" />
                )}
                Send Request
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedSw(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search ───────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by name or organization…"
            className="pr-9 text-sm"
          />
          <button
            type="button"
            onClick={() => void doSearch(query)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results — only shown when user has typed a search string ─────────── */}
      {query.trim().length > 0 && (
        <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
          {searching ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No social workers found
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {results.map((sw) => {
                const name = swDisplayName(sw)
                const alreadyRequested = requestedSwIds.has(sw.user_id)
                const reqForSw = requests.find((r) => r.swUserId === sw.user_id)
                const isPending = reqForSw?.status === "pending"

                return (
                  <div
                    key={sw.user_id}
                    className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        {sw.company_name}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isPending ? (
                        <StatusBadge />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={alreadyRequested}
                          onClick={() => {
                            setSelectedSw(sw)
                            setMessage("")
                          }}
                        >
                          Request
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  )
}
