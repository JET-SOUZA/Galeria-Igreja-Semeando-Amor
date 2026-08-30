-- Semeando Memórias — persistent photo import jobs
-- Additive migration only. No existing event/photo/lead data is changed or removed.

create table if not exists public.media_import_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  source_type text not null check (source_type in ('icloud','zip','drive')),
  source_ref text,
  source_name text,
  status text not null default 'pending' check (status in ('pending','discovering','ready','processing','completed','partial','failed','cancelled','needs_worker')),
  total_items integer not null default 0 check (total_items >= 0),
  processed_items integer not null default 0 check (processed_items >= 0),
  imported_items integer not null default 0 check (imported_items >= 0),
  skipped_items integer not null default 0 check (skipped_items >= 0),
  failed_items integer not null default 0 check (failed_items >= 0),
  error_message text,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.media_import_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.media_import_jobs(id) on delete cascade,
  source_item_id text not null,
  filename text,
  mime_type text,
  file_size bigint,
  status text not null default 'pending' check (status in ('pending','processing','imported','skipped','failed')),
  photo_id uuid references public.photos(id) on delete set null,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, source_item_id)
);

create index if not exists media_import_jobs_event_created_idx
  on public.media_import_jobs(event_id, created_at desc);
create index if not exists media_import_jobs_status_idx
  on public.media_import_jobs(status, updated_at);
create index if not exists media_import_items_job_status_idx
  on public.media_import_items(job_id, status, created_at);

alter table public.media_import_jobs enable row level security;
alter table public.media_import_items enable row level security;

-- Deliberately no anon/authenticated policies. These records are backend-only and
-- are exposed to admins through authenticated Edge Functions.
comment on table public.media_import_jobs is
  'Persistent import jobs for large photo batches. Access is mediated by authenticated backend functions.';
comment on table public.media_import_items is
  'Per-file status for persistent import jobs, including retryable failures.';
