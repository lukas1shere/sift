import type { NextRequest } from 'next/server';
import { hashApiKey, lookupApiKey } from './keys';
import { getUserFromToken } from './supabase/client';

export interface ApiKeyAuth {
  type: 'api_key';
  userId: string;
  keyId: string;
}

export interface JwtAuth {
  type: 'jwt';
  userId: string;
}

export type AuthResult = ApiKeyAuth | JwtAuth;

function extractBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

// Authenticate via API key (sk_live_... prefix)
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuth | null> {
  const token = extractBearer(req);
  if (!token || !token.startsWith('sk_')) return null;

  const hash = hashApiKey(token);
  const record = await lookupApiKey(hash);
  if (!record) return null;

  return { type: 'api_key', userId: record.userId, keyId: record.keyId };
}

// Authenticate via Supabase JWT (for key management dashboard endpoints)
export async function authenticateJwt(req: NextRequest): Promise<JwtAuth | null> {
  const token = extractBearer(req);
  if (!token || token.startsWith('sk_')) return null;

  const userId = await getUserFromToken(token);
  if (!userId) return null;

  return { type: 'jwt', userId };
}

// Generic: tries API key first, then JWT
export async function authenticate(req: NextRequest): Promise<AuthResult | null> {
  const token = extractBearer(req);
  if (!token) return null;

  if (token.startsWith('sk_')) {
    return authenticateApiKey(req);
  }
  return authenticateJwt(req);
}
