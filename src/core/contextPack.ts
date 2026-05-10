import * as fs from "fs/promises";
import { formatCodexPack } from "../formatters/codexFormatter";
import { formatLocalQwenPack } from "../formatters/localQwenFormatter";
import { optimizeContextBudget } from "./budgetOptimizer";
import { getGitDiffSummary } from "./git/gitDiff";
import { getOutputPaths } from "./outputPaths";
import { defaultTokenizerProfileForMode, estimateTokensForProfile } from "./tokenizerProfiles";
import { detectValidationCommands } from "./validationCommands";
import { readProjectMemory } from "./projectMemory";
import { readRepoFile, scanRepo } from "./repoScanner";
import { scoreRelevantFiles, suggestRelevantFiles } from "./relevance";
import { CodeMapEntry, ContextPack, ContextSelection, PackOptions, SavedContextPack } from "./types";

const DEFAULT_CONSTRAINTS = [
  "Do not delete unrelated files.",
  "Do not modify generated artifacts unless necessary.",
  "Preserve existing behavior unless the task requires a change.",
  "Prefer small, reviewable diffs."
];

export async function buildContextPack(options: PackOptions): Promise<ContextPack> {
  const scan = await scanRepo(options.repoRoot);
  const tokenizerProfile = options.tokenizerProfile ?? defaultTokenizerProfileForMode(options.mode);
  const gitDiff = await getGitDiffSummary(options.repoRoot);
  const selectedFiles = mergeSelections(options.selectedFiles);
  const suggestions = suggestRelevantFiles({
    task: options.task,
    files: scan.files,
    codeMap: scan.codeMap,
    openFiles: options.openFiles,
    selectedFiles,
    gitDiff,
    limit: options.mode === "codex" ? 12 : 30
  });

  const selectedPaths = new Set(selectedFiles.map((selection) => selection.path));
  for (const suggestion of suggestions) {
    if (!selectedPaths.has(suggestion.path)) {
      selectedFiles.push(suggestion);
      selectedPaths.add(suggestion.path);
    }
  }

  const relevance = scoreRelevantFiles({
    task: options.task,
    files: scan.files,
    codeMap: scan.codeMap,
    openFiles: options.openFiles,
    selectedFiles,
    gitDiff
  });
  const projectMemory = await readProjectMemory(options.repoRoot);
  const validationCommands = await detectValidationCommands(options.repoRoot);
  const fixedInputTokens = estimateTokensForProfile(
    [options.task, scan.summary, projectMemory ?? "", ...(options.logs ?? []), ...DEFAULT_CONSTRAINTS, ...validationCommands].join("\n"),
    tokenizerProfile
  );
  const optimized = optimizeContextBudget({
    selectedFiles,
    tokenLimit: options.tokenLimit,
    reservedOutput: options.reservedOutput,
    files: scan.files,
    relevanceScores: relevance,
    changedFiles: gitDiff.changedFiles,
    fixedInputTokens
  });

  const fullFiles = [];
  for (const selection of optimized.selections.filter((item) => item.includeMode === "full")) {
    const content = await readRepoFile(options.repoRoot, selection.path);
    if (content !== undefined) {
      fullFiles.push({ path: selection.path, content, estimatedTokens: estimateTokensForProfile(content, tokenizerProfile) });
    }
  }

  const codeMapPaths = new Set(
    optimized.selections
      .filter((item) => item.includeMode === "codemap" || item.includeMode === "full")
      .map((item) => item.path)
  );
  const codeMap = scan.codeMap.filter((entry) => codeMapPaths.has(entry.path));

  const basePack: ContextPack = {
    mode: options.mode,
    task: options.task,
    repoRoot: options.repoRoot,
    generatedAt: new Date().toISOString(),
    projectMemory,
    repoSummary: scan.summary,
    selectedFiles: optimized.selections,
    codeMap,
    fullFiles,
    logs: options.logs ?? [],
    constraints: [...DEFAULT_CONSTRAINTS],
    validationCommands,
    tokenBudget: optimized.budget,
    tokenizerProfile,
    gitDiff,
    relevance,
    budgetWarnings: optimized.warnings
  };

  const markdown = formatPack(basePack);
  const usedInput = estimateTokensForProfile(markdown, tokenizerProfile);
  basePack.tokenBudget = {
    limit: options.tokenLimit,
    reservedOutput: options.reservedOutput,
    usedInput,
    remainingInput: options.tokenLimit - options.reservedOutput - usedInput
  };
  if (basePack.tokenBudget.remainingInput < 0) {
    basePack.budgetWarnings = [
      ...(basePack.budgetWarnings ?? []),
      `Context pack exceeds input budget by ${Math.abs(basePack.tokenBudget.remainingInput)} estimated tokens.`
    ];
  }
  return basePack;
}

export async function saveContextPack(pack: ContextPack): Promise<SavedContextPack> {
  const paths = await getOutputPaths(pack.repoRoot, pack.generatedAt);
  const markdown = formatPack(pack);
  const json = JSON.stringify(pack, null, 2);

  await Promise.all([
    fs.writeFile(paths.lastContextMarkdownPath, markdown, "utf8"),
    fs.writeFile(paths.lastContextJsonPath, json, "utf8"),
    fs.writeFile(paths.historyContextMarkdownPath, markdown, "utf8"),
    fs.writeFile(paths.historyContextJsonPath, json, "utf8")
  ]);

  return { pack, markdown, markdownPath: paths.lastContextMarkdownPath, jsonPath: paths.lastContextJsonPath };
}

export function formatPack(pack: ContextPack): string {
  return pack.mode === "codex" ? formatCodexPack(pack) : formatLocalQwenPack(pack);
}

function mergeSelections(selections: ContextSelection[]): ContextSelection[] {
  const byPath = new Map<string, ContextSelection>();
  for (const selection of selections) {
    if (selection.includeMode === "none") {
      continue;
    }
    const existing = byPath.get(selection.path);
    if (!existing || existing.includeMode !== "full") {
      byPath.set(selection.path, selection);
    }
  }
  return [...byPath.values()];
}

export function filterCodeMap(entries: CodeMapEntry[], paths: string[]): CodeMapEntry[] {
  const wanted = new Set(paths);
  return entries.filter((entry) => wanted.has(entry.path));
}
