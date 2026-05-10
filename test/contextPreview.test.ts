import { describe, expect, it } from "vitest";
import { buildContextPreview } from "../src/core/contextPreview";
import { RepoFile } from "../src/core/types";

describe("context preview", () => {
  it("estimates budget and reports likely optimizer warnings", () => {
    const files: RepoFile[] = [
      { path: "src/a.ts", absolutePath: "src/a.ts", language: "typescript", sizeBytes: 1000, estimatedTokens: 900, modifiedTimeMs: 0 },
      { path: "src/b.ts", absolutePath: "src/b.ts", language: "typescript", sizeBytes: 1000, estimatedTokens: 900, modifiedTimeMs: 0 }
    ];

    const preview = buildContextPreview({
      task: "change behavior",
      selectedFiles: [{ path: "src/a.ts", includeMode: "full", reason: "manual selection" }],
      suggestedFiles: [{ path: "src/b.ts", includeMode: "full", reason: "suggested" }],
      files,
      mode: "codex",
      contextLimit: 1400,
      reservedOutput: 300,
      tokenizerProfile: "gpt-4-estimate",
      relevanceScores: [{ path: "src/b.ts", score: 1, reasons: ["weak"] }]
    });

    expect(preview.budget.limit).toBe(1400);
    expect(preview.breakdown.find((item) => item.path === "src/a.ts")?.includeMode).toBe("full");
    expect(preview.warnings.length).toBeGreaterThan(0);
  });
});
