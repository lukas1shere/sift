import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { generateApiKey, hashApiKey } from '@/lib/keys';
import { getPeriodStart, getPeriodEnd } from '@/lib/usage';

// ── Mock Supabase so we never hit a real DB ───────────────────────────────────
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  then: vi.fn().mockResolvedValue(undefined),
  rpc: vi.fn().mockResolvedValue({ error: null }),
  auth: { getUser: vi.fn() },
};

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseAdmin: () => mockSupabase,
  getUserFromToken: vi.fn(),
}));

// Stub getUserTier so checkQuota doesn't consume an extra Supabase single() call
vi.mock('@/lib/stripe', () => ({
  getUserTier: vi.fn().mockResolvedValue('free'),
  TIER_LIMITS: {
    free:  { extractionsPerMonth: 100,   maxSources: 2,   minScheduleInterval: 86400, name: 'Free',  price: 0  },
    pro:   { extractionsPerMonth: 5000,  maxSources: 50,  minScheduleInterval: 3600,  name: 'Pro',   price: 19 },
    team:  { extractionsPerMonth: 50000, maxSources: 500, minScheduleInterval: 900,   name: 'Team',  price: 99 },
  },
  stripe: {},
  tierFromPriceId: vi.fn().mockReturnValue('free'),
}));

vi.mock('@/lib/extract', () => ({
  extract: vi.fn().mockResolvedValue({
    url: 'https://example.com',
    title: 'Test Page',
    markdown: '# Test Page\n\nSome content here.',
    json: { title: 'Test Page', sections: [], codeBlocks: [], tables: [] },
    contentHash: 'abc123',
    tokenCount: 50,
    renderMode: 'fetch',
    meta: {},
  }),
  FetchError: class FetchError extends Error {
    constructor(msg: string, public status?: number, public code?: string) { super(msg); }
  },
}));

// Helper to build a mock request
function makeReq(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  authHeader?: string
): NextRequest {
  const req = new NextRequest(new URL(`http://localhost${path}`), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return req;
}

// ── Unit: key utilities ───────────────────────────────────────────────────────
describe('generateApiKey', () => {
  it('produces an sk_live_ prefixed key', () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^sk_live_/);
  });

  it('produces a 64-char hex hash', () => {
    const { hash } = generateApiKey();
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('each call produces a unique key', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('hashApiKey', () => {
  it('is deterministic', () => {
    const key = 'sk_live_testkey';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('differs for different keys', () => {
    expect(hashApiKey('sk_live_aaa')).not.toBe(hashApiKey('sk_live_bbb'));
  });
});

// ── Unit: usage utilities ─────────────────────────────────────────────────────
describe('getPeriodStart', () => {
  it('returns first day of current month', () => {
    const period = getPeriodStart(new Date('2024-03-15T10:00:00Z'));
    expect(period).toBe('2024-03-01');
  });

  it('works at month boundary', () => {
    expect(getPeriodStart(new Date('2024-01-31T23:59:59Z'))).toBe('2024-01-01');
  });
});

describe('getPeriodEnd', () => {
  it('returns first day of next month', () => {
    const end = getPeriodEnd(new Date('2024-03-15'));
    expect(end).toContain('2024-04-01');
  });

  it('handles December → January rollover', () => {
    const end = getPeriodEnd(new Date('2024-12-15'));
    expect(end).toContain('2025-01-01');
  });
});

describe('TIER_LIMITS', () => {
  it('free tier has a positive extraction limit', async () => {
    const { TIER_LIMITS } = await import('@/lib/stripe');
    expect(TIER_LIMITS.free.extractionsPerMonth).toBeGreaterThan(0);
  });
});

// ── Integration: /api/v1/extract route ───────────────────────────────────────
describe('POST /api/v1/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mockSupabase.single resolves to a valid key record
    mockSupabase.single.mockResolvedValue({
      data: { id: 'key-id-1', user_id: 'user-id-1', revoked_at: null },
      error: null,
    });
    // Default: no previous usage this period
    mockSupabase.rpc.mockResolvedValue({ error: null });
  });

  async function callExtract(body: unknown, authHeader?: string) {
    const { POST } = await import('@/app/api/v1/extract/route');
    const req = makeReq('POST', '/api/v1/extract', body, authHeader);
    return POST(req);
  }

  it('returns 401 with no auth header', async () => {
    // single returns no data (key not found)
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const res = await callExtract({ url: 'https://example.com' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('INVALID_API_KEY');
  });

  it('returns 401 with an invalid key', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const res = await callExtract({ url: 'https://example.com' }, 'Bearer sk_live_badkey');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a revoked key', async () => {
    mockSupabase.single.mockResolvedValue({
      data: { id: 'key-id-1', user_id: 'user-id-1', revoked_at: '2024-01-01T00:00:00Z' },
      error: null,
    });
    const res = await callExtract({ url: 'https://example.com' }, 'Bearer sk_live_revokedkey');
    expect(res.status).toBe(401);
  });

  it('returns 422 when url is missing', async () => {
    const res = await callExtract({ niche: 'docs' }, 'Bearer sk_live_validkey');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('INVALID_URL');
  });

  it('returns 422 for a non-http URL', async () => {
    const res = await callExtract({ url: 'ftp://example.com' }, 'Bearer sk_live_validkey');
    expect(res.status).toBe(422);
  });

  it('returns 200 with valid key and URL', async () => {
    // Mock usage check: return 0 extractions (under limit)
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'key-id-1', user_id: 'user-id-1', revoked_at: null }, error: null }) // key lookup
      .mockResolvedValueOnce({ data: { extractions_count: 5, tokens_out: 1000 }, error: null }); // usage

    const res = await callExtract({ url: 'https://example.com' }, 'Bearer sk_live_validkey');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('markdown');
    expect(body).toHaveProperty('content_hash');
    expect(body).toHaveProperty('token_count');
    expect(body._quota).toMatchObject({ limit: expect.any(Number), used: expect.any(Number) });
  });

  it('returns 429 when quota is exceeded', async () => {
    const { TIER_LIMITS } = await import('@/lib/stripe');
    const limit = TIER_LIMITS.free.extractionsPerMonth;

    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'key-id-1', user_id: 'user-id-1', revoked_at: null }, error: null })
      .mockResolvedValueOnce({ data: { extractions_count: limit, tokens_out: 999999 }, error: null });

    const res = await callExtract({ url: 'https://example.com' }, 'Bearer sk_live_validkey');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('QUOTA_EXCEEDED');
    expect(body).toHaveProperty('reset_at');
    expect(body.used).toBe(limit);
    expect(body.limit).toBe(limit);
  });
});
