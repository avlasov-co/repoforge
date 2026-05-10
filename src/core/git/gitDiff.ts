import { execFile } from "child_process";
import { promisify } from "util";
import { GitDiffHunk, GitDiffSummary } from "../types";

const execFileAsync = promisify(execFile);

export async function getGitDiffSummary(repoRoot: string): Promise<GitDiffSummary> {
  try {
    await execFileAsync("git", ["-C", repoRoot, "rev-parse", "--is-inside-work-tree"], { timeout: 3000 });
  } catch {
    return { changedFiles: [], hunks: [] };
  }

  const diffs = await Promise.all([
    runDiff(repoRoot, ["diff", "--"]),
    runDiff(repoRoot, ["diff", "--cached", "--"])
  ]);
  return parseGitDiff(diffs.filter(Boolean).join("\n"));
}

export function parseGitDiff(diffText: string): GitDiffSummary {
  const changedFiles = new Set<string>();
  const hunks: GitDiffHunk[] = [];
  const lines = diffText.split(/\r?\n/);
  let currentFile = "";

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      currentFile = normalizePath(match?.[2] ?? "");
      if (currentFile) {
        changedFiles.add(currentFile);
      }
      continue;
    }
    if (line.startsWith("+++ b/")) {
      currentFile = normalizePath(line.slice("+++ b/".length));
      changedFiles.add(currentFile);
      continue;
    }
    const hunkMatch = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
    if (!hunkMatch || !currentFile) {
      continue;
    }

    const body: string[] = [];
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex++) {
      const bodyLine = lines[bodyIndex];
      if (bodyLine.startsWith("@@ ") || bodyLine.startsWith("diff --git ")) {
        break;
      }
      if (bodyLine.startsWith("+") || bodyLine.startsWith("-")) {
        body.push(bodyLine);
      }
      if (body.length >= 8) {
        break;
      }
    }

    hunks.push({
      filePath: currentFile,
      oldStart: Number(hunkMatch[1]),
      oldLines: Number(hunkMatch[2] ?? "1"),
      newStart: Number(hunkMatch[3]),
      newLines: Number(hunkMatch[4] ?? "1"),
      header: hunkMatch[5].trim(),
      bodyPreview: body.join("\n").slice(0, 600)
    });
  }

  for (const hunk of hunks) {
    changedFiles.add(hunk.filePath);
  }
  return {
    changedFiles: [...changedFiles].sort(),
    hunks
  };
}

async function runDiff(repoRoot: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return stdout;
  } catch {
    return "";
  }
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
