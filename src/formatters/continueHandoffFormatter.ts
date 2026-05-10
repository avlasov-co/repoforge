import { ContextPack } from "../core/types";
import { renderCodeMap, renderConstraints, renderFullFiles, renderSelectionList, renderValidation } from "./markdownFormatter";

export function formatContinueHandoff(pack: ContextPack): string {
  return `# RepoForge Continue Handoff

## Task
${pack.task}

## Selected Files
${renderSelectionList(pack.selectedFiles)}

## Context
${pack.repoSummary}

${renderCodeMap(pack.codeMap, true)}

${renderFullFiles(pack)}

## Constraints
${renderConstraints(pack)}

## Validation
${renderValidation(pack.validationCommands)}

Use this context to help edit or explain the repository inside VS Code.
`;
}
