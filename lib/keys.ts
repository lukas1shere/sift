import { randomBytes, createHash } from 'crypto';
import { getSupabaseAdmin } from './supabase/client';

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface NewApiKey extends ApiKeyRecord {
  key: string; // plain key — shown only once
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(24).toString('base64url');
  const key = `sk_live_${raw}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 14) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export async function lookupApiKey(
  hash: string
): Promise<{ userId: string; keyId: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hash)
    .single();

  if (!data || data.revoked_at) return null;

  // Fire-and-forget last_used update
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  return { userId: data.user_id, keyId: data.id };
}

export async function createApiKey(userId: string, name = 'Default'): Promise<NewApiKey> {
  const { key, hash, prefix } = generateApiKey();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: userId, name, key_hash: hash, key_prefix: prefix })
    .select('id, user_id, name, key_prefix, created_at, last_used_at, revoked_at')
    .single();

  if (error || !data) throw new Error(`Failed to create API key: ${error?.message}`);

  return {
    key,
    id: data.id,
    userId: data.user_id,
    name: data.name,
    keyPrefix: data.key_prefix,
    createdAt: data.created_at,
    lastUsedAt: data.last_used_at,
    revokedAt: data.revoked_at,
  };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('api_keys')
    .select('id, user_id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    keyPrefix: r.key_prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
  }));
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId) // ensure the key belongs to this user
    .is('revoked_at', null);

  return !error;
}
