-- Indexes for filter performance

create index if not exists questions_org_code2_idx
on public.questions (org_code2);

create index if not exists questions_subject_code2_idx
on public.questions (subject_code2);

create index if not exists questions_year_idx
on public.questions (year);

create index if not exists questions_month_idx
on public.questions (month);

create index if not exists questions_number_idx
on public.questions (number);

create index if not exists questions_org_subject_year_month_number_idx
on public.questions (org_code2, subject_code2, year, month, number);

-- Optional for frequent ILIKE on unit/qtype (case-insensitive)
create index if not exists questions_unit_lower_idx
on public.questions (lower(unit));

create index if not exists questions_qtype_lower_idx
on public.questions (lower(qtype));
