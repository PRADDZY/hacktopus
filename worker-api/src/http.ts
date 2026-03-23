import type { Context } from 'hono';
import type { AppEnv } from './types';

type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 500 | 503;

export const toApiStatus = (value: number, fallback: ApiStatus = 500): ApiStatus => {
  if ([200, 201, 400, 401, 403, 404, 500, 503].includes(value)) {
    return value as ApiStatus;
  }
  return fallback;
};

const getRequestId = (c: Context<AppEnv>): string => {
  const incoming = c.req.header('X-Request-Id')?.trim();
  if (incoming) {
    return incoming;
  }
  return crypto.randomUUID();
};

const getMeta = (c: Context<AppEnv>) => ({
  requestId: getRequestId(c),
  timestamp: new Date().toISOString()
});

export const success = <T>(c: Context<AppEnv>, data: T, status: ApiStatus = 200): Response =>
  c.json(
    {
      data,
      error: null,
      meta: getMeta(c)
    },
    status
  );

export const failure = (
  c: Context<AppEnv>,
  error: ApiError,
  status: ApiStatus = 400
): Response =>
  c.json(
    {
      data: null,
      error,
      meta: getMeta(c)
    },
    status
  );
