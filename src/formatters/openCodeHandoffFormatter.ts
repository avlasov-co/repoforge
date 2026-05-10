import { ContextPack } from "../core/types";
import {
  renderCodeMap,
  renderConstraints,
  renderFullFiles,
  renderGitDiffSummary,
  renderSelectionList,
  renderTokenBudget,
  renderValidation
} from "./markdownFormatter";

export function formatOpenCodeHandoff(pack: ContextPack): string {
  return `# RepoForge Local Qwen / OpenCode Handoff

## Role
You are working with a long-context local coding model. Use the provided repo context carefully. Do not assume missing files.

## Task
${pack.task}

## Project Memory
${pack.projectMemory?.trim() || "_No project memory found._"}

## Token Budget
${renderTokenBudget(pack)}

## Repo Summary
${pack.repoSummary}

## Suggested Work Plan
- Inspect changed files and selected files first.
- Use the code map to find related symbols before editing.
- Keep changes focused on the task.
- Run validation commands when possible.

## Selected Files
${renderSelectionList(pack.selectedFiles)}

## Code Map
${renderCodeMap(pack.codeMap, false)}

## Full File Contents
${renderFullFiles(pack)}

## Changed Files / Git Hunks
${renderGitDiffSummary(pack)}

## Constraints
${renderConstraints(pack)}

## Validation Commands
${renderValidation(pack.validationCommands)}

## Required Response Format
1. Diagnosis
2. Plan
3. Patch or exact file changes
4. Validation
5. Risks
`;
}
