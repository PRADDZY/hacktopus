import { toApiStatus, type ApiStatus } from './http';
import { SupabaseError, SupabaseRestClient } from './supabase';
import type { AppEnv } from './types';

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

type IdempotencyRecord = {
  id: string;
  owner_sub: string;
  route_key: string;
  idempotency_key: string;
  request_hash: string;
  state: 'in_progress' | 'completed';
  response_status?: number | null;
  response_data?: unknown;
  response_error?: ApiErrorPayload | null;
  expires_at?: string | null;
};

export type IdempotencyResult =
  | {
      kind: 'started';
      recordId: string;
    }
  | {
      kind: 'replay';
      status: ApiStatus;
      data: unknown;
      error: ApiErrorPayload | null;
    }
  | {
      kind: 'conflict';
    }
  | {
      kind: 'in_progress';
    };

const asNonEmpty = (value: string | undefined | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseTtlSeconds = (env: AppEnv['Bindings']): number => {
  const parsed = Number(env.IDEMPOTENCY_TTL_SECONDS ?? '86400');
  if (!Number.isFinite(parsed) || parsed < 60) {
    return 86400;
  }
  return Math.floor(parsed);
};

const expiresAt = (env: AppEnv['Bindings']): string =>
  new Date(Date.now() + parseTtlSeconds(env) * 1000).toISOString();

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const normalizedEntries = entries.map(
    ([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`
  );
  return `{${normalizedEntries.join(',')}}`;
};

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

const asApiError = (value: unknown): ApiErrorPayload | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybeCode = (value as Record<string, unknown>).code;
  const maybeMessage = (value as Record<string, unknown>).message;
  if (typeof maybeCode !== 'string' || typeof maybeMessage !== 'string') {
    return null;
  }

  const maybeDetails = (value as Record<string, unknown>).details;
  return maybeDetails === undefined
    ? { code: maybeCode, message: maybeMessage }
    : { code: maybeCode, message: maybeMessage, details: maybeDetails };
};

export const readIdempotencyKey = (rawHeader: string | undefined): string | null =>
  asNonEmpty(rawHeader);

export const createIdempotencyHash = async ({
  routeKey,
  ownerSub,
  payload
}: {
  routeKey: string;
  ownerSub: string;
  payload: unknown;
}): Promise<string> => {
  const serialized = stableStringify({
    route_key: routeKey,
    owner_sub: ownerSub,
    payload
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return toHex(digest);
};

export const beginIdempotency = async ({
  supabase,
  env,
  ownerSub,
  routeKey,
  idempotencyKey,
  requestHash
}: {
  supabase: SupabaseRestClient;
  env: AppEnv['Bindings'];
  ownerSub: string;
  routeKey: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<IdempotencyResult> => {
  try {
    const created = await supabase.insertOne<IdempotencyRecord>('api_idempotency_keys', {
      owner_sub: ownerSub,
      route_key: routeKey,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      state: 'in_progress',
      expires_at: expiresAt(env)
    });

    return {
      kind: 'started',
      recordId: created.id
    };
  } catch (error) {
    if (!(error instanceof SupabaseError)) {
      throw error;
    }

    const existing = await supabase.selectOne<IdempotencyRecord>('api_idempotency_keys', {
      owner_sub: ownerSub,
      route_key: routeKey,
      idempotency_key: idempotencyKey
    });

    if (!existing) {
      throw error;
    }

    if (existing.request_hash !== requestHash) {
      return { kind: 'conflict' };
    }

    if (existing.state === 'completed') {
      return {
        kind: 'replay',
        status: toApiStatus(existing.response_status ?? 200, 200),
        data: existing.response_data ?? null,
        error: asApiError(existing.response_error)
      };
    }

    return { kind: 'in_progress' };
  }
};

export const finalizeIdempotency = async ({
  supabase,
  env,
  recordId,
  status,
  data,
  error
}: {
  supabase: SupabaseRestClient;
  env: AppEnv['Bindings'];
  recordId: string;
  status: ApiStatus;
  data: unknown;
  error: ApiErrorPayload | null;
}): Promise<void> => {
  await supabase.updateOne<IdempotencyRecord>(
    'api_idempotency_keys',
    { id: recordId },
    {
      state: 'completed',
      response_status: status,
      response_data: data,
      response_error: error,
      expires_at: expiresAt(env)
    }
  );
};
