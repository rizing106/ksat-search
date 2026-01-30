import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { supabase } from "../src/lib/supabaseClient";
import { tokenizeQuery } from "../src/lib/tokenize";

type Options = {
  file: string;
  dryRun: boolean;
  limit: number | null;
  batch: number;
};

type ImportRow = {
  public_qid: string;
  org_code2: string;
  subject_code2: string;
  year: number;
  month: number;
  number: number;
  unit: string;
  qtype: string;
  correct_rate: number | null;
  pdf_url: string;
  page_no: number;
  bbox: { x: number; y: number; w: number; h: number };
  tokens: string[];
  bigrams: string[];
  trigrams: string[];
};

type PreparedRow = {
  rowNumber: number;
  public_qid: string;
  payload: ImportRow;
};

const DEFAULT_FILE = "data/questions.sample.csv";
const DEFAULT_BATCH = 500;

function printUsage() {
  console.log(
    [
      "Usage: node scripts/import_questions.ts [options]",
      "",
      "Options:",
      `  --file <path>   CSV file path (default: ${DEFAULT_FILE})`,
      "  --dry-run       Parse/validate only; no DB writes",
      "  --limit <n>     Limit number of rows processed",
      `  --batch <n>     Batch size (default: ${DEFAULT_BATCH})`,
      "  -h, --help      Show this help",
    ].join("\n"),
  );
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: DEFAULT_FILE,
    dryRun: false,
    limit: null,
    batch: DEFAULT_BATCH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--file requires a path");
      }
      options.file = value;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--limit") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--limit requires a number");
      }
      options.limit = parsePositiveInt(value, "--limit");
      i += 1;
      continue;
    }
    if (arg === "--batch") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--batch requires a number");
      }
      options.batch = parsePositiveInt(value, "--batch");
      i += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

async function assertDbConnection() {
  try {
    const { error } = await supabase.from("organizations").select("code2").limit(1);
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DB connection failed. Check Supabase URL/key and permissions.");
    console.error(`Details: ${message}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function validateAndPrepareRows(
  records: Array<Record<string, string>>,
): { prepared: PreparedRow[]; failed: number } {
  const prepared: PreparedRow[] = [];
  let failed = 0;

  records.forEach((row, index) => {
    const rowNumber = index + 1;
    const errors: string[] = [];

    const public_qid = row.public_qid?.trim();
    if (!public_qid) {
      errors.push("public_qid is required");
    } else if (!/^\d{12}$/.test(public_qid)) {
      errors.push("public_qid must be 12 digits");
    }

    const requiredFields = [
      ["org_code2", row.org_code2],
      ["subject_code2", row.subject_code2],
      ["unit", row.unit],
      ["qtype", row.qtype],
      ["pdf_url", row.pdf_url],
    ] as const;

    requiredFields.forEach(([field, value]) => {
      if (!value || value.trim() === "") {
        errors.push(`${field} is required`);
      }
    });

    const year = Number(row.year);
    const month = Number(row.month);
    const number = Number(row.number);
    const page_no = Number(row.page_no);
    const correctRateRaw = row.correct_rate === "" ? null : Number(row.correct_rate);
    if (row.correct_rate !== "" && Number.isNaN(correctRateRaw ?? 0)) {
      errors.push("correct_rate must be a number");
    }
    const correct_rate = Number.isNaN(correctRateRaw ?? 0) ? null : correctRateRaw;

    if (!Number.isInteger(year)) errors.push("year must be an integer");
    if (!Number.isInteger(month)) errors.push("month must be an integer");
    if (!Number.isInteger(number)) errors.push("number must be an integer");
    if (!Number.isInteger(page_no)) errors.push("page_no must be an integer");

    const bbox = {
      x: Number(row.bbox_x),
      y: Number(row.bbox_y),
      w: Number(row.bbox_w),
      h: Number(row.bbox_h),
    };

    (["x", "y", "w", "h"] as const).forEach((key) => {
      const value = bbox[key];
      if (Number.isNaN(value)) {
        errors.push(`bbox_${key} must be a number`);
      } else if (value < 0 || value > 1) {
        errors.push(`bbox_${key} must be between 0 and 1`);
      }
    });

    if (errors.length > 0) {
      failed += 1;
      console.error(
        `Row ${rowNumber} (public_qid=${public_qid ?? "unknown"}): ${errors.join("; ")}`,
      );
      return;
    }

    // raw_text is only used for tokenization; never store it in the DB.
    const { tokens, bigrams, trigrams } = tokenizeQuery(row.raw_text || "");

    prepared.push({
      rowNumber,
      public_qid,
      payload: {
        public_qid,
        org_code2: row.org_code2,
        subject_code2: row.subject_code2,
        year,
        month,
        number,
        unit: row.unit,
        qtype: row.qtype,
        correct_rate,
        pdf_url: row.pdf_url,
        page_no,
        bbox,
        tokens,
        bigrams,
        trigrams,
      },
    });
  });

  return { prepared, failed };
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function run() {
  const startTime = Date.now();
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!(await assertDbConnection())) {
    return;
  }

  let content: string;
  try {
    content = readFileSync(options.file, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read file: ${options.file}`);
    console.error(`Details: ${message}`);
    process.exitCode = 1;
    return;
  }

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const limitedRecords =
    options.limit && options.limit < records.length
      ? records.slice(0, options.limit)
      : records;

  const { prepared, failed: validationFailed } = validateAndPrepareRows(limitedRecords);

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = validationFailed;

  if (options.dryRun) {
    successCount = prepared.length;
    console.log("Dry run enabled. No DB writes performed.");
  } else {
    for (let i = 0; i < prepared.length; i += options.batch) {
      const batchRows = prepared.slice(i, i + options.batch);
      const payload = batchRows.map((row) => row.payload);

      const { error } = await supabase.rpc("import_questions_batch", { rows: payload });
      if (error) {
        failedCount += batchRows.length;
        const match = /row (\d+) \(public_qid=([^)]+)\): (.+)/.exec(error.message);
        if (match) {
          const rowIndex = Number(match[1]) - 1;
          const failedRow = batchRows[rowIndex];
          const reason = match[3];
          console.error(
            `Row ${failedRow?.rowNumber ?? "unknown"} (public_qid=${
              failedRow?.public_qid ?? match[2]
            }): ${reason}`,
          );
        } else {
          console.error(`Batch starting at row ${batchRows[0].rowNumber} failed: ${error.message}`);
        }
        process.exitCode = 1;
        continue;
      }

      successCount += batchRows.length;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`Total rows: ${limitedRecords.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Duration: ${formatDuration(duration)}`);
}

run().catch((error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
