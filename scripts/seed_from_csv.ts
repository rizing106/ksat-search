import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { supabaseAdmin } from "./supabaseAdmin";

type Options = {
  file: string;
  limit: number;
  dryRun: boolean;
  analyze: boolean;
  manifest: boolean;
};

type CodeStats = {
  totalRows: number;
  unique: number;
  invalid: number;
  existing: number;
  inserted: number;
};

type Summary = {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  file: string;
  limit: number;
  dry_run: boolean;
  analyze: boolean;
  orgs: {
    unique: number;
    existing: number;
    inserted: number;
    invalid: number;
  };
  subjects: {
    unique: number;
    existing: number;
    inserted: number;
    invalid: number;
  };
  rpc_import: { ok: boolean; error?: string };
  analyze_result: { ok: boolean; error?: string };
};

const DEFAULT_LIMIT = 0;
const CODE2_REGEX = /^[A-Z0-9]{2}$/;

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npx tsx scripts/seed_from_csv.ts --file <path> [--limit N] [--dry-run] [--analyze]",
      "",
      "Options:",
      "  --file <path>   CSV file path (required)",
      "  --limit <n>     Limit number of rows processed (0 = all)",
      "  --dry-run       Parse only; no DB writes/RPC",
      "  --analyze       Call ops_analyze() after successful seed",
      "  --manifest      Write logs/manifest.json with public_qids",
      "  -h, --help      Show this help",
    ].join("\n"),
  );
}

