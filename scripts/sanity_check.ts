import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { supabaseAdmin } from "./supabaseAdmin";
import { tokenizeQuery } from "../src/lib/tokenize";

type SearchGroup = { label: string; column: "tokens" | "bigrams" | "trigrams"; values: string[] };

type SanityCheck = { url: string; status: string; ok: boolean };

async function countQuestionsTotal() {
  const { count, error } = await supabaseAdmin
    .from("questions")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function countIsActive(value: boolean) {
  const { count, error } = await supabaseAdmin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", value);
  if (error) throw error;
  return count ?? 0;
}

async function getRecentPublicQids(limit = 5) {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("public_qid, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function searchTotal(q: string) {
  const { tokens, bigrams, trigrams } = tokenizeQuery(q);
  const groups: SearchGroup[] = [
    { label: "tokens", column: "tokens", values: tokens },
    { label: "bigrams", column: "bigrams", values: bigrams },
    { label: "trigrams", column: "trigrams", values: trigrams },
  ];

  let questionIds: string[] | null = null;
  for (const group of groups) {
    if (group.values.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from("question_tokens")
      .select("question_id")
      .overlaps(group.column, group.values);
    if (error) throw error;
    if (data && data.length > 0) {
      questionIds = data.map((row) => row.question_id);
      break;
    }
  }

  if (questionIds === null) {
    return { total: 0, matchedBy: "none" as const };
  }

  const { count, error } = await supabaseAdmin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .in("id", questionIds);
  if (error) throw error;
  return { total: count ?? 0, matchedBy: "tokens" as const };
}

function formatStamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

async function run() {
  const hints: string[] = [];
  const checks: SanityCheck[] = [];
  const stamp = formatStamp(new Date());

  const recordCheck = (url: string, ok: boolean, status: string) => {
    checks.push({ url, status, ok });
  };

  try {
    const total = await countQuestionsTotal();
    console.log(`questions total: ${total}`);
    recordCheck("questions total", true, `total=${total}`);
    if (total === 0) {
      hints.push("questions total = 0: CSV import or DB connection 확인 필요.");
    }
  } catch (err) {
    console.error("Failed to read questions total.");
    console.error(err);
    recordCheck("questions total", false, err instanceof Error ? err.message : String(err));
    hints.push("questions total 조회 실패: 테이블 권한/네트워크 확인.");
  }

  try {
    const activeTrue = await countIsActive(true);
    const activeFalse = await countIsActive(false);
    console.log(`is_active distribution: true=${activeTrue}, false=${activeFalse}`);
    recordCheck("is_active distribution", true, `true=${activeTrue}, false=${activeFalse}`);
    if (activeTrue === 0) {
      hints.push("active_true=0: is_active 업데이트 또는 기본값 확인 필요.");
    }
  } catch (err) {
    console.error("Failed to read is_active distribution.");
    console.error(err);
    recordCheck(
      "is_active distribution",
      false,
      err instanceof Error ? err.message : String(err),
    );
    hints.push("is_active 분포 조회 실패: 컬럼 존재 여부/권한 확인.");
  }

  try {
    const recent = await getRecentPublicQids(5);
    const list = recent.map((row) => row.public_qid).join(", ");
    console.log(`recent public_qid (5): ${list || "none"}`);
    recordCheck("recent public_qid (5)", true, list || "none");
  } catch (err) {
    console.error("Failed to read recent public_qid.");
    console.error(err);
    recordCheck("recent public_qid (5)", false, err instanceof Error ? err.message : String(err));
    hints.push("recent public_qid 조회 실패: created_at 컬럼 확인.");
  }

  const samples = ["수학", "국어", "영어"];
  for (const q of samples) {
    try {
      const { total } = await searchTotal(q);
      console.log(`search total (q=${q}): ${total}`);
      recordCheck(`search total (q=${q})`, true, `total=${total}`);
      if (total === 0) {
        hints.push(`search 결과 0건(q=${q}): question_tokens 생성 여부 확인.`);
      }
    } catch (err) {
      console.error(`Failed to search (q=${q}).`);
      console.error(err);
      recordCheck(
        `search total (q=${q})`,
        false,
        err instanceof Error ? err.message : String(err),
      );
      hints.push(`search 실패 (q=${q}): question_tokens 테이블 권한 확인.`);
    }
  }

  if (hints.length > 0) {
    console.log("\nHints:");
    hints.forEach((hint) => console.log(`- ${hint}`));
  }

  const okCount = checks.filter((check) => check.ok).length;
  const failCount = checks.length - okCount;
  const output = {
    stamp,
    checks,
    summary: { okCount, failCount },
  };
  const logDir = path.resolve(process.cwd(), "logs", "sanity");
  mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${stamp}.json`);
  writeFileSync(logPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("Sanity check failed:", err);
  process.exitCode = 1;
});
