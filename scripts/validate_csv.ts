import { readFileSync } from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

type Options = {
  file: string;
  limit: number | null;
};

type RuleKey =
  | "public_qid"
  | "org_subject"
  | "year_month_number_page"
  | "correct_rate"
  | "bbox_norm"
  | "bbox_px";

type RuleStat = {
  label: string;
  failed: number;
  total: number;
  example: string | null;
  note?: string;
};

const DEFAULT_LIMIT: number | null = null;

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npx tsx scripts/validate_csv.ts --file <path> [--limit N]",
      "",
      "Options:",
      "  --file <path>   CSV file path (required)",
      "  --limit <n>     Limit number of rows processed",
      "  -h, --help      Show this help",
    ].join("\n"),
  );
}

function parsePositiveInt(value: string, label: string): number {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(trimmed);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: "",
    limit: DEFAULT_LIMIT,
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
    if (arg === "--limit") {
      const value = argv[i + 1];
      if (!value) throw new Error("--limit requires a number");
      options.limit = parsePositiveInt(value, "--limit");
      i += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.file) {
    throw new Error("--file is required");
  }

  return options;
}

function resolveFilePath(inputPath: string) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function formatTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widths = rows[0].map((_, col) =>
    Math.max(...rows.map((row) => row[col]?.length ?? 0)),
  );
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const lines = rows.map((row) =>
    row.map((cell, col) => (cell ?? "").padEnd(widths[col])).join("  "),
  );
  return [lines[0], sep, ...lines.slice(1)].join("\n");
}

function isEmpty(value: string | undefined) {
  return value == null || value.trim() === "";
}

function isIntegerString(value: string) {
  return /^-?\d+$/.test(value.trim());
}

