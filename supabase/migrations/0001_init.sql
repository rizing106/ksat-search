-- Initial schema for KSAT search (Supabase / Postgres)

create extension if not exists "pgcrypto";

-- Common updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code2 text not null unique,
  name text not null,
  kind text not null check (kind in ('official', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_code2_len check (char_length(code2) = 2)
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- Subjects
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code2 text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_code2_len check (char_length(code2) = 2)
);

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

-- Questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  public_qid text not null unique,
  org_code2 text not null references public.organizations(code2),
  subject_code2 text not null references public.subjects(code2),
  year int not null,
  month int not null,
  number int not null,
  unit text not null,
  qtype text not null,
  correct_rate numeric(5,2),
  difficulty_5 text generated always as (
    case
      when correct_rate is null then null
      when correct_rate >= 90 then '매우 쉬움'
      when correct_rate >= 75 then '쉬움'
      when correct_rate >= 55 then '보통'
      when correct_rate >= 35 then '어려움(준킬러)'
      else '매우 어려움(킬러)'
    end
  ) stored,
  killer_3 text generated always as (
    case
      when correct_rate is null then null
      when correct_rate >= 55 then '비킬러'
      when correct_rate >= 35 then '준킬러'
      else '킬러'
    end
  ) stored,
  pdf_url text not null,
  page_no int not null,
  bbox jsonb not null,
  explanation_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_public_qid_fmt check (public_qid ~ '^[0-9]{12}$'),
  constraint questions_bbox_shape check (
    (bbox ? 'x') and (bbox ? 'y') and (bbox ? 'w') and (bbox ? 'h') and
    (bbox->>'x')::numeric between 0 and 1 and
    (bbox->>'y')::numeric between 0 and 1 and
    (bbox->>'w')::numeric between 0 and 1 and
    (bbox->>'h')::numeric between 0 and 1
  )
);

create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

-- Question tokens
create table if not exists public.question_tokens (
  question_id uuid primary key references public.questions(id) on delete cascade,
  tokens text[] not null default '{}',
  bigrams text[] not null default '{}',
  trigrams text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger question_tokens_set_updated_at
before update on public.question_tokens
for each row execute function public.set_updated_at();

create index if not exists question_tokens_tokens_gin on public.question_tokens using gin (tokens);
create index if not exists question_tokens_bigrams_gin on public.question_tokens using gin (bigrams);
create index if not exists question_tokens_trigrams_gin on public.question_tokens using gin (trigrams);

-- Phase 2 tables (design only)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'teacher', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid references auth.users(id),
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger issue_reports_set_updated_at
before update on public.issue_reports
for each row execute function public.set_updated_at();

create table if not exists public.explanation_suggestions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  markdown text not null,
  youtube_video_id text,
  start_seconds int,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger explanation_suggestions_set_updated_at
before update on public.explanation_suggestions
for each row execute function public.set_updated_at();

-- RLS
alter table public.organizations enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.question_tokens enable row level security;
alter table public.profiles enable row level security;
alter table public.issue_reports enable row level security;
alter table public.explanation_suggestions enable row level security;

-- MVP public read
create policy questions_select_public on public.questions
for select using (true);

create policy question_tokens_select_public on public.question_tokens
for select using (true);

create policy organizations_select_public on public.organizations
for select using (true);

create policy subjects_select_public on public.subjects
for select using (true);

-- Profiles: self or admin
create policy profiles_select_self_or_admin on public.profiles
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create policy profiles_update_self_or_admin on public.profiles
for update using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

-- Issue reports: anyone can insert, only admin can select
create policy issue_reports_insert_anyone on public.issue_reports
for insert with check (true);

create policy issue_reports_select_admin on public.issue_reports
for select using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

-- Explanation suggestions: teachers can insert, admin or owner can select
create policy explanation_suggestions_insert_teacher on public.explanation_suggestions
for insert with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid() and p.role = 'teacher'
  )
);

create policy explanation_suggestions_select_admin_or_owner on public.explanation_suggestions
for select using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
  or auth.uid() = user_id
);
