-- Adds server-owned EMI application fields to existing transactions table.

alter table public.transactions
  add column if not exists application_uuid text,
  add column if not exists user_sub text,
  add column if not exists idempotency_key text,
  add column if not exists order_amount_inr double precision,
  add column if not exists tenure_months integer,
  add column if not exists monthly_income_inr double precision,
  add column if not exists bank text,
  add column if not exists card_type text,
  add column if not exists card_last_four_masked text,
  add column if not exists model_source text,
  add column if not exists auto_decision text,
  add column if not exists final_decision text,
  add column if not exists decision_source text,
  add column if not exists override_reason text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_transactions_application_uuid
  on public.transactions (application_uuid);

create index if not exists idx_transactions_user_sub
  on public.transactions (user_sub);

create index if not exists idx_transactions_final_decision
  on public.transactions (final_decision);

create index if not exists idx_transactions_idempotency_key
  on public.transactions (idempotency_key);

create index if not exists idx_transactions_updated_at
  on public.transactions (updated_at desc);

update public.transactions
set
  application_uuid = coalesce(application_uuid, gen_random_uuid()::text),
  auto_decision = coalesce(auto_decision, decision),
  final_decision = coalesce(final_decision, decision),
  decision_source = coalesce(decision_source, 'auto'),
  updated_at = coalesce(updated_at, created_at)
where
  application_uuid is null
  or auto_decision is null
  or final_decision is null
  or decision_source is null
  or updated_at is null;
