import type { Context } from 'hono';
import { toApiStatus, type ApiStatus } from '../http';
import { abandonIdempotency, finalizeIdempotency, type ApiErrorPayload } from '../idempotency';
import { SupabaseError, SupabaseRestClient } from '../supabase';
import type { AppEnv } from '../types';

export const finalizeMutationSuccess = async ({
  c,
  idempotencyRecordId,
  status,
  data
}: {
  c: Context<AppEnv>;
  idempotencyRecordId: string | null;
  status: ApiStatus;
  data: unknown;
}): Promise<void> => {
  if (!idempotencyRecordId) {
    return;
  }

  const supabase = new SupabaseRestClient(c);
  await finalizeIdempotency({
    supabase,
    env: c.env,
    recordId: idempotencyRecordId,
    status,
    data,
    error: null
  });
};

export const finalizeMutationError = async ({
  c,
  idempotencyRecordId,
  status,
  error
}: {
  c: Context<AppEnv>;
  idempotencyRecordId: string | null;
  status: ApiStatus;
  error: ApiErrorPayload;
}): Promise<void> => {
  if (!idempotencyRecordId) {
    return;
  }

  const supabase = new SupabaseRestClient(c);
  await finalizeIdempotency({
    supabase,
    env: c.env,
    recordId: idempotencyRecordId,
    status,
    data: null,
    error
  });
};

export const abandonMutationIdempotency = async ({
  c,
  idempotencyRecordId
}: {
  c: Context<AppEnv>;
  idempotencyRecordId: string | null;
}): Promise<void> => {
  if (!idempotencyRecordId) {
    return;
  }

  try {
    const supabase = new SupabaseRestClient(c);
    await abandonIdempotency({
      supabase,
      recordId: idempotencyRecordId
    });
  } catch {
    // Best effort cleanup only.
  }
};

export const handleMutationSupabaseError = async ({
  c,
  idempotencyRecordId,
  error
}: {
  c: Context<AppEnv>;
  idempotencyRecordId: string | null;
  error: SupabaseError;
}): Promise<{ status: ApiStatus; responseError: ApiErrorPayload }> => {
  const status = toApiStatus(error.status);
  const responseError: ApiErrorPayload = {
    code: 'supabase_error',
    message: error.message
  };

  if (idempotencyRecordId) {
    if (status < 500) {
      await finalizeMutationError({
        c,
        idempotencyRecordId,
        status,
        error: responseError
      });
    } else {
      await abandonMutationIdempotency({
        c,
        idempotencyRecordId
      });
    }
  }

  return { status, responseError };
};

