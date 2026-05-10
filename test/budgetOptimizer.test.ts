import { describe, expect, it } from "vitest";
import { optimizeContextBudget } from "../src/core/budgetOptimizer";
import { RepoFile } from "../src/core/types";

const files: RepoFile[] = [
  file("src/manual.ts", 900),
  file("src/changed.ts", 900),
  file("src/low.ts", 900),
  file("src/drop.ts", 900)
];

describe("budget optimizer", () => {
  it("downgrades and drops low-priority files while preserving manual full files", () => {
    const result = optimizeContextBudget({
      tokenLimit: 1300,
      reservedOutput: 300,
      files,
      changedFiles: ["src/changed.ts"],
      relevanceScores: [
        { path: "src/changed.ts", score: 80, reasons: ["contains changed hunks"] },
        { path: "src/low.ts", score: 5, reasons: ["weak match"] },
        { path: "src/drop.ts", score: 1, reasons: ["weak match"] }
      ],
      selectedFiles: [
        { path: "src/manual.ts", includeMode: "full", reason: "manual selection" },
        { path: "src/changed.ts", includeMode: "full", reason: "suggested" },
        { path: "src/low.ts", includeMode: "full", reason: "suggested" },
        { path: "src/drop.ts", includeMode: "codemap", reason: "suggested" }
      ]
    });

    expect(result.selections.find((item) => item.path === "src/manual.ts")?.includeMode).toBe("full");
    expect(result.selections.find((item) => item.path === "src/changed.ts")).toBeDefined();
    expect(result.selections.find((item) => item.path === "src/low.ts")?.includeMode).not.toBe("full");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.budget.limit).toBe(1300);
  });
});

function file(path: string, estimatedTokens: number): RepoFile {
  return {
    path,
    absolutePath: path,
    language: "typescript",
    sizeBytes: estimatedTokens,
    estimatedTokens,
    modifiedTimeMs: 0
  };
}
