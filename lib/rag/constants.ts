/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

/**
 * Shared constants for the RAG module and Ollama integration.
 */

import type { DocumentSource } from './types';

// ── Ollama connection ─────────────────────────────────────────────────────────

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export const OLLAMA_EMBED_ENDPOINT = '/api/embeddings';
export const OLLAMA_CHAT_ENDPOINT = '/api/chat';

// ── Embedding model ───────────────────────────────────────────────────────────

/** Local Ollama model for text embeddings (768-dim). Run: ollama pull nomic-embed-text */
export const EMBED_MODEL = 'nomic-embed-text';
export const EMBED_TIMEOUT_MS = 30_000;
export const EMBED_BATCH_DELAY_MS = 50; // delay between sequential embedding calls

// ── Chunking ──────────────────────────────────────────────────────────────────

export const CHUNK_MAX_CHARS = 1_800;
export const CHUNK_OVERLAP_CHARS = 150;
export const CHUNK_MIN_LENGTH = 20; // filter out trivially short chunks

// ── Retrieval ─────────────────────────────────────────────────────────────────

export const RAG_DEFAULT_TOP_K = 4;
export const RAG_ADVISOR_TOP_K = 3;
export const RAG_CHUNK_CONTENT_MAX_LEN = 600; // truncate chunk content in prompts

// ── Document types ────────────────────────────────────────────────────────────

export const DOC_TYPES = [
  'member_booklet',
  'eligibility_guide',
  'verifications',
  'transmittal',
  'faq',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

// ── Policy sources ────────────────────────────────────────────────────────────

/**
 * Priority MassHealth policy documents for ingestion.
 * Note: mass.gov blocks server-side fetches (403). Download locally and use
 * the --file flag with scripts/ingest-rag.mjs for real ingestion.
 */
export const POLICY_SOURCES: DocumentSource[] = [
  {
    title: 'MassHealth Member Booklet',
    url: 'https://www.mass.gov/doc/member-booklet-for-health-and-dental-coverage-and-help-paying-costs-0/download?_ga=2.50048230.1585514286.1773275392-1893338343.1772504034&_gl=1*13hd3ez*_ga*MTg5MzMzODM0My4xNzcyNTA0MDM0*_ga_MCLPEGW7WM*czE3NzMzMjEwMjIkb',
    doc_type: 'member_booklet',
    language: 'en',
  },
  {
    title: 'MassHealth and Health Connector Acceptable Verifications List',
    url: 'https://www.mass.gov/doc/masshealth-and-health-connector-acceptable-verifications-list-0/download',
    doc_type: 'verifications',
    language: 'en',
  },
  {
    title: 'MassHealth Eligibility — People 65 and Younger',
    url: 'https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-65-and-younger',
    doc_type: 'eligibility_guide',
    language: 'en',
  },
  {
    title: 'MassHealth Eligibility — People 65 and Older',
    url: 'https://www.mass.gov/info-details/learn-if-you-are-eligible-for-a-masshealth-program-for-people-aged-65-and-older-and-people-with-certain-disabilities',
    doc_type: 'eligibility_guide',
    language: 'en',
  },
];
