import { scoreRelevantFiles } from "../core/relevance";
import { CodeMapEntry, ContextSelection, GitDiffSummary, RepoFile, RepoScanResult } from "../core/types";

export interface FileSearchResult {
  path: string;
  language: string;
  estimatedTokens: number;
  gitStatus?: string;
  score: number;
  reasons: string[];
}

export interface FileSearchInput {
  query: string;
  task: string;
  scan?: RepoScanResult;
  selectedFiles?: ContextSelection[];
  openFiles?: string[];
  gitDiff?: GitDiffSummary;
  limit?: number;
}

export function searchFiles(input: FileSearchInput): FileSearchResult[] {
  if (!input.scan) {
    return [];
  }
  const query = input.query.trim().toLowerCase();
  const relevance = scoreRelevantFiles({
    task: [input.task, query].filter(Boolean).join(" "),
    files: input.scan.files,
    codeMap: input.scan.codeMap,
    selectedFiles: input.selectedFiles,
    openFiles: input.openFiles,
    gitDiff: input.gitDiff
  });
  const scoreByPath = new Map(relevance.map((item) => [item.path, item]));
  const mapByPath = new Map(input.scan.codeMap.map((entry) => [entry.path, entry]));

  return input.scan.files
    .filter((file) => !query || matchesFile(file, mapByPath.get(file.path), query))
    .map((file) => {
      const scored = scoreByPath.get(file.path);
      return {
        path: file.path,
        language: file.language,
        estimatedTokens: file.estimatedTokens,
        gitStatus: file.gitStatus,
        score: scored?.score ?? 0,
        reasons: scored?.reasons.slice(0, 4) ?? []
      };
    })
    .sort((a, b) => {
      const pathA = query && a.path.toLowerCase().includes(query) ? 1 : 0;
      const pathB = query && b.path.toLowerCase().includes(query) ? 1 : 0;
      const changedA = a.gitStatus ? 1 : 0;
      const changedB = b.gitStatus ? 1 : 0;
      return b.score - a.score || changedB - changedA || pathB - pathA || a.estimatedTokens - b.estimatedTokens || a.path.localeCompare(b.path);
    })
    .slice(0, input.limit ?? 50);
}

function matchesFile(file: RepoFile, codeMap: CodeMapEntry | undefined, query: string): boolean {
  return (
    file.path.toLowerCase().includes(query) ||
    file.language.toLowerCase().includes(query) ||
    (codeMap?.symbols.some((symbol) => symbol.name.toLowerCase().includes(query)) ?? false) ||
    (codeMap?.imports.some((item) => item.toLowerCase().includes(query)) ?? false)
  );
}
