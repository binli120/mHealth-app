/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import 'server-only';

// ---------------------------------------------------------------------------
// Supabase Storage — SDK-backed client
//
// We use the @supabase/supabase-js admin client for all storage operations.
// This handles both JWT-format and sb_secret_* opaque service-role keys,
// which the raw Storage REST API cannot accept in its Authorization header.
//
// Bucket layout (single "masshealth-dev" bucket):
//   {userId}/avatar/avatar.{ext}                          ← profile picture
//   {userId}/{applicationId}/{documentId}/{fileName}      ← application docs
//   phi-drafts/{applicationId}/{resumeId}.enc             ← encrypted PHI drafts
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET = 'masshealth-dev';

/** @deprecated Use STORAGE_BUCKET */
export const DOCUMENTS_BUCKET = STORAGE_BUCKET;

const DEFAULT_SIGNED_URL_EXPIRES = 60 * 60; // 1 hour
const SIGNED_URL_CACHE_SKEW_MS = 5_000;

type SignedUrlCacheEntry = {
  url: string;
  expiresAt: number;
};

type GlobalWithCache = typeof globalThis & {
  __mhealthSignedUrlCache?: Map<string, SignedUrlCacheEntry>;
  __mhealthStorageAdminClient?: SupabaseClient;
};

const g = globalThis as GlobalWithCache;

// ---------------------------------------------------------------------------
// Admin client — cached per process
// ---------------------------------------------------------------------------

function getStorageAdminClient(): SupabaseClient {
  if (g.__mhealthStorageAdminClient) return g.__mhealthStorageAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  g.__mhealthStorageAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return g.__mhealthStorageAdminClient;
}

function getSignedUrlCache(): Map<string, SignedUrlCacheEntry> {
  if (!g.__mhealthSignedUrlCache) {
    g.__mhealthSignedUrlCache = new Map();
  }
  return g.__mhealthSignedUrlCache;
}

function getSignedUrlCacheKey(storagePath: string, expiresInSeconds: number): string {
  return `${storagePath}:${expiresInSeconds}`;
}

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

/**
 * Documents path: {userId}/{applicationId}/{documentId}/{sanitizedFileName}
 */
export function buildStoragePath(
  userId: string,
  applicationId: string,
  documentId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${applicationId}/${documentId}/${safe}`;
}

function buildSiblingPath(storagePath: string, suffix: string): string {
  const lastSlashIndex = storagePath.lastIndexOf('/');
  const fileName = lastSlashIndex < 0 ? storagePath : storagePath.slice(lastSlashIndex + 1);
  const siblingName = `${fileName}${suffix}`;
  if (lastSlashIndex < 0) return siblingName;

  return `${storagePath.slice(0, lastSlashIndex)}/${siblingName}`;
}

export function buildThumbnailStoragePath(storagePath: string): string {
  return buildSiblingPath(storagePath, '.thumb.webp');
}

export function buildPdfStoragePath(storagePath: string): string {
  return buildSiblingPath(storagePath, '.pdf');
}

/**
 * Avatar path: {userId}/avatar/avatar.{ext}
 * Fixed name → upsert always replaces the previous avatar at the same path.
 */
export function buildAvatarStoragePath(userId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '');
  return `${userId}/avatar/avatar.${safeExt}`;
}

// ---------------------------------------------------------------------------
// Storage operations — Supabase JS SDK
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to the bucket.
 * Use upsert:true for avatars (overwrite) and upsert:false for documents (no silent overwrites).
 */
export async function uploadToStorage(params: {
  accessToken?: string;
  fileBuffer: Buffer;
  mimeType: string;
  storagePath: string;
  upsert?: boolean;
}): Promise<{ path: string }> {
  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(params.storagePath, params.fileBuffer, {
      contentType: params.mimeType,
      upsert: params.upsert ?? false,
    });

  if (error) throw new Error(`Storage upload failed: ${JSON.stringify(error)}`);
  return { path: data.path };
}

/** @deprecated Use uploadToStorage */
export const uploadDocumentToStorage = (params: {
  accessToken?: string;
  fileBuffer: Buffer;
  mimeType: string;
  storagePath: string;
}) => uploadToStorage(params);

/**
 * Delete one or more objects from the bucket.
 */
export async function deleteFromStorage(params: {
  accessToken?: string;
  storagePaths: string[];
}): Promise<void> {
  if (params.storagePaths.length === 0) return;
  const supabase = getStorageAdminClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove(params.storagePaths);
  if (error) throw new Error(`Storage delete failed: ${JSON.stringify(error)}`);
}

/** @deprecated Use deleteFromStorage */
export const deleteDocumentFromStorage = (params: {
  accessToken?: string;
  storagePath: string;
}) => deleteFromStorage({ ...params, storagePaths: [params.storagePath] });

/**
 * List all objects inside a folder prefix.
 * Returns the full storage paths (ready to pass to deleteFromStorage).
 */
export async function listStorageFolder(params: {
  accessToken?: string;
  folderPath: string;
  limit?: number;
}): Promise<string[]> {
  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(params.folderPath, { limit: params.limit ?? 100 });
  if (error) throw new Error(`Storage list failed: ${JSON.stringify(error)}`);
  return (data ?? []).map((f) => `${params.folderPath}/${f.name}`);
}

/**
 * Create a time-limited signed URL so the browser can download a private file.
 * Default TTL: 1 hour.
 */
export async function getSignedDocumentUrl(params: {
  accessToken?: string;
  storagePath: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const expiresIn = params.expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRES;
  const cacheKey = getSignedUrlCacheKey(params.storagePath, expiresIn);
  const cache = getSignedUrlCache();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(params.storagePath, expiresIn);
  if (error) throw new Error(`Failed to create signed URL: ${JSON.stringify(error)}`);

  cache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + expiresIn * 1000 - SIGNED_URL_CACHE_SKEW_MS,
  });
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// PHI draft blob storage — encrypted blobs in phi-drafts/ prefix
// ---------------------------------------------------------------------------

/**
 * Path for an encrypted PHI draft blob.
 * Format: phi-drafts/{applicationId}/{resumeId}.enc
 * The resumeId is stored in the DB; the AES key is held only by the applicant.
 */
export function buildPhiDraftStoragePath(
  applicationId: string,
  resumeId: string,
): string {
  return `phi-drafts/${applicationId}/${resumeId}.enc`;
}

/**
 * Download a raw blob from the bucket and return it as a Buffer.
 * Used to proxy encrypted PHI draft blobs back to the authenticated client.
 */
export async function downloadBlobFromStorage(params: {
  accessToken?: string;
  storagePath: string;
}): Promise<Buffer> {
  const supabase = getStorageAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(params.storagePath);
  if (error) throw new Error(`Storage download failed: ${JSON.stringify(error)}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function getSignedDocumentUrls(params: {
  accessToken?: string;
  storagePaths: string[];
  expiresInSeconds?: number;
}): Promise<Record<string, string | null>> {
  const uniquePaths = [...new Set(params.storagePaths.filter(Boolean))];
  const entries = await Promise.all(
    uniquePaths.map(async (storagePath) => {
      try {
        const signedUrl = await getSignedDocumentUrl({
          accessToken: params.accessToken,
          storagePath,
          expiresInSeconds: params.expiresInSeconds,
        });
        return [storagePath, signedUrl] as const;
      } catch {
        return [storagePath, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}
