import { supabase } from "./supabaseClient";
import { tokenizeQuery } from "./tokenize";
import type { QuestionSearchFilters, SearchQuestionsParams, Tables } from "../types/db";

type QuestionRow = Tables["questions"]["Row"];

export type SearchQuestionsResult = {
  items: QuestionRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function searchQuestions(
  params: SearchQuestionsParams = {},
): Promise<SearchQuestionsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, params.pageSize ?? 20);
  const filters = params.filters;

  let questionIds: string[] | null = null;

  if (params.q && params.q.trim().length > 0) {
    const { tokens, bigrams, trigrams } = tokenizeQuery(params.q);
    const groups = [
      { column: "tokens", values: tokens },
      { column: "bigrams", values: bigrams },
      { column: "trigrams", values: trigrams },
    ];

    for (const group of groups) {
      if (group.values.length === 0) continue;
      const { data, error } = await supabase
        .from("question_tokens")
        .select("question_id")
        .overlaps(group.column, group.values);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        questionIds = data.map((item) => item.question_id);
        break;
      }
    }

    if (questionIds === null) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }
  }

  let query = supabase.from("questions").select("*", { count: "exact" });

  if (questionIds) {
    query = query.in("id", questionIds);
  }

  query = applyFilters(query, filters);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

function applyFilters(query: any, filters?: QuestionSearchFilters) {
  if (!filters) return query;

  if (filters.org_code2) query = query.eq("org_code2", filters.org_code2);
  if (filters.subject_code2) query = query.eq("subject_code2", filters.subject_code2);
  if (filters.year !== undefined) query = query.eq("year", filters.year);
  if (filters.month !== undefined) query = query.eq("month", filters.month);
  if (filters.number !== undefined) query = query.eq("number", filters.number);
  if (filters.difficulty_5) query = query.eq("difficulty_5", filters.difficulty_5);
  if (filters.killer_3) query = query.eq("killer_3", filters.killer_3);

  if (filters.unit) query = query.ilike("unit", `%${filters.unit}%`);
  if (filters.qtype) query = query.ilike("qtype", `%${filters.qtype}%`);

  return query;
}
