-- Batch import function for questions and tokens (transactional per call)

create or replace function public.import_questions_batch(p_rows jsonb)
returns void
language plpgsql
as $$
declare
  r jsonb;
  idx int := 0;
  v_question_id uuid;
  v_public_qid text;
  v_error text;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    idx := idx + 1;
    v_public_qid := r->>'public_qid';
    begin
      insert into public.questions (
        public_qid,
        org_code2,
        subject_code2,
        year,
        month,
        number,
        unit,
        qtype,
        correct_rate,
        pdf_url,
        page_no,
        bbox
      )
      values (
        v_public_qid,
        r->>'org_code2',
        r->>'subject_code2',
        (r->>'year')::int,
        (r->>'month')::int,
        (r->>'number')::int,
        r->>'unit',
        r->>'qtype',
        nullif(r->>'correct_rate', '')::numeric,
        r->>'pdf_url',
        (r->>'page_no')::int,
        r->'bbox'
      )
      on conflict (public_qid) do update set
        org_code2 = excluded.org_code2,
        subject_code2 = excluded.subject_code2,
        year = excluded.year,
        month = excluded.month,
        number = excluded.number,
        unit = excluded.unit,
        qtype = excluded.qtype,
        correct_rate = excluded.correct_rate,
        pdf_url = excluded.pdf_url,
        page_no = excluded.page_no,
        bbox = excluded.bbox
      returning id into v_question_id;

      insert into public.question_tokens (
        question_id,
        tokens,
        bigrams,
        trigrams
      )
      values (
        v_question_id,
        (select coalesce(array_agg(value), '{}')
         from jsonb_array_elements_text(coalesce(r->'tokens', '[]'::jsonb)) as t(value)),
        (select coalesce(array_agg(value), '{}')
         from jsonb_array_elements_text(coalesce(r->'bigrams', '[]'::jsonb)) as t(value)),
        (select coalesce(array_agg(value), '{}')
         from jsonb_array_elements_text(coalesce(r->'trigrams', '[]'::jsonb)) as t(value))
      )
      on conflict (question_id) do update set
        tokens = excluded.tokens,
        bigrams = excluded.bigrams,
        trigrams = excluded.trigrams;
    exception when others then
      get stacked diagnostics v_error = message_text;
      raise exception 'row % (public_qid=%): %', idx, v_public_qid, v_error;
    end;
  end loop;
end;
$$;