function parsePositiveInt(value: string, label: string): number {
  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return Number(trimmed);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    file: "",
    limit: DEFAULT_LIMIT,
    dryRun: false,
    analyze: false,
    manifest: false,
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
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--analyze") {
      options.analyze = true;
      continue;
    }
    if (arg === "--manifest") {
      options.manifest = true;
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

function writeManifest(filePath: string, rowsProcessed: number, publicQids: string[]) {
  const manifestPath = path.resolve(process.cwd(), "logs", "manifest.json");
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  const payload = {
    file: filePath,
    processed_at: new Date().toISOString(),
    rows_processed: rowsProcessed,
    public_qids: publicQids,
  };
  writeFileSync(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function collectCodes(
  records: Array<Record<string, string>>,
  key: "org_code2" | "subject_code2",
): { codes: Set<string>; invalid: number } {
  const codes = new Set<string>();
  let invalid = 0;
  records.forEach((row) => {
    const raw = (row[key] ?? "").trim();
    if (!raw) {
      invalid += 1;
      return;
    }
    const upper = raw.toUpperCase();
    if (!CODE2_REGEX.test(upper)) {
      invalid += 1;
      return;
    }
    codes.add(upper);
  });
  return { codes, invalid };
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function fetchExistingCodes(table: "organizations" | "subjects", codes: string[]) {
  const existing = new Set<string>();
  const chunks = chunkArray(codes, 500);
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("code2")
      .in("code2", chunk);
    if (error) {
      throw new Error(`${table} lookup failed: ${error.message}`);
    }
    data?.forEach((row) => existing.add(row.code2));
  }
  return existing;
}

async function insertMissingOrgs(codes: string[]) {
  if (codes.length === 0) return 0;
  const payload = codes.map((code2) => ({
    code2,
    name: `AUTO_${code2}`,
    kind: "official",
  }));

  const { error, data } = await supabaseAdmin
    .from("organizations")
    .upsert(payload, { onConflict: "code2", ignoreDuplicates: true })
    .select("code2");
  if (error) throw new Error(`organizations insert failed: ${error.message}`);
  return data?.length ?? 0;
}

async function insertMissingSubjects(codes: string[]) {
  if (codes.length === 0) return 0;
  const payload = codes.map((code2) => ({
    code2,
    name: `AUTO_${code2}`,
  }));

  const { error, data } = await supabaseAdmin
    .from("subjects")
    .upsert(payload, { onConflict: "code2", ignoreDuplicates: true })
    .select("code2");
  if (error) throw new Error(`subjects insert failed: ${error.message}`);
  return data?.length ?? 0;
}

async function run() {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  const errors: string[] = [];
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

  const filePath = resolveFilePath(options.file);
  const summaryPath = path.resolve(process.cwd(), "logs", "ingest_summary.json");
  let orgStats: CodeStats = {
    totalRows: 0,
    unique: 0,
    invalid: 0,
    existing: 0,
    inserted: 0,
  };
  let subjectStats: CodeStats = {
    totalRows: 0,
    unique: 0,
    invalid: 0,
    existing: 0,
    inserted: 0,
  };
  let rpcImportOk = true;
  let rpcImportError: string | undefined;
  let analyzeOk = true;
  let analyzeError: string | undefined;

  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read file: ${filePath}`);
    console.error(`Details: ${message}`);
    errors.push(`read file failed: ${message}`);
    process.exitCode = 1;
    const finishedAt = Date.now();
    const summary: Summary = {
      started_at: startedAtIso,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: finishedAt - startedAt,
      file: filePath,
      limit: options.limit,
      dry_run: options.dryRun,
      analyze: options.analyze,
      orgs: {
        unique: orgStats.unique,
        existing: orgStats.existing,
        inserted: orgStats.inserted,
        invalid: orgStats.invalid,
      },
      subjects: {
        unique: subjectStats.unique,
        existing: subjectStats.existing,
        inserted: subjectStats.inserted,
        invalid: subjectStats.invalid,
      },
      rpc_import: { ok: false, error: errors.join("; ") },
      analyze_result: { ok: false, error: errors.join("; ") },
    };
    mkdirSync(path.dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return;
  }

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const limitedRecords =
    options.limit > 0 && options.limit < records.length
      ? records.slice(0, options.limit)
      : records;
  const publicQids = limitedRecords
    .map((row) => (row.public_qid ?? "").trim())
    .filter((value) => value !== "");

  const { codes: orgCodes, invalid: orgInvalid } = collectCodes(
    limitedRecords,
    "org_code2",
  );
  const { codes: subjectCodes, invalid: subjectInvalid } = collectCodes(
    limitedRecords,
    "subject_code2",
  );

  const orgList = Array.from(orgCodes);
  const subjectList = Array.from(subjectCodes);

  if (options.dryRun) {
    console.log("Dry run enabled. No DB writes or RPC calls.");
    console.log(`File: ${filePath}`);
    console.log(`Rows processed: ${limitedRecords.length}`);
    console.log(`Unique org_code2: ${orgList.length} (invalid: ${orgInvalid})`);
    console.log(`Unique subject_code2: ${subjectList.length} (invalid: ${subjectInvalid})`);
    if (options.manifest) {
      writeManifest(filePath, limitedRecords.length, publicQids);
    }
    const finishedAt = Date.now();
    orgStats = {
      totalRows: limitedRecords.length,
      unique: orgList.length,
      invalid: orgInvalid,
      existing: 0,
      inserted: 0,
    };
    subjectStats = {
      totalRows: limitedRecords.length,
      unique: subjectList.length,
      invalid: subjectInvalid,
      existing: 0,
      inserted: 0,
    };
    const summary: Summary = {
      started_at: startedAtIso,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: finishedAt - startedAt,
      file: filePath,
      limit: options.limit,
      dry_run: options.dryRun,
      analyze: options.analyze,
      orgs: {
        unique: orgStats.unique,
        existing: orgStats.existing,
        inserted: orgStats.inserted,
        invalid: orgStats.invalid,
      },
      subjects: {
        unique: subjectStats.unique,
        existing: subjectStats.existing,
        inserted: subjectStats.inserted,
        invalid: subjectStats.invalid,
      },
      rpc_import: { ok: true },
      analyze_result: { ok: true },
    };
    mkdirSync(path.dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return;
  }

  let orgExisting = new Set<string>();
  let subjectExisting = new Set<string>();
  try {
    orgExisting = await fetchExistingCodes("organizations", orgList);
    subjectExisting = await fetchExistingCodes("subjects", subjectList);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    errors.push(message);
    process.exitCode = 1;
    rpcImportOk = false;
    rpcImportError = message;
    const finishedAt = Date.now();
    orgStats = {
      totalRows: limitedRecords.length,
      unique: orgList.length,
      invalid: orgInvalid,
      existing: orgExisting.size,
      inserted: 0,
    };
    subjectStats = {
      totalRows: limitedRecords.length,
      unique: subjectList.length,
      invalid: subjectInvalid,
      existing: subjectExisting.size,
      inserted: 0,
    };
    const summary: Summary = {
      started_at: startedAtIso,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: finishedAt - startedAt,
      file: filePath,
      limit: options.limit,
      dry_run: options.dryRun,
      analyze: options.analyze,
      orgs: {
        unique: orgStats.unique,
        existing: orgStats.existing,
        inserted: orgStats.inserted,
        invalid: orgStats.invalid,
      },
      subjects: {
        unique: subjectStats.unique,
        existing: subjectStats.existing,
        inserted: subjectStats.inserted,
        invalid: subjectStats.invalid,
      },
      rpc_import: { ok: rpcImportOk, error: rpcImportError },
      analyze_result: { ok: false, error: message },
    };
    mkdirSync(path.dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return;
  }

  const missingOrgs = orgList.filter((code2) => !orgExisting.has(code2));
  const missingSubjects = subjectList.filter((code2) => !subjectExisting.has(code2));

  let orgInserted = 0;
  let subjectInserted = 0;
  try {
    orgInserted = await insertMissingOrgs(missingOrgs);
    subjectInserted = await insertMissingSubjects(missingSubjects);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    errors.push(message);
    process.exitCode = 1;
    rpcImportOk = false;
    rpcImportError = message;
  }

  orgStats = {
    totalRows: limitedRecords.length,
    unique: orgList.length,
    invalid: orgInvalid,
    existing: orgExisting.size,
    inserted: orgInserted,
  };

  subjectStats = {
    totalRows: limitedRecords.length,
    unique: subjectList.length,
    invalid: subjectInvalid,
    existing: subjectExisting.size,
    inserted: subjectInserted,
  };

  console.log("Seed summary:");
  console.log(`File: ${filePath}`);
  console.log(`Rows processed: ${limitedRecords.length}`);
  console.log(
    `Organizations - unique: ${orgStats.unique}, existing: ${orgStats.existing}, inserted: ${orgStats.inserted}, invalid: ${orgStats.invalid}`,
  );
  console.log(
    `Subjects       - unique: ${subjectStats.unique}, existing: ${subjectStats.existing}, inserted: ${subjectStats.inserted}, invalid: ${subjectStats.invalid}`,
  );

  if (options.analyze) {
    const { error } = await supabaseAdmin.rpc("ops_analyze");
    if (error) {
      console.error(`ops_analyze failed: ${error.message}`);
      analyzeOk = false;
      analyzeError = error.message;
      process.exitCode = 1;
    } else {
      analyzeOk = true;
      console.log("ops_analyze: success");
    }
  }
  if (options.manifest) {
    writeManifest(filePath, limitedRecords.length, publicQids);
  }

  const finishedAt = Date.now();
  const summary: Summary = {
    started_at: startedAtIso,
    finished_at: new Date(finishedAt).toISOString(),
    duration_ms: finishedAt - startedAt,
    file: filePath,
    limit: options.limit,
    dry_run: options.dryRun,
    analyze: options.analyze,
    orgs: {
      unique: orgStats.unique,
      existing: orgStats.existing,
      inserted: orgStats.inserted,
      invalid: orgStats.invalid,
    },
    subjects: {
      unique: subjectStats.unique,
      existing: subjectStats.existing,
      inserted: subjectStats.inserted,
      invalid: subjectStats.invalid,
    },
    rpc_import: {
      ok: rpcImportOk,
      ...(rpcImportError ? { error: rpcImportError } : {}),
    },
    analyze_result: {
      ok: options.analyze ? analyzeOk : true,
      ...(analyzeError ? { error: analyzeError } : {}),
    },
  };
  mkdirSync(path.dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
