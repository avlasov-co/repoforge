import { ContextPack } from "../core/types";
import {
  renderCodeMap,
  renderConstraints,
  renderFullFiles,
  renderGitDiffSummary,
  renderRelevanceReasons,
  renderSelectionList,
  renderTokenBudget,
  renderValidation
} from "./markdownFormatter";

export function formatCodexPack(pack: ContextPack): string {
  return `# Codex Task Pack

## Task
${pack.task}

## Intent
You are working inside this repository. Inspect the listed files first. Make minimal, correct changes. Prefer patchable edits. Run validation commands if possible.

## Repo Summary
${pack.repoSummary}

## Tokenizer / Budget
${renderTokenBudget(pack)}

## Project Memory
${pack.projectMemory?.trim() || "_No project memory found._"}

## Changed Files and Hunks
${renderGitDiffSummary(pack)}

## Files to Inspect First
${renderSelectionList(pack.selectedFiles)}

## Suggested Inspect Order
${renderRelevanceReasons(pack)}

## Relevant Code Map
${renderCodeMap(pack.codeMap, true)}

## Full File Contents Included
${renderFullFiles(pack)}

## Constraints
${renderConstraints(pack)}

## Validation Commands
${renderValidation(pack.validationCommands)}

## Expected Output
- Explain root cause briefly.
- Apply patch or provide diff.
- Run validation if available.
- Report what changed.
`;
}
