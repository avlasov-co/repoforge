import { BudgetOptimizationResult, ContextSelection, RelevanceScore, RepoFile, TokenBudget } from "./types";

export interface BudgetOptimizerInput {
  selectedFiles: ContextSelection[];
  tokenLimit: number;
  reservedOutput: number;
  files: RepoFile[];
  relevanceScores?: RelevanceScore[];
  changedFiles?: string[];
  fixedInputTokens?: number;
}

export function optimizeContextBudget(input: BudgetOptimizerInput): BudgetOptimizationResult {
  const fileByPath = new Map(input.files.map((file) => [file.path, file]));
  const scoreByPath = new Map((input.relevanceScores ?? []).map((score) => [score.path, score.score]));
  const changed = new Set(input.changedFiles ?? []);
  const warnings: string[] = [];
  const selections = input.selectedFiles
    .filter((selection) => selection.includeMode !== "none")
    .map((selection) => ({ ...selection }));

  const available = Math.max(0, input.tokenLimit - input.reservedOutput);
  let used = estimateSelections(selections, fileByPath) + (input.fixedInputTokens ?? 0);

  const downgradeOrder = () =>
    selections
      .map((selection, index) => ({
        selection,
        index,
        priority: priorityFor(selection, scoreByPath.get(selection.path) ?? selection.score ?? 0, changed.has(selection.path))
      }))
      .sort((a, b) => a.priority - b.priority || a.selection.path.localeCompare(b.selection.path));

  for (const item of downgradeOrder()) {
    if (used <= available) {
      break;
    }
    if (item.selection.includeMode !== "full" || isManualFull(item.selection)) {
      continue;
    }
    item.selection.includeMode = "snippet";
    warnings.push(`Downgraded ${item.selection.path} from full to snippet to fit the context budget.`);
    used = estimateSelections(selections, fileByPath) + (input.fixedInputTokens ?? 0);
  }

  for (const item of downgradeOrder()) {
    if (used <= available) {
      break;
    }
    if (item.selection.includeMode !== "snippet") {
      continue;
    }
    item.selection.includeMode = "codemap";
    warnings.push(`Downgraded ${item.selection.path} from snippet to codemap to fit the context budget.`);
    used = estimateSelections(selections, fileByPath) + (input.fixedInputTokens ?? 0);
  }

  for (const item of downgradeOrder()) {
    if (used <= available) {
      break;
    }
    if (item.selection.includeMode !== "codemap" || isManual(item.selection) || changed.has(item.selection.path)) {
      continue;
    }
    item.selection.includeMode = "none";
    warnings.push(`Dropped codemap entry for ${item.selection.path} to fit the context budget.`);
    used = estimateSelections(selections, fileByPath) + (input.fixedInputTokens ?? 0);
  }

  if (used > available) {
    const selectedFull = selections.filter((selection) => selection.includeMode === "full" && isManualFull(selection));
    if (selectedFull.length) {
      warnings.push(`Context still exceeds budget; manual full files were preserved: ${selectedFull.map((item) => item.path).join(", ")}.`);
    } else {
      warnings.push(`Context still exceeds budget by ${used - available} estimated tokens after optimization.`);
    }
  }

  const budget: TokenBudget = {
    limit: input.tokenLimit,
    reservedOutput: input.reservedOutput,
    usedInput: used,
    remainingInput: input.tokenLimit - input.reservedOutput - used
  };

  return {
    selections: selections.filter((selection) => selection.includeMode !== "none"),
    budget,
    warnings
  };
}

function priorityFor(selection: ContextSelection, relevance: number, changed: boolean): number {
  let priority = relevance;
  if (changed) {
    priority += 50;
  }
  if (isManual(selection)) {
    priority += 100;
  }
  if (selection.includeMode === "full") {
    priority += 10;
  }
  return priority;
}

function isManual(selection: ContextSelection): boolean {
  return /manual|selected|current file|open editor|test/i.test(selection.reason ?? "") || selection.reasons?.includes("manual selection") === true;
}

function isManualFull(selection: ContextSelection): boolean {
  return selection.includeMode === "full" && isManual(selection);
}

function estimateSelections(selections: ContextSelection[], fileByPath: Map<string, RepoFile>): number {
  return selections.reduce((sum, selection) => {
    if (selection.includeMode === "none") {
      return sum;
    }
    const fileTokens = fileByPath.get(selection.path)?.estimatedTokens ?? 300;
    if (selection.includeMode === "full") {
      return sum + fileTokens;
    }
    if (selection.includeMode === "snippet") {
      return sum + Math.min(500, Math.ceil(fileTokens * 0.25));
    }
    return sum + Math.min(180, Math.ceil(fileTokens * 0.08));
  }, 0);
}