function parseFloatStrict(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

async function run() {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    printUsage();
    process.exit(1);
  }

  const filePath = resolveFilePath(options.file);
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read file: ${filePath}`);
    console.error(`Details: ${message}`);
    process.exit(1);
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

  const headerSet = new Set(Object.keys(limitedRecords[0] ?? {}));
  const bboxNormKeys = ["bbox_x", "bbox_y", "bbox_w", "bbox_h"] as const;
  const bboxPxKeys = ["bbox_x_px", "bbox_y_px", "bbox_w_px", "bbox_h_px"] as const;

  const bboxNormPresent = bboxNormKeys.filter((k) => headerSet.has(k));
  const bboxPxPresent = bboxPxKeys.filter((k) => headerSet.has(k));
  const schemaErrors: string[] = [];

  if (bboxNormPresent.length > 0 && bboxNormPresent.length < bboxNormKeys.length) {
    schemaErrors.push(
      `Missing bbox columns: expected ${bboxNormKeys.join(", ")}; found ${bboxNormPresent.join(", ")}`,
    );
  }
  if (bboxPxPresent.length > 0 && bboxPxPresent.length < bboxPxKeys.length) {
    schemaErrors.push(
      `Missing bbox_px columns: expected ${bboxPxKeys.join(", ")}; found ${bboxPxPresent.join(", ")}`,
    );
  }

  const ruleStats: Record<RuleKey, RuleStat> = {
    public_qid: { label: "public_qid (12 digits)", failed: 0, total: 0, example: null },
    org_subject: {
      label: "org_code2/subject_code2 (2 chars)",
      failed: 0,
      total: 0,
      example: null,
    },
    year_month_number_page: {
      label: "year/month/number/page_no (int)",
      failed: 0,
      total: 0,
      example: null,
    },
    correct_rate: {
      label: "correct_rate (0-100 number)",
      failed: 0,
      total: 0,
      example: null,
    },
    bbox_norm: { label: "bbox (0-1 floats)", failed: 0, total: 0, example: null },
    bbox_px: { label: "bbox_px (int pixels, null ok)", failed: 0, total: 0, example: null },
  };

  if (bboxNormPresent.length === 0) {
    ruleStats.bbox_norm.note = "n/a (missing columns)";
  }
  if (bboxPxPresent.length === 0) {
    ruleStats.bbox_px.note = "n/a (missing columns)";
  }

  const rowErrors: Array<{ rowNumber: number; public_qid: string; errors: string[] }> = [];

  const recordFailure = (rule: RuleKey, message: string, errors: string[]) => {
    ruleStats[rule].failed += 1;
    if (!ruleStats[rule].example) ruleStats[rule].example = message;
    errors.push(message);
  };

  limitedRecords.forEach((row, index) => {
    const rowNumber = index + 1;
    const errors: string[] = [];
    const public_qid = (row.public_qid ?? "").trim();

    ruleStats.public_qid.total += 1;
    if (!/^[0-9]{12}$/.test(public_qid)) {
      recordFailure("public_qid", `public_qid invalid: ${public_qid || "(empty)"}`, errors);
    }

    ruleStats.org_subject.total += 1;
    const org_code2 = (row.org_code2 ?? "").trim();
    const subject_code2 = (row.subject_code2 ?? "").trim();
    if (!/^[A-Z0-9]{2}$/.test(org_code2)) {
      recordFailure("org_subject", `org_code2 invalid: ${org_code2 || "(empty)"}`, errors);
    }
    if (!/^[A-Z0-9]{2}$/.test(subject_code2)) {
      recordFailure(
        "org_subject",
        `subject_code2 invalid: ${subject_code2 || "(empty)"}`,
        errors,
      );
    }

    ruleStats.year_month_number_page.total += 1;
    const intFields = [
      ["year", row.year],
      ["month", row.month],
      ["number", row.number],
      ["page_no", row.page_no],
    ] as const;
    intFields.forEach(([label, value]) => {
      const raw = value ?? "";
      if (isEmpty(raw)) {
        recordFailure("year_month_number_page", `${label} missing`, errors);
        return;
      }
      if (!isIntegerString(raw)) {
        recordFailure("year_month_number_page", `${label} not int: ${raw}`, errors);
      }
    });

    ruleStats.correct_rate.total += 1;
    const correctRateRaw = row.correct_rate ?? "";
    if (isEmpty(correctRateRaw)) {
      recordFailure("correct_rate", "correct_rate missing", errors);
    } else {
      const parsed = parseFloatStrict(correctRateRaw);
      if (parsed === null) {
        recordFailure("correct_rate", `correct_rate not number: ${correctRateRaw}`, errors);
      } else if (parsed < 0 || parsed > 100) {
        recordFailure("correct_rate", `correct_rate out of range: ${parsed}`, errors);
      }
    }

    if (bboxNormPresent.length === bboxNormKeys.length) {
      ruleStats.bbox_norm.total += 1;
      const bboxValues = bboxNormKeys.map((key) => row[key]);
      const allEmpty = bboxValues.every((value) => isEmpty(value));
      if (!allEmpty) {
        const anyEmpty = bboxValues.some((value) => isEmpty(value));
        if (anyEmpty) {
          recordFailure("bbox_norm", "bbox requires all bbox_x/y/w/h", errors);
        } else {
          bboxNormKeys.forEach((key) => {
            const raw = row[key] ?? "";
            const parsed = parseFloatStrict(raw);
            if (parsed === null) {
              recordFailure("bbox_norm", `${key} not number: ${raw}`, errors);
            } else if (parsed < 0 || parsed > 1) {
              recordFailure("bbox_norm", `${key} out of range: ${parsed}`, errors);
            }
          });
        }
      }
    }

    if (bboxPxPresent.length === bboxPxKeys.length) {
      ruleStats.bbox_px.total += 1;
      bboxPxKeys.forEach((key) => {
        const raw = row[key] ?? "";
        if (isEmpty(raw)) return;
        if (!isIntegerString(raw)) {
          recordFailure("bbox_px", `${key} not int: ${raw}`, errors);
        }
      });
    }

    if (errors.length > 0) {
      rowErrors.push({ rowNumber, public_qid: public_qid || "(empty)", errors });
    }
  });

  const tableRows: string[][] = [
    ["Rule", "Failed", "Total", "Example"],
    ...(
      [
        "public_qid",
        "org_subject",
        "year_month_number_page",
        "correct_rate",
        "bbox_norm",
        "bbox_px",
      ] as RuleKey[]
    ).map((key) => {
      const stat = ruleStats[key];
      const example = stat.note ? stat.note : stat.example ?? "";
      return [stat.label, String(stat.failed), String(stat.total), example];
    }),
  ];

  console.log(`Rows checked: ${limitedRecords.length}`);
  console.log(formatTable(tableRows));

  if (schemaErrors.length > 0) {
    console.error("Schema errors:");
    schemaErrors.forEach((message) => console.error(`- ${message}`));
  }

  if (rowErrors.length > 0) {
    console.error("Row errors (first 20):");
    rowErrors.slice(0, 20).forEach((row) => {
      console.error(
        `Row ${row.rowNumber} (public_qid=${row.public_qid}): ${row.errors.join("; ")}`,
      );
    });
  }

  if (schemaErrors.length > 0 || rowErrors.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
