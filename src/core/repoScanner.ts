import * as fs from "fs/promises";
import * as path from "path";
import { extractCodeMap } from "./codeMap";
import { getGitStatus } from "./git/gitStatus";
import { IgnoreMatcher, loadIgnoreRules, shouldIgnore as shouldIgnorePath } from "./ignoreRules";
import { estimateTokens } from "./tokenEstimator";
import { CodeMapEntry, RepoFile, RepoScanResult } from "./types";

export const MAX_FULL_READ_BYTES = 1024 * 1024;
const TOKEN_SAMPLE_BYTES = 64 * 1024;

export function shouldIgnore(filePath: string, ignoreMatcher?: IgnoreMatcher): boolean {
  return shouldIgnorePath(filePath, ignoreMatcher);
}

export function languageForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".md": "markdown",
    ".json": "json",
    ".toml": "toml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".html": "html",
    ".css": "css"
  };
  if (base === "makefile") {
    return "makefile";
  }
  return map[ext] ?? "text";
}

export async function scanRepo(repoRoot: string): Promise<RepoScanResult> {
  const gitStatus = await getGitStatus(repoRoot);
  const ignoreMatcher = await loadIgnoreRules(repoRoot);
  const files: RepoFile[] = [];
  const codeMap: CodeMapEntry[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = path.relative(repoRoot, absolutePath);
      if (!relativePath || shouldIgnore(relativePath, ignoreMatcher)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      try {
        const stat = await fs.stat(absolutePath);
        const language = languageForPath(relativePath);
        let content: string | undefined;
        if (stat.size <= MAX_FULL_READ_BYTES) {
          content = await fs.readFile(absolutePath, "utf8");
        }
        const estimatedTokens = content !== undefined ? estimateTokens(content) : await estimateLargeFileTokens(absolutePath, stat.size);
        const file: RepoFile = {
          path: normalizePath(relativePath),
          absolutePath,
          language,
          sizeBytes: stat.size,
          estimatedTokens,
          modifiedTimeMs: stat.mtimeMs,
          gitStatus: gitStatus.get(normalizePath(relativePath))
        };
        files.push(file);
        if (content !== undefined) {
          codeMap.push(extractCodeMap(file.path, language, content, estimatedTokens, absolutePath));
        }
      } catch {
        continue;
      }
    }
  }

  await walk(repoRoot);
  files.sort((a, b) => a.path.localeCompare(b.path));
  codeMap.sort((a, b) => a.path.localeCompare(b.path));
  return {
    repoRoot,
    files,
    codeMap,
    summary: summarizeRepo(files)
  };
}

export async function readRepoFile(repoRoot: string, relativePath: string): Promise<string | undefined> {
  const normalized = normalizePath(relativePath);
  const absolutePath = path.resolve(repoRoot, normalized);
  if (!absolutePath.startsWith(path.resolve(repoRoot) + path.sep) && absolutePath !== path.resolve(repoRoot)) {
    return undefined;
  }
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile() || stat.size > MAX_FULL_READ_BYTES) {
    return undefined;
  }
  return fs.readFile(absolutePath, "utf8");
}

export function summarizeRepo(files: RepoFile[]): string {
  const byLanguage = new Map<string, number>();
  for (const file of files) {
    byLanguage.set(file.language, (byLanguage.get(file.language) ?? 0) + 1);
  }
  const topLanguages = [...byLanguage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([language, count]) => `${language}: ${count}`)
    .join(", ");
  const tokens = files.reduce((sum, file) => sum + file.estimatedTokens, 0);
  return `${files.length} files scanned. Estimated repository tokens: ${tokens}. Languages: ${topLanguages || "none"}.`;
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

async function estimateLargeFileTokens(absolutePath: string, sizeBytes: number): Promise<number> {
  const handle = await fs.open(absolutePath, "r");
  try {
    const sampleSize = Math.min(sizeBytes, TOKEN_SAMPLE_BYTES);
    const buffer = Buffer.alloc(sampleSize);
    const read = await handle.read(buffer, 0, sampleSize, 0);
    const sampleText = buffer.subarray(0, read.bytesRead).toString("utf8");
    const sampleTokens = estimateTokens(sampleText);
    return Math.ceil((sampleTokens / Math.max(1, read.bytesRead)) * sizeBytes);
  } finally {
    await handle.close();
  }
}
