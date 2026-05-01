/**
 * Unit tests for app/api/auth/passkey/register/options/route.ts
 * @author Bin Lee
 * @email blee@healthcompass.cloud
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/auth/admin-passkeys', () => ({
  getUserEmail: vi.fn(),
  listAdminPasskeysForUser: vi.fn(),
}));

vi.mock('@/lib/auth/passkey-webauthn', () => ({
  ADMIN_PASSKEY_REGISTER_CHALLENGE_COOKIE: 'hc-admin-passkey-register',
  getWebAuthnRp: vi.fn(),
  setPasskeyChallengeCookie: vi.fn(),
}));

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
}));

vi.mock('@/lib/server/logger', () => ({
  logServerError: vi.fn(),
}));

import { POST } from '@/app/api/auth/passkey/register/options/route';
import {
  getUserEmail,
  listAdminPasskeysForUser,
} from '@/lib/auth/admin-passkeys';
import {
  getWebAuthnRp,
  setPasskeyChallengeCookie,
} from '@/lib/auth/passkey-webauthn';
import { requireAdmin } from '@/lib/auth/require-admin';
import { generateRegistrationOptions } from '@simplewebauthn/server';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockGetUserEmail = vi.mocked(getUserEmail);
const mockListPasskeys = vi.mocked(listAdminPasskeysForUser);
const mockGetRp = vi.mocked(getWebAuthnRp);
const mockSetChallengeCookie = vi.mocked(setPasskeyChallengeCookie);
const mockGenerateOptions = vi.mocked(generateRegistrationOptions);

const USER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

function makeRequest() {
  return new Request('http://localhost/api/auth/passkey/register/options', {
    method: 'POST',
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mockRequireAdmin.mockResolvedValue({ ok: true, userId: USER_ID });
  mockGetUserEmail.mockResolvedValue('admin@test.com');
  mockListPasskeys.mockResolvedValue([]);
  mockGetRp.mockReturnValue({
    rpName: 'Test',
    rpID: 'localhost',
    origin: 'http://localhost',
  });
  mockGenerateOptions.mockResolvedValue({
    challenge: 'test-challenge',
    rp: { name: 'Test', id: 'localhost' },
    user: { id: '', name: 'admin@test.com', displayName: 'admin@test.com' },
    pubKeyCredParams: [],
    timeout: 60000,
    excludeCredentials: [],
    attestation: 'none',
  } as never);
});

// ── requireAdmin guard ────────────────────────────────────────────────────────

describe('POST /api/auth/passkey/register/options — auth guard', () => {
  it('propagates non-ok requireAdmin response', async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({ ok: false, error: 'Forbidden' }),
      { status: 403 },
    );
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: forbiddenResponse as never,
    });

    const response = await POST(makeRequest());
    expect(response.status).toBe(403);
    expect(mockGetUserEmail).not.toHaveBeenCalled();
  });
});

// ── getUserEmail guard ────────────────────────────────────────────────────────

describe('POST /api/auth/passkey/register/options — user profile guard', () => {
  it('returns 404 when getUserEmail returns null', async () => {
    mockGetUserEmail.mockResolvedValue(null);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });
});

// ── Success ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/passkey/register/options — success', () => {
  it('returns 200 with ok:true and options', async () => {
    const response = await POST(makeRequest());
    const body = (await response.json()) as { ok: boolean; options: unknown };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.options).toBeDefined();
  });

  it('calls setPasskeyChallengeCookie with challenge and userId', async () => {
    await POST(makeRequest());
    expect(mockSetChallengeCookie).toHaveBeenCalledOnce();
    const [, , state] = mockSetChallengeCookie.mock.calls[0] as [
      unknown,
      unknown,
      { challenge: string; userId: string },
    ];
    expect(state.challenge).toBe('test-challenge');
    expect(state.userId).toBe(USER_ID);
  });

  it('calls generateRegistrationOptions with rpName and rpID', async () => {
    await POST(makeRequest());
    expect(mockGenerateOptions).toHaveBeenCalledOnce();
    const [opts] = mockGenerateOptions.mock.calls[0] as [
      { rpName: string; rpID: string },
    ];
    expect(opts.rpName).toBe('Test');
    expect(opts.rpID).toBe('localhost');
  });
});
