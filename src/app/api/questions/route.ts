import { NextResponse } from "next/server";
import { searchQuestions } from "../../../lib/searchQuestions";
import type { QuestionSearchFilters, SearchQuestionsParams } from "../../../types/db";

const DIFFICULTY_5_VALUES = [
  "매우 쉬움",
  "쉬움",
  "보통",
  "어려움(준킬러)",
  "매우 어려움(킬러)",
] as const;

const KILLER_3_VALUES = ["비킬러", "준킬러", "킬러"] as const;

function parseNumber(value: string | null, field: string): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${field}`);
  }
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  try {
    const page = parseNumber(searchParams.get("page"), "page");
    const pageSize = parseNumber(searchParams.get("pageSize"), "pageSize");
    if (page !== undefined && page < 1) throw new Error("Invalid page");
    if (pageSize !== undefined && (pageSize < 1 || pageSize > 50)) {
      throw new Error("Invalid pageSize");
    }

    const filters: QuestionSearchFilters = {};
    const org = searchParams.get("org");
    if (org) filters.org_code2 = org;
    const subject = searchParams.get("subject");
    if (subject) filters.subject_code2 = subject;

    const year = parseNumber(searchParams.get("year"), "year");
    if (year !== undefined) filters.year = year;
    const month = parseNumber(searchParams.get("month"), "month");
    if (month !== undefined) filters.month = month;
    const number = parseNumber(searchParams.get("number"), "number");
    if (number !== undefined) filters.number = number;

    const unit = searchParams.get("unit");
    if (unit) filters.unit = unit;
    const qtype = searchParams.get("qtype");
    if (qtype) filters.qtype = qtype;

    const difficulty5 = searchParams.get("difficulty_5");
    if (difficulty5) {
      if (!DIFFICULTY_5_VALUES.includes(difficulty5 as (typeof DIFFICULTY_5_VALUES)[number])) {
        throw new Error("Invalid difficulty_5");
      }
      filters.difficulty_5 = difficulty5 as (typeof DIFFICULTY_5_VALUES)[number];
    }

    const killer3 = searchParams.get("killer_3");
    if (killer3) {
      if (!KILLER_3_VALUES.includes(killer3 as (typeof KILLER_3_VALUES)[number])) {
        throw new Error("Invalid killer_3");
      }
      filters.killer_3 = killer3 as (typeof KILLER_3_VALUES)[number];
    }

    const params: SearchQuestionsParams = {
      q,
      filters: Object.keys(filters).length ? filters : undefined,
      page,
      pageSize,
    };

    const result = await searchQuestions(params);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid parameters";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
