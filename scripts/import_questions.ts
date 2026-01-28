import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { supabase } from "../src/lib/supabaseClient";
import { tokenizeQuery } from "../src/lib/tokenize";

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/import_questions.ts <csv-file>");
    process.exitCode = 1;
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  for (const row of records) {
    const correctRate = row.correct_rate === "" ? null : Number(row.correct_rate);

    const question = {
      public_qid: row.public_qid,
      org_code2: row.org_code2,
      subject_code2: row.subject_code2,
      year: Number(row.year),
      month: Number(row.month),
      number: Number(row.number),
      unit: row.unit,
      qtype: row.qtype,
      correct_rate: Number.isNaN(correctRate) ? null : correctRate,
      pdf_url: row.pdf_url,
      page_no: Number(row.page_no),
      bbox: {
        x: Number(row.bbox_x),
        y: Number(row.bbox_y),
        w: Number(row.bbox_w),
        h: Number(row.bbox_h),
      },
    };

    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .upsert(question, { onConflict: "public_qid" })
      .select("id")
      .single();

    if (questionError) {
      console.error("Failed to upsert question:", questionError);
      process.exitCode = 1;
      continue;
    }

    const questionId = questionData.id;
    // raw_text is only used for tokenization; never store it in the DB.
    const { tokens, bigrams, trigrams } = tokenizeQuery(row.raw_text || "");

    const { error: tokenError } = await supabase
      .from("question_tokens")
      .upsert(
        {
          question_id: questionId,
          tokens,
          bigrams,
          trigrams,
        },
        { onConflict: "question_id" },
      );

    if (tokenError) {
      console.error("Failed to upsert tokens:", tokenError);
      process.exitCode = 1;
      continue;
    }

    console.log(`Imported ${row.public_qid}`);
  }
}

run().catch((error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
