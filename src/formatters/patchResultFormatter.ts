import { PatchPreview } from "../core/patch/patchTypes";
import { PersistedValidationRunResult } from "../core/validation/validationHistory";
import { ValidationRunResult } from "../core/validation/validationTypes";

export function formatPatchPreviewMarkdown(preview: PatchPreview): string {
  const fileSections = preview.files.length
    ? preview.files.map((file) => {
        return [
          `### ${file.path}`,
          `- Change type: ${file.changeType}`,
          `- Additions: ${file.additions}`,
          `- Deletions: ${file.deletions}`,
          `- Hunks: ${file.hunks}`
        ].join("\n");
      })
    : ["No files parsed."];

  const diagnostics = preview.diagnostics.length
    ? preview.diagnostics.map((line) => `- ${line}`).join("\n")
    : "- None";

  return [
    "# RepoForge Patch Preview",
    "",
    "## Summary",
    `- Files changed: ${preview.files.length}`,
    `- Additions: ${preview.totalAdditions}`,
    `- Deletions: ${preview.totalDeletions}`,
    "",
    "## Files",
    "",
    ...fileSections,
    "",
    "## Diagnostics",
    diagnostics
  ].join("\n");
}

export function formatValidationResultMarkdown(result: ValidationRunResult | PersistedValidationRunResult): string {
  return [
    "# RepoForge Validation Result",
    "",
    "## Command",
    "",
    "```text",
    result.command,
    "```",
    "",
    "## Status",
    "",
    `Passed: ${result.passed ? "yes" : "no"}`,
    `Exit code: ${result.exitCode === null ? "null" : result.exitCode}`,
    "",
    "## Duration",
    "",
    `${result.durationMs}ms`,
    "",
    "## stdout",
    "",
    "```text",
    result.stdout || "(empty)",
    "```",
    "",
    "## stderr",
    "",
    "```text",
    result.stderr || "(empty)",
    "```"
  ].join("\n");
}
