-- supabase/migrations/0006_ops_indexes.sql
create index if not exists questions_org_subject_year_month_idx
on public.questions (org_code2, subject_code2, year, month);

create index if not exists questions_unit_idx
on public.questions (unit);

create index if not exists questions_qtype_idx
on public.questions (qtype);

-- tokens/bigrams/trigrams는 이미 GIN 인덱스가 있어야 정상 (없으면 아래를 추가)
create index if not exists question_tokens_tokens_gin
on public.question_tokens using gin (tokens);

create index if not exists question_tokens_bigrams_gin
on public.question_tokens using gin (bigrams);

create index if not exists question_tokens_trigrams_gin
on public.question_tokens using gin (trigrams);
