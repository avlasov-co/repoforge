import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { afterEach, describe, expect, it } from "vitest";
import { applyPatch, checkPatchApplies } from "../src/core/patch/patchApply";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeGitRepo(): Promise<string> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-patch-"));
  tempDirs.push(repoRoot);
  await execFileAsync("git", ["init"], { cwd: repoRoot });
  await execFileAsync("git", ["config", "user.email", "repoforge@example.com"], { cwd: repoRoot });
  await execFileAsync("git", ["config", "user.name", "RepoForge Test"], { cwd: repoRoot });
  await fs.mkdir(path.join(repoRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, "src", "foo.ts"), "const a = 1;\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repoRoot });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });
  return repoRoot;
}

describe("patch apply", () => {
  it("checks and applies a patch in a git repo", async () => {
    const repoRoot = await makeGitRepo();
    const patchText = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 1f20d7f..1111111 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1 +1,2 @@",
      "-const a = 1;",
      "+const a = 2;",
      "+const b = 3;"
    ].join("\n");

    const check = await checkPatchApplies(repoRoot, patchText);
    expect(check.applied).toBe(true);

    const result = await applyPatch(repoRoot, patchText);
    expect(result.applied).toBe(true);
    expect(await fs.readFile(path.join(repoRoot, "src", "foo.ts"), "utf8")).toContain("const b = 3;");
  });

  it("blocks paths outside the workspace", async () => {
    const repoRoot = await makeGitRepo();
    const patchText = [
      "diff --git a/../evil.txt b/../evil.txt",
      "--- a/../evil.txt",
      "+++ b/../evil.txt",
      "@@ -0,0 +1 @@",
      "+bad"
    ].join("\n");

    const result = await checkPatchApplies(repoRoot, patchText);
    expect(result.applied).toBe(false);
    expect(result.failedFiles[0]?.reason).toContain("outside the workspace");
  });
});
