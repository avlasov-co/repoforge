import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { saveParsedPatch, savePatchApplyResult } from "../src/core/patch/patchHistory";
import { buildPatchPreview } from "../src/core/patch/patchPreview";
import { parseUnifiedDiff } from "../src/core/patch/unifiedDiffParser";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("patch history", () => {
  it("saves last and history patch artifacts", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-history-"));
    tempDirs.push(repoRoot);
    const patchText = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1 +1 @@",
      "-const a = 1;",
      "+const a = 2;"
    ].join("\n");
    const preview = buildPatchPreview(parseUnifiedDiff(patchText));
    const paths = await saveParsedPatch(repoRoot, patchText, preview, "# Preview");

    await expect(fs.readFile(paths.lastPatchPath, "utf8")).resolves.toContain("diff --git");
    await expect(fs.readFile(paths.lastPatchPreviewJsonPath, "utf8")).resolves.toContain('"totalAdditions": 1');
    await expect(fs.readFile(paths.historyPatchPreviewMarkdownPath, "utf8")).resolves.toContain("# Preview");
  });

  it("saves patch apply result metadata", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-history-"));
    tempDirs.push(repoRoot);
    const paths = await savePatchApplyResult(repoRoot, {
      applied: true,
      filesChanged: ["src/foo.ts"],
      failedFiles: [],
      diagnostics: []
    });

    await expect(fs.readFile(paths.lastPatchResultPath, "utf8")).resolves.toContain('"applied": true');
  });
});
