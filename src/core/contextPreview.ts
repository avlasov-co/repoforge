import { optimizeContextBudget } from "./budgetOptimizer";
import { estimateTokensForProfile } from "./tokenizerProfiles";
import { ContextMode, ContextSelection, RelevanceScore, RepoFile, TokenBudget, TokenizerProfile } from "./types";

export interface ContextPreviewInput {
  task: string;
  selectedFiles: ContextSelection[];
  suggestedFiles: ContextSelection[];
  files: RepoFile[];
  mode: ContextMode;
  contextLimit: number;
  reservedOutput: number;
  tokenizerProfile: TokenizerProfile;
  relevanceScores?: RelevanceScore[];
  changedFiles?: string[];
}

export interface ContextPreviewBreakdown {
  path: string;
  includeMode: ContextSelection["includeMode"];
  estimatedTokens: number;
}

export interface ContextPreviewResult {
  budget: TokenBudget;
  warnings: string[];
  breakdown: ContextPreviewBreakdown[];
  likelySelections: ContextSelection[];
}

export function buildContextPreview(input: ContextPreviewInput): ContextPreviewResult {
  const merged = mergeSelections([...input.selectedFiles, ...input.suggestedFiles]);
  const fixedInputTokens = estimateTokensForProfile(
    [`mode: ${input.mode}`, input.task, "RepoForge live preview"].join("\n"),
    input.tokenizerProfile
  );
  const optimized = optimizeContextBudget({
    selectedFiles: merged,
    tokenLimit: input.contextLimit,
    reservedOutput: input.reservedOutput,
    files: input.files,
    relevanceScores: input.relevanceScores,
    changedFiles: input.changedFiles,
    fixedInputTokens
  });
  const fileByPath = new Map(input.files.map((file) => [file.path, file]));
  const breakdown = optimized.selections.map((selection) => ({
    path: selection.path,
    includeMode: selection.includeMode,
    estimatedTokens: estimateSelectionTokens(selection, fileByPath.get(selection.path)?.estimatedTokens ?? 300)
  }));
  const usedInput = fixedInputTokens + breakdown.reduce((sum, item) => sum + item.estimatedTokens, 0);
  return {
    budget: {
      limit: input.contextLimit,
      reservedOutput: input.reservedOutput,
      usedInput,
      remainingInput: input.contextLimit - input.reservedOutput - usedInput
    },
    warnings: optimized.warnings,
    breakdown,
    likelySelections: optimized.selections
  };
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

function estimateSelectionTokens(selection: ContextSelection, fileTokens: number): number {
  if (selection.includeMode === "full") {
    return fileTokens;
  }
  if (selection.includeMode === "snippet") {
    return Math.min(500, Math.ceil(fileTokens * 0.25));
  }
  if (selection.includeMode === "codemap") {
    return Math.min(180, Math.ceil(fileTokens * 0.08));
  }
  return 0;
}
