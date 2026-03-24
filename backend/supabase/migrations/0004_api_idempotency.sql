-- API idempotency store for mutation routes.

create table if not exists public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  route_key text not null,
  idempotency_key text not null,
  request_hash text not null,
  state text not null default 'in_progress' check (state in ('in_progress', 'completed')),
  response_status integer,
  response_data jsonb,
  response_error jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

create unique index if not exists uq_api_idempotency_scope
  on public.api_idempotency_keys (owner_sub, route_key, idempotency_key);

create index if not exists idx_api_idempotency_expires_at
  on public.api_idempotency_keys (expires_at);

drop trigger if exists trg_api_idempotency_keys_updated_at on public.api_idempotency_keys;
create trigger trg_api_idempotency_keys_updated_at
before update on public.api_idempotency_keys
for each row execute procedure public.set_updated_at();

alter table public.api_idempotency_keys enable row level security;

drop policy if exists "service_role_api_idempotency_keys_all" on public.api_idempotency_keys;
create policy "service_role_api_idempotency_keys_all"
  on public.api_idempotency_keys
  for all
  to service_role
  using (true)
  with check (true);
