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

export function formatLocalQwenPack(pack: ContextPack): string {
  return `# Local Qwen Long-Context Coding Pack

## Role
You are a senior software engineer working on this local repository. Use the provided context carefully. Do not assume missing files. Ask for more context only if necessary.

## Task
${pack.task}

## Repo Summary
${pack.repoSummary}

## Project Memory
${pack.projectMemory?.trim() || "_No project memory found._"}

## Token Budget
${renderTokenBudget(pack)}

## Git Diff Summary
${renderGitDiffSummary(pack)}

## Selected Files and Inclusion Modes
${renderSelectionList(pack.selectedFiles)}

## Relevance Reasons
${renderRelevanceReasons(pack)}

## Repo Code Map
${renderCodeMap(pack.codeMap, false)}

## Full File Contents
${renderFullFiles(pack)}

## Logs / Terminal Output
${pack.logs.length ? pack.logs.join("\n\n") : "_No logs provided._"}

## Constraints
${renderConstraints(pack)}

## Validation Commands
${renderValidation(pack.validationCommands)}

## Required Response Format
1. Root cause / diagnosis.
2. Plan.
3. Patch or exact file changes.
4. Validation steps.
5. Risks / follow-up.
`;
}
