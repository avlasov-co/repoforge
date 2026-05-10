import * as fs from "fs/promises";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { savePatchApplyResult, getPatchHistoryPaths } from "./patchHistory";
import { PatchApplyResult } from "./patchTypes";
import { parseUnifiedDiff } from "./unifiedDiffParser";

const execFileAsync = promisify(execFile);

export async function checkPatchApplies(repoRoot: string, patchText: string): Promise<PatchApplyResult> {
  return runPatchApply(repoRoot, patchText, true);
}

export async function applyPatch(repoRoot: string, patchText: string): Promise<PatchApplyResult> {
  return runPatchApply(repoRoot, patchText, false);
}

async function runPatchApply(repoRoot: string, patchText: string, checkOnly: boolean): Promise<PatchApplyResult> {
  const parsed = parseUnifiedDiff(patchText);
  const diagnostics = [...parsed.diagnostics];
  const filesChanged = parsed.files.map((file) => file.newPath || file.oldPath).filter(Boolean);
  const failedFiles: Array<{ path: string; reason: string }> = [];

  if (!parsed.files.length) {
    const result = { applied: false, filesChanged: [], failedFiles, diagnostics: [...diagnostics, "No patch files were parsed."] };
    await savePatchApplyResult(repoRoot, result);
    return result;
  }

  if (parsed.diagnostics.length > 0) {
    const result = {
      applied: false,
      filesChanged,
      failedFiles,
      diagnostics: [...diagnostics, "Patch contains parser diagnostics. Review and re-parse before applying."]
    };
    await savePatchApplyResult(repoRoot, result);
    return result;
  }

  for (const file of parsed.files) {
    const target = file.newPath || file.oldPath;
    if (!target) {
      failedFiles.push({ path: "(unknown)", reason: "Patch file is missing a target path." });
      continue;
    }
    if (!isSafeWorkspacePath(repoRoot, target)) {
      failedFiles.push({ path: target, reason: "Patch touches a path outside the workspace root." });
    }
  }

  if (failedFiles.length > 0) {
    const result = {
      applied: false,
      filesChanged,
      failedFiles,
      diagnostics: [...diagnostics, "Patch application blocked by path safety checks."]
    };
    await savePatchApplyResult(repoRoot, result);
    return result;
  }

  if (!(await isGitRepo(repoRoot))) {
    const result = {
      applied: false,
      filesChanged,
      failedFiles: [{ path: repoRoot, reason: "Workspace is not a git repository." }],
      diagnostics: [...diagnostics, "Patch application requires a git repository."]
    };
    await savePatchApplyResult(repoRoot, result);
    return result;
  }

  const paths = await getPatchHistoryPaths(repoRoot);
  const tempPatchPath = path.join(paths.tmpDir, `patch-${Date.now()}.diff`);
  await fs.writeFile(tempPatchPath, `${parsed.rawText}${parsed.rawText.endsWith("\n") ? "" : "\n"}`, "utf8");

  try {
    await execFileAsync("git", ["apply", "--check", tempPatchPath], { cwd: repoRoot });
  } catch (error) {
    const message = formatExecError(error);
    const result = {
      applied: false,
      filesChanged,
      failedFiles: filesChanged.map((file) => ({ path: file, reason: "git apply --check failed." })),
      diagnostics: [...diagnostics, `git apply --check failed: ${message}`]
    };
    await savePatchApplyResult(repoRoot, result);
    return result;
  }

  if (checkOnly) {
    const result = { applied: true, filesChanged, failedFiles, diagnostics };
    await savePatchApplyResult(repoRoot, result);
    return result;
  }

  try {
    await execFileAsync("git", ["apply", tempPatchPath], { cwd: repoRoot });
    const result = { applied: true, filesChanged, failedFiles, diagnostics };
    await savePatchApplyResult(repoRoot, result);
    return result;
  } catch (error) {
    const message = formatExecError(error);
    const result = {
      applied: false,
      filesChanged,
      failedFiles: filesChanged.map((file) => ({ path: file, reason: "git apply failed." })),
      diagnostics: [...diagnostics, `git apply failed: ${message}`]
    };
    await savePatchApplyResult(repoRoot, result);
    return result;
  }
}

async function isGitRepo(repoRoot: string): Promise<boolean> {
  try {
    const result = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repoRoot });
    return result.stdout.trim() === "true";
  } catch {
    return false;
  }
}

function isSafeWorkspacePath(repoRoot: string, relativePath: string): boolean {
  if (!relativePath || path.isAbsolute(relativePath)) {
    return false;
  }
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedPath = path.resolve(repoRoot, relativePath);
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`);
}

function formatExecError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const stderr = "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = "stdout" in error ? String(error.stdout ?? "") : "";
    const message = "message" in error ? String(error.message ?? "") : "";
    return [message, stderr.trim(), stdout.trim()].filter(Boolean).join(" | ");
  }
  return String(error);
}
