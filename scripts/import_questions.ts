import { readFileSync } from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { supabaseAdmin } from "./supabaseAdmin";
import { tokenizeQuery } from "../src/lib/tokenize";

type Options = {
  file: string;
  dryRun: boolean;
  limit: number | null;
  batch: number;
  debugRow: boolean;
};

type ImportRow = {
  public_qid: string;
  org_code2: string;
  subject_code2: string;
  year: number | null;
  month: number | null;
  number: number | null;
  unit: string;
  qtype: string;
  correct_rate: number | null;
  pdf_url: string;
  page_no: number | null;
  bbox: { x: number; y: number; w: number; h: number };
  bbox_x: null;
  bbox_y: null;
  bbox_w: null;
  bbox_h: null;
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
      "Usage:",
      "  npx tsx scripts/import_questions.ts --file <path> [--limit N] [--dry-run] [--batch N] [--debug-row]",
      "",
      "Options:",
      `  --file <path>   CSV file path (default: ${DEFAULT_FILE})`,
      "  --dry-run       Parse/validate only; no DB writes",
      "  --limit <n>     Limit number of rows processed",
      `  --batch <n>     Batch size (default: ${DEFAULT_BATCH})`,
      "  --debug-row     Print first payload JSON and exit",
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
    debugRow: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      const value = argv[i + 1];
      if (!value) throw new Error("--file requires a path");
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
      if (!value) throw new Error("--limit requires a number");
      options.limit = parsePositiveInt(value, "--limit");
      i += 1;
      continue;
    }
    if (arg === "--batch") {
      const value = argv[i + 1];
      if (!value) throw new Error("--batch requires a number");
      options.batch = parsePositiveInt(value, "--batch");
      i += 1;
      continue;
    }
    if (arg === "--debug-row") {
      options.debugRow = true;
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
    const { error } = await supabaseAdmin.from("organizations").select("code2").limit(1);
    if (error) throw new Error(error.message);
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

    const rowPreview = {
      public_qid,
      org_code2: row.org_code2,
      subject_code2: row.subject_code2,
      year: row.year,
      month: row.month,
      number: row.number,
      page_no: row.page_no,
      bbox_x: row.bbox_x,
      bbox_y: row.bbox_y,
      bbox_w: row.bbox_w,
      bbox_h: row.bbox_h,
      correct_rate: row.correct_rate,
    };

    const parseIntField = (value: string | undefined, field: string): number | null => {
      const raw = (value ?? "").trim();
      if (!raw) return null;
      if (raw.includes(".")) {
        throw new Error(
          `Decimal value in integer field: ${field}=${raw} (row=${JSON.stringify(rowPreview)})`,
        );
      }
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const parseFloatField = (value: string | undefined): number | null => {
      const raw = (value ?? "").trim();
      if (!raw) return null;
      const parsed = parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const year = parseIntField(row.year, "year");
    const month = parseIntField(row.month, "month");
    const number = parseIntField(row.number, "number");
    const page_no = parseIntField(row.page_no, "page_no");
    const correct_rate = parseFloatField(row.correct_rate);
    if (row.correct_rate && correct_rate === null) {
      errors.push("correct_rate must be a number");
    }

    if (!Number.isInteger(year)) errors.push("year must be an integer");
    if (!Number.isInteger(month)) errors.push("month must be an integer");
    if (!Number.isInteger(number)) errors.push("number must be an integer");
    if (!Number.isInteger(page_no)) errors.push("page_no must be an integer");

    const bboxRaw = {
      x: parseFloatField(row.bbox_x),
      y: parseFloatField(row.bbox_y),
      w: parseFloatField(row.bbox_w),
      h: parseFloatField(row.bbox_h),
    };

    const missingBbox = (["x", "y", "w", "h"] as const).filter(
      (key) => bboxRaw[key] === null,
    );
    if (missingBbox.length > 0) {
      throw new Error(
        `Missing bbox fields for public_qid=${public_qid}: ${missingBbox.join(", ")}`,
      );
    }

    const bbox = {
      x: bboxRaw.x as number,
      y: bboxRaw.y as number,
      w: bboxRaw.w as number,
      h: bboxRaw.h as number,
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

    const metaText = [row.unit, row.qtype].filter(Boolean).join(" ");
    const rawText = row.raw_text || "";
    const { tokens: baseTokens, bigrams: baseBigrams, trigrams: baseTrigrams } =
      tokenizeQuery(rawText);
    const { tokens: metaTokens, bigrams: metaBigrams, trigrams: metaTrigrams } =
      tokenizeQuery(metaText);
    const tokens = Array.from(new Set([...baseTokens, ...metaTokens]));
    const bigrams = Array.from(new Set([...baseBigrams, ...metaBigrams]));
    const trigrams = Array.from(new Set([...baseTrigrams, ...metaTrigrams]));

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
        bbox_x: null,
        bbox_y: null,
        bbox_w: null,
        bbox_h: null,
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

function resolveFilePath(inputPath: string) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
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

  if (!options.debugRow) {
    if (!(await assertDbConnection())) return;
  }

  const filePath = resolveFilePath(options.file);
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read file: ${filePath}`);
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

  let prepared: PreparedRow[] = [];
  let validationFailed = 0;
  try {
    const result = validateAndPrepareRows(limitedRecords);
    prepared = result.prepared;
    validationFailed = result.failed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
    return;
  }

  let successCount = 0;
  let failedCount = validationFailed;

  if (options.debugRow) {
    if (prepared.length === 0) {
      console.log("No valid rows to preview.");
    } else {
      console.log(JSON.stringify(prepared[0].payload, null, 2));
    }
    return;
  }

  if (options.dryRun) {
    successCount = prepared.length;
    console.log("Dry run enabled. No DB writes performed.");
  } else {
    for (let i = 0; i < prepared.length; i += options.batch) {
      const batchRows = prepared.slice(i, i + options.batch);
      const payload = batchRows.map((row) => row.payload);

      const { error } = await supabaseAdmin.rpc("import_questions_batch", { rows: payload });
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
  console.log(`Failed: ${failedCount}`);
  console.log(`Duration: ${formatDuration(duration)}`);
}

run().catch((error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
