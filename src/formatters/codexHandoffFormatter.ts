import { ContextPack } from "../core/types";
import { renderCodeMap, renderConstraints, renderFullFiles, renderGitDiffSummary, renderSelectionList, renderValidation } from "./markdownFormatter";

export function formatCodexHandoff(pack: ContextPack): string {
  return `# RepoForge Codex Handoff

## Task
${pack.task}

## Files To Inspect First
${renderSelectionList(pack.selectedFiles)}

## Changed Files / Git Hunks
${renderGitDiffSummary(pack)}

## Compact Repo Map
${renderCodeMap(pack.codeMap, true)}

## Selected Context
${renderFullFiles(pack)}

## Constraints
${renderConstraints(pack)}

## Validation Commands
${renderValidation(pack.validationCommands)}

## Instructions For Codex
- Inspect the files listed first.
- Prefer minimal diffs.
- Run validation commands where possible.
- Do not modify unrelated files.
- Report root cause, changes made, and validation result.
`;
}
