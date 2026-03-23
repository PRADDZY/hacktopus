import type { Context } from 'hono';
import type { AppEnv } from './types';

export class SupabaseError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
  }
}

type QueryFilters = Record<string, string | number>;

const asNonEmpty = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const readMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const obj = payload as Record<string, unknown>;
  for (const key of ['message', 'error_description', 'hint', 'details']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

export class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly schema: string;

  constructor(c: Context<AppEnv>) {
    this.baseUrl = asNonEmpty(c.env.SUPABASE_URL) ?? '';
    this.serviceRoleKey = asNonEmpty(c.env.SUPABASE_SERVICE_ROLE_KEY) ?? '';
    this.schema = asNonEmpty(c.env.SUPABASE_REST_SCHEMA) ?? 'public';

    if (!this.baseUrl || !this.serviceRoleKey) {
      throw new SupabaseError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 500);
    }
  }

  private buildUrl(
    table: string,
    filters: QueryFilters = {},
    extras?: {
      order?: string;
      limit?: number;
      offset?: number;
      select?: string;
    }
  ): URL {
    const normalizedBase = this.baseUrl.replace(/\/$/, '');
    const url = new URL(`${normalizedBase}/rest/v1/${table}`);

    if (extras?.select) {
      url.searchParams.set('select', extras.select);
    }
    if (extras?.order) {
      url.searchParams.set('order', extras.order);
    }
    if (typeof extras?.limit === 'number') {
      url.searchParams.set('limit', String(extras.limit));
    }
    if (typeof extras?.offset === 'number') {
      url.searchParams.set('offset', String(extras.offset));
    }

    for (const [column, value] of Object.entries(filters)) {
      url.searchParams.set(column, `eq.${String(value)}`);
    }

    return url;
  }

  private headers(prefer?: string): HeadersInit {
    const headers: Record<string, string> = {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Profile': this.schema,
      'Content-Profile': this.schema
    };

    if (prefer) {
      headers.Prefer = prefer;
    }

    return headers;
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async request<T>({
    method,
    table,
    filters,
    body,
    select,
    order,
    limit,
    offset,
    prefer
  }: {
    method: 'GET' | 'POST' | 'PATCH';
    table: string;
    filters?: QueryFilters;
    body?: unknown;
    select?: string;
    order?: string;
    limit?: number;
    offset?: number;
    prefer?: string;
  }): Promise<T> {
    const url = this.buildUrl(table, filters, { select, order, limit, offset });
    const response = await fetch(url.toString(), {
      method,
      headers: this.headers(prefer),
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const payload = await this.parseResponse(response);
    if (!response.ok) {
      const message = readMessage(payload) ?? `Supabase request failed (${response.status})`;
      throw new SupabaseError(message, response.status);
    }

    return payload as T;
  }

  async selectOne<T>(table: string, filters: QueryFilters, select = '*'): Promise<T | null> {
    const payload = await this.request<unknown[]>({
      method: 'GET',
      table,
      filters,
      select
    });
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    return payload[0] as T;
  }

  async selectMany<T>(
    table: string,
    options: {
      filters?: QueryFilters;
      select?: string;
      order?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<T[]> {
    const payload = await this.request<unknown[]>({
      method: 'GET',
      table,
      filters: options.filters,
      select: options.select ?? '*',
      order: options.order,
      limit: options.limit,
      offset: options.offset
    });

    if (!Array.isArray(payload)) {
      return [];
    }
    return payload as T[];
  }

  async insertOne<T>(table: string, row: Record<string, unknown>): Promise<T> {
    const payload = await this.request<unknown[]>({
      method: 'POST',
      table,
      body: row,
      prefer: 'return=representation'
    });
    if (!Array.isArray(payload) || payload.length === 0) {
      throw new SupabaseError(`Insert on ${table} returned no rows`, 500);
    }
    return payload[0] as T;
  }

  async updateOne<T>(
    table: string,
    filters: QueryFilters,
    row: Record<string, unknown>
  ): Promise<T | null> {
    const payload = await this.request<unknown[]>({
      method: 'PATCH',
      table,
      filters,
      body: row,
      prefer: 'return=representation'
    });
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }
    return payload[0] as T;
  }
}
