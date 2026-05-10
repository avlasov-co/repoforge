import { describe, expect, it } from "vitest";
import { buildPatchPreview } from "../src/core/patch/patchPreview";
import { parseUnifiedDiff } from "../src/core/patch/unifiedDiffParser";

describe("unified diff parser", () => {
  it("parses a standard modify diff", () => {
    const parsed = parseUnifiedDiff([
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 123..456 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,2 +1,3 @@",
      ' import x from "x";',
      "-const a = 1;",
      "+const a = 2;",
      "+const b = 3;"
    ].join("\n"));

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toEqual(
      expect.objectContaining({
        oldPath: "src/foo.ts",
        newPath: "src/foo.ts",
        changeType: "modify"
      })
    );
    expect(parsed.files[0].hunks[0].lines).toHaveLength(4);
  });

  it("parses a new file diff", () => {
    const parsed = parseUnifiedDiff([
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,2 @@",
      "+export const value = 1;",
      "+"
    ].join("\n"));

    expect(parsed.files[0].changeType).toBe("add");
    expect(parsed.files[0].oldPath).toBe("");
    expect(parsed.files[0].newPath).toBe("src/new.ts");
  });

  it("parses a deleted file diff", () => {
    const parsed = parseUnifiedDiff([
      "diff --git a/src/old.ts b/src/old.ts",
      "deleted file mode 100644",
      "--- a/src/old.ts",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-export const value = 1;"
    ].join("\n"));

    expect(parsed.files[0].changeType).toBe("delete");
    expect(parsed.files[0].oldPath).toBe("src/old.ts");
    expect(parsed.files[0].newPath).toBe("");
  });

  it("extracts diff content from a markdown fenced block", () => {
    const parsed = parseUnifiedDiff([
      "Here is the patch:",
      "",
      "```diff",
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1 +1 @@",
      "-const a = 1;",
      "+const a = 2;",
      "```",
      "",
      "Apply it carefully."
    ].join("\n"));

    expect(parsed.files).toHaveLength(1);
    expect(parsed.rawText).toContain("diff --git a/src/foo.ts b/src/foo.ts");
    expect(parsed.rawText).not.toContain("Apply it carefully.");
  });

  it("records diagnostics for malformed hunks and still returns preview counts", () => {
    const parsed = parseUnifiedDiff([
      "diff --git a/src/foo.ts b/src/foo.ts",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,1 +1,1 @@",
      "const a = 2;"
    ].join("\n"));
    const preview = buildPatchPreview(parsed);

    expect(parsed.diagnostics.length).toBeGreaterThan(0);
    expect(preview.files[0].path).toBe("src/foo.ts");
  });
});
