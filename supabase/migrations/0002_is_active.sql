-- Add is_active to questions and tighten public read policies

alter table public.questions
add column if not exists is_active boolean not null default true;

-- Drop old public SELECT policies if they exist
drop policy if exists questions_select_public on public.questions;
drop policy if exists question_tokens_select_public on public.question_tokens;

-- Recreate public SELECT policies with is_active filtering
create policy questions_select_public_active on public.questions
for select using (is_active = true);

create policy question_tokens_select_public_active on public.question_tokens
for select using (
  exists (
    select 1
    from public.questions q
    where q.id = question_id and q.is_active = true
  )
);
