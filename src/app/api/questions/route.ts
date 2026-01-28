import { searchQuestions } from "../../../lib/searchQuestions";
import { error as errorResponse, json } from "../../../lib/apiResponse";
import { enforceRateLimit } from "../../../lib/rateLimit";
import type { QuestionSearchFilters, SearchQuestionsParams } from "../../../types/db";

const DIFFICULTY_5_VALUES = [
  "매우 쉬움",
  "쉬움",
  "보통",
  "어려움(준킬러)",
  "매우 어려움(킬러)",
] as const;

const KILLER_3_VALUES = ["비킬러", "준킬러", "킬러"] as const;

class ValidationError extends Error {
  status = 400;
}

function badRequest(message: string): never {
  throw new ValidationError(message);
}

function parseNumber(value: string | null, field: string): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    badRequest(`Invalid ${field}`);
  }
  return parsed;
}

function sanitizeQuery(value: string): string {
  return value.replace(/[^0-9A-Za-z가-힣\s]/g, "").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rateLimitResponse = await enforceRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const rawQ = searchParams.get("q");
    let q: string | undefined;
    if (rawQ !== null) {
      const cleaned = sanitizeQuery(rawQ);
      if (cleaned.length < 2) {
        badRequest("Invalid q");
      }
      q = cleaned;
    }

    const page = parseNumber(searchParams.get("page"), "page") ?? 1;
    let pageSize = parseNumber(searchParams.get("pageSize"), "pageSize") ?? 20;
    if (page < 1) badRequest("Invalid page");
    if (pageSize < 1) badRequest("Invalid pageSize");
    if (pageSize > 50) pageSize = 50;

    const filters: QuestionSearchFilters = {};
    const orgRaw = searchParams.get("org");
    if (orgRaw !== null) {
      const org = orgRaw.trim();
      if (org.length !== 2) badRequest("Invalid org");
      filters.org_code2 = org;
    }
    const subjectRaw = searchParams.get("subject");
    if (subjectRaw !== null) {
      const subject = subjectRaw.trim();
      if (subject.length !== 2) badRequest("Invalid subject");
      filters.subject_code2 = subject;
    }

    const year = parseNumber(searchParams.get("year"), "year");
    if (year !== undefined) {
      if (year < 1990 || year > 2100) badRequest("Invalid year");
      filters.year = year;
    }
    const month = parseNumber(searchParams.get("month"), "month");
    if (month !== undefined) {
      if (month < 1 || month > 12) badRequest("Invalid month");
      filters.month = month;
    }
    const number = parseNumber(searchParams.get("number"), "number");
    if (number !== undefined) {
      if (number < 1 || number > 50) badRequest("Invalid number");
      filters.number = number;
    }

    const unit = searchParams.get("unit");
    if (unit) filters.unit = unit;
    const qtype = searchParams.get("qtype");
    if (qtype) filters.qtype = qtype;

    const difficulty5 = searchParams.get("difficulty_5");
    if (difficulty5) {
      if (!DIFFICULTY_5_VALUES.includes(difficulty5 as (typeof DIFFICULTY_5_VALUES)[number])) {
        badRequest("Invalid difficulty_5");
      }
      filters.difficulty_5 = difficulty5 as (typeof DIFFICULTY_5_VALUES)[number];
    }

    const killer3 = searchParams.get("killer_3");
    if (killer3) {
      if (!KILLER_3_VALUES.includes(killer3 as (typeof KILLER_3_VALUES)[number])) {
        badRequest("Invalid killer_3");
      }
      filters.killer_3 = killer3 as (typeof KILLER_3_VALUES)[number];
    }

    if (!q && Object.keys(filters).length === 0) {
      badRequest("At least one search parameter is required");
    }

    const params: SearchQuestionsParams = {
      q,
      filters: Object.keys(filters).length ? filters : undefined,
      page,
      pageSize,
    };

    const result = await searchQuestions(params);
    return json({
      items: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid parameters";
    if (err instanceof ValidationError) {
      return errorResponse(400, message, "BAD_REQUEST");
    }
    return errorResponse(500, message, "INTERNAL_ERROR");
  }
}
