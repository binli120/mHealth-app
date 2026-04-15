/**
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 *
 * In-process LRU TTL cache for query embeddings.
 *
 * Embedding the same query string through Ollama on every request wastes
 * 30-80ms and CPU that could be avoided — policy queries are highly repetitive
 * (e.g. "CarePlus income limits", "citizenship documentation requirements").
 *
 * Lifecycle:
 *   - TTL: 5 minutes (configurable via RAG_EMBED_CACHE_TTL_MS).
 *   - Max entries: 200 (configurable via RAG_EMBED_CACHE_MAX).
 *   - Eviction: expired entries first, then oldest insertion if still over cap.
 *   - Thread-safety: single-threaded Node.js — no lock needed.
 *
 * Cache stays inside the Fluid Compute function instance (module-level Map).
 * Cold starts begin with an empty cache; it warms quickly within a live instance.
 */

import "server-only"

// ── Config ─────────────────────────────────────────────────────────────────────

const TTL_MS  = parseInt(process.env.RAG_EMBED_CACHE_TTL_MS ?? String(5 * 60 * 1000), 10)
const MAX_CAP = parseInt(process.env.RAG_EMBED_CACHE_MAX    ?? "200",                  10)

// ── Storage ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  embedding: number[]
  expiresAt: number
}

/** Insertion-ordered map — iteration order == eviction order for LRU-lite. */
const store = new Map<string, CacheEntry>()

// ── Internal helpers ───────────────────────────────────────────────────────────

function pruneExpired(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key)
  }
}

function evictOne(): void {
  const firstKey = store.keys().next().value
  if (firstKey !== undefined) store.delete(firstKey)
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return the cached embedding for `text`, or `null` on a cache miss / expiry.
 */
export function getCachedEmbedding(text: string): number[] | null {
  const entry = store.get(text)
  if (!entry) return null

  if (entry.expiresAt < Date.now()) {
    store.delete(text)
    return null
  }

  return entry.embedding
}

/**
 * Store an embedding in the cache, evicting expired and oldest entries as needed.
 */
export function setCachedEmbedding(text: string, embedding: number[]): void {
  if (store.size >= MAX_CAP) {
    pruneExpired()
    // Still over cap after pruning expired entries — evict oldest insertion.
    if (store.size >= MAX_CAP) evictOne()
  }

  store.set(text, { embedding, expiresAt: Date.now() + TTL_MS })
}

/** Exposed for tests and health-check endpoints. */
export function getEmbedCacheStats(): { size: number; maxCap: number; ttlMs: number } {
  return { size: store.size, maxCap: MAX_CAP, ttlMs: TTL_MS }
}
