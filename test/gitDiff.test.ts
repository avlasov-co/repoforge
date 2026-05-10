import { describe, expect, it } from "vitest";
import { parseGitDiff } from "../src/core/git/gitDiff";

describe("git diff parser", () => {
  it("extracts changed files and compact hunk previews", () => {
    const summary = parseGitDiff(`diff --git a/src/core/relevance.ts b/src/core/relevance.ts
index 1111111..2222222 100644
--- a/src/core/relevance.ts
+++ b/src/core/relevance.ts
@@ -10,6 +10,8 @@ export function score() {
 const base = 1;
+const diffAware = true;
-return base;
+return base + 1;
 }
diff --git a/test/relevance.test.ts b/test/relevance.test.ts
index 3333333..4444444 100644
--- a/test/relevance.test.ts
+++ b/test/relevance.test.ts
@@ -1 +1,2 @@
 import { describe } from "vitest";
+import { score } from "../src/core/relevance";
`);

    expect(summary.changedFiles).toEqual(["src/core/relevance.ts", "test/relevance.test.ts"]);
    expect(summary.hunks[0]).toEqual(
      expect.objectContaining({
        filePath: "src/core/relevance.ts",
        oldStart: 10,
        oldLines: 6,
        newStart: 10,
        newLines: 8
      })
    );
    expect(summary.hunks[0].bodyPreview).toContain("+const diffAware = true;");
  });
});
