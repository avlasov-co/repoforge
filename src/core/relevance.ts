import { CodeMapEntry, ContextSelection, GitDiffSummary, RelevanceScore, RepoFile } from "./types";

export interface RelevanceInput {
  task: string;
  files: RepoFile[];
  codeMap: CodeMapEntry[];
  openFiles?: string[];
  selectedFiles?: ContextSelection[];
  gitDiff?: GitDiffSummary;
  limit?: number;
}

export function scoreRelevantFiles(input: RelevanceInput): RelevanceScore[] {
  const keywords = tokenize(input.task);
  const codeMapByPath = new Map(input.codeMap.map((entry) => [entry.path, entry]));
  const openFiles = new Set((input.openFiles ?? []).map(normalizeSlash));
  const selectedFiles = new Set((input.selectedFiles ?? []).map((selection) => normalizeSlash(selection.path)));
  const changedFiles = new Set(input.gitDiff?.changedFiles ?? []);
  const hunkFiles = new Set(input.gitDiff?.hunks.map((hunk) => hunk.filePath) ?? []);
  const wantsTests = /\b(test|tests|failing|failure|vitest|jest|pytest|spec)\b/i.test(input.task);
  const wantsConfig = /\b(config|build|package|dependency|dependencies|tsconfig|vite|webpack|eslint)\b/i.test(input.task);

  return input.files
    .map((file) => {
      const map = codeMapByPath.get(file.path);
      let score = 0;
      const reasons: string[] = [];

      if (selectedFiles.has(file.path)) {
        score += 30;
        reasons.push("manual selection");
      }
      if (openFiles.has(file.path)) {
        score += 12;
        reasons.push("currently open");
      }
      if (file.gitStatus || changedFiles.has(file.path)) {
        score += 16;
        reasons.push("has git changes");
      }
      if (hunkFiles.has(file.path)) {
        score += 12;
        reasons.push("contains changed hunks");
      }

      for (const keyword of keywords) {
        if (file.path.toLowerCase().includes(keyword)) {
          score += 6;
          reasons.push(`matches task keyword: ${keyword}`);
        }
        const symbol = map?.symbols.find((item) => item.name.toLowerCase().includes(keyword));
        if (symbol) {
          score += 5;
          reasons.push(`symbol match: ${symbol.name}`);
        }
        const importMatch = map?.imports.find((item) => item.toLowerCase().includes(keyword));
        if (importMatch) {
          score += 3;
          reasons.push(`import match: ${keyword}`);
        }
      }

      if (wantsTests && isTestRelated(file.path)) {
        score += 8;
        reasons.push("test-related file for test task");
      }
      if (wantsConfig && isConfigRelated(file.path)) {
        score += 8;
        reasons.push("config/build file for config task");
      }

      return { path: file.path, score, reasons: unique(reasons) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

export function suggestRelevantFiles(input: RelevanceInput): ContextSelection[] {
  return scoreRelevantFiles(input)
    .slice(0, input.limit ?? 20)
    .map((item) => ({
      path: item.path,
      includeMode: "codemap",
      score: item.score,
      reasons: item.reasons,
      reason: `relevance score ${item.score}: ${item.reasons.slice(0, 3).join("; ")}`
    }));
}

function tokenize(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9_/-]+/).filter((part) => part.length >= 3))];
}

function normalizeSlash(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isTestRelated(filePath: string): boolean {
  return /(^|\/)(test|tests|__tests__)\/|(\.test|\.spec)\.[a-z]+$/i.test(filePath);
}

function isConfigRelated(filePath: string): boolean {
  return /(^|\/)(package\.json|tsconfig\.json|vite\.config|webpack\.config|eslint\.config|rollup\.config|Cargo\.toml|pyproject\.toml|go\.mod)$/i.test(filePath);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
