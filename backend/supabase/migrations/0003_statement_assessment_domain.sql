-- Statement-first risk assessment domain for Worker + Modal orchestration.

create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  source text not null default 'upload',
  storage_key text not null,
  file_name text,
  mime_type text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed')),
  extraction_job_id uuid,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  provider text not null default 'modal',
  external_job_id text,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.extracted_features (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  owner_sub text not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  owner_sub text not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  extracted_feature_id uuid references public.extracted_features(id) on delete set null,
  risk_probability double precision not null,
  auto_decision text not null check (auto_decision in ('Approve', 'Decline')),
  final_decision text not null check (final_decision in ('Approve', 'Decline')),
  decision_source text not null default 'auto' check (decision_source in ('auto', 'manual_override')),
  threshold double precision,
  model_version text,
  reviewed_by text,
  override_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assessment_overrides (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  actor_sub text,
  actor_email text,
  decision text not null check (decision in ('Approve', 'Decline')),
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_extraction_job_id_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_extraction_job_id_fkey
      foreign key (extraction_job_id) references public.extraction_jobs(id) on delete set null;
  end if;
end;
$$;

create index if not exists idx_documents_owner_sub on public.documents(owner_sub);
create index if not exists idx_documents_status on public.documents(status);
create index if not exists idx_documents_created_at on public.documents(created_at desc);

create index if not exists idx_extraction_jobs_document_id on public.extraction_jobs(document_id);
create index if not exists idx_extraction_jobs_status on public.extraction_jobs(status);
create index if not exists idx_extraction_jobs_created_at on public.extraction_jobs(created_at desc);

create index if not exists idx_extracted_features_owner_sub on public.extracted_features(owner_sub);
create index if not exists idx_extracted_features_created_at on public.extracted_features(created_at desc);

create index if not exists idx_assessments_owner_sub on public.assessments(owner_sub);
create index if not exists idx_assessments_final_decision on public.assessments(final_decision);
create index if not exists idx_assessments_created_at on public.assessments(created_at desc);

create index if not exists idx_assessment_overrides_assessment_id on public.assessment_overrides(assessment_id);
create index if not exists idx_assessment_overrides_created_at on public.assessment_overrides(created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_extraction_jobs_updated_at on public.extraction_jobs;
create trigger trg_extraction_jobs_updated_at
before update on public.extraction_jobs
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_extracted_features_updated_at on public.extracted_features;
create trigger trg_extracted_features_updated_at
before update on public.extracted_features
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_assessments_updated_at on public.assessments;
create trigger trg_assessments_updated_at
before update on public.assessments
for each row execute procedure public.set_updated_at();

alter table public.documents enable row level security;
alter table public.extraction_jobs enable row level security;
alter table public.extracted_features enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_overrides enable row level security;

drop policy if exists "service_role_documents_all" on public.documents;
create policy "service_role_documents_all"
  on public.documents
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_extraction_jobs_all" on public.extraction_jobs;
create policy "service_role_extraction_jobs_all"
  on public.extraction_jobs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_extracted_features_all" on public.extracted_features;
create policy "service_role_extracted_features_all"
  on public.extracted_features
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_assessments_all" on public.assessments;
create policy "service_role_assessments_all"
  on public.assessments
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_assessment_overrides_all" on public.assessment_overrides;
create policy "service_role_assessment_overrides_all"
  on public.assessment_overrides
  for all
  to service_role
  using (true)
  with check (true);
