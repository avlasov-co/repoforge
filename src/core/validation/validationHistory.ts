import * as fs from "fs/promises";
import * as path from "path";
import { ValidationRunResult } from "./validationTypes";

const MAX_OUTPUT_BYTES = 100 * 1024;

export interface PersistedValidationRunResult extends ValidationRunResult {
  savedAt: string;
  truncated: boolean;
}

export interface ValidationHistoryPaths {
  rootDir: string;
  historyDir: string;
  lastValidationPath: string;
  lastValidationMarkdownPath: string;
  historyValidationPath: string;
  historyValidationMarkdownPath: string;
}

export async function getValidationHistoryPaths(repoRoot: string, generatedAt = new Date().toISOString()): Promise<ValidationHistoryPaths> {
  const rootDir = path.join(repoRoot, ".repoforge");
  const historyDir = path.join(rootDir, "history");
  await fs.mkdir(historyDir, { recursive: true });
  const safeTimestamp = generatedAt.replace(/[:.]/g, "-");

  return {
    rootDir,
    historyDir,
    lastValidationPath: path.join(rootDir, "last-validation.json"),
    lastValidationMarkdownPath: path.join(rootDir, "last-validation.md"),
    historyValidationPath: path.join(historyDir, `validation-${safeTimestamp}.json`),
    historyValidationMarkdownPath: path.join(historyDir, `validation-${safeTimestamp}.md`)
  };
}

export async function saveValidationRunResult(
  repoRoot: string,
  result: ValidationRunResult,
  markdown?: string
): Promise<ValidationHistoryPaths> {
  const paths = await getValidationHistoryPaths(repoRoot);
  const persisted = trimValidationOutput(result);
  const writes: Array<Promise<unknown>> = [
    fs.writeFile(paths.lastValidationPath, JSON.stringify(persisted, null, 2), "utf8"),
    fs.writeFile(paths.historyValidationPath, JSON.stringify(persisted, null, 2), "utf8")
  ];
  if (markdown !== undefined) {
    writes.push(
      fs.writeFile(paths.lastValidationMarkdownPath, markdown, "utf8"),
      fs.writeFile(paths.historyValidationMarkdownPath, markdown, "utf8")
    );
  }
  await Promise.all(writes);
  return paths;
}

export async function readLastValidationResult(repoRoot: string): Promise<PersistedValidationRunResult | undefined> {
  try {
    const paths = await getValidationHistoryPaths(repoRoot);
    return JSON.parse(await fs.readFile(paths.lastValidationPath, "utf8")) as PersistedValidationRunResult;
  } catch {
    return undefined;
  }
}

function trimValidationOutput(result: ValidationRunResult): PersistedValidationRunResult {
  const stdout = trimToBytes(result.stdout, MAX_OUTPUT_BYTES);
  const stderr = trimToBytes(result.stderr, MAX_OUTPUT_BYTES);
  return {
    ...result,
    stdout: stdout.value,
    stderr: stderr.value,
    truncated: stdout.truncated || stderr.truncated,
    savedAt: new Date().toISOString()
  };
}

function trimToBytes(value: string, maxBytes: number): { value: string; truncated: boolean } {
  const size = Buffer.byteLength(value, "utf8");
  if (size <= maxBytes) {
    return { value, truncated: false };
  }

  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = value.slice(0, mid);
    if (Buffer.byteLength(candidate, "utf8") <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { value: `${value.slice(0, low)}\n... [truncated]`, truncated: true };
}
