import { CodeMapEntry, ContextPack, ContextSelection } from "../core/types";

export function codeFence(language: string, content: string): string {
  const fence = content.includes("```") ? "````" : "```";
  return `${fence}${language}\n${content}\n${fence}`;
}

export function renderSelectionList(selections: ContextSelection[]): string {
  if (selections.length === 0) {
    return "- none";
  }
  return selections.map((selection) => `- ${selection.path}: ${selection.reason ?? selection.includeMode}`).join("\n");
}

export function renderCodeMap(entries: CodeMapEntry[], compact = false): string {
  if (entries.length === 0) {
    return "_No code map entries included._";
  }
  return entries
    .map((entry) => {
      const imports = compact ? entry.imports.slice(0, 8) : entry.imports;
      const symbols = compact ? entry.symbols.slice(0, 20) : entry.symbols;
      const importText = imports.length ? imports.map((item) => `  - ${item}`).join("\n") : "  - none";
      const symbolText = symbols.length
        ? symbols.map((symbol) => `  - L${symbol.line} ${symbol.kind} ${symbol.name}${symbol.signature ? `: ${symbol.signature}` : ""}`).join("\n")
        : "  - none";
      const diagnostics = entry.diagnostics?.length ? `\n\nDiagnostics:\n${entry.diagnostics.map((item) => `  - ${item}`).join("\n")}` : "";
      return `### ${entry.path}\nLanguage: ${entry.language}; backend: ${entry.backend}; estimated tokens: ${entry.estimatedTokens}\n\nImports:\n${importText}\n\nSymbols:\n${symbolText}${diagnostics}`;
    })
    .join("\n\n");
}

export function renderFullFiles(pack: ContextPack): string {
  if (pack.fullFiles.length === 0) {
    return "_No full file contents included._";
  }
  return pack.fullFiles
    .map((file) => `### ${file.path}\nEstimated tokens: ${file.estimatedTokens}\n\n${codeFence("", file.content)}`)
    .join("\n\n");
}

export function renderTokenBudget(pack: ContextPack): string {
  return [
    `- Limit: ${pack.tokenBudget.limit}`,
    `- Reserved output: ${pack.tokenBudget.reservedOutput}`,
    `- Used input: ${pack.tokenBudget.usedInput}`,
    `- Remaining input: ${pack.tokenBudget.remainingInput}`,
    `- Tokenizer profile: ${pack.tokenizerProfile}`,
    ...(pack.budgetWarnings?.map((warning) => `- Warning: ${warning}`) ?? [])
  ].join("\n");
}

export function renderConstraints(pack: ContextPack): string {
  return pack.constraints.map((constraint) => `- ${constraint}`).join("\n");
}

export function renderValidation(commands: string[]): string {
  return commands.length ? commands.map((command) => `- \`${command}\``).join("\n") : "- No validation commands detected.";
}

export function renderGitDiffSummary(pack: ContextPack): string {
  const diff = pack.gitDiff;
  if (!diff || diff.changedFiles.length === 0) {
    return "_No git diff changes detected._";
  }
  const files = diff.changedFiles.map((file) => `- ${file}`).join("\n");
  const hunks = diff.hunks.length
    ? diff.hunks
        .slice(0, 20)
        .map((hunk) => {
          const header = hunk.header ? ` ${hunk.header}` : "";
          const preview = hunk.bodyPreview ? `\n${codeFence("diff", hunk.bodyPreview)}` : "";
          return `### ${hunk.filePath}\n- Lines: +${hunk.newStart},${hunk.newLines}; -${hunk.oldStart},${hunk.oldLines}${header}${preview}`;
        })
        .join("\n\n")
    : "_No changed hunks parsed._";
  return `Changed files:\n${files}\n\nHunks:\n${hunks}`;
}

export function renderRelevanceReasons(pack: ContextPack): string {
  const scores = pack.relevance?.slice(0, 20) ?? [];
  if (scores.length === 0) {
    return "_No relevance scores recorded._";
  }
  return scores.map((item) => `- ${item.path}: ${item.score} (${item.reasons.join("; ")})`).join("\n");
}
