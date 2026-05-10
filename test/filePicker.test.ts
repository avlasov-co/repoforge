import { describe, expect, it } from "vitest";
import { searchFiles } from "../src/vscode/filePicker";
import { RepoScanResult } from "../src/core/types";

describe("file picker search", () => {
  it("matches path, language, symbols, and imports", () => {
    const scan: RepoScanResult = {
      repoRoot: "/repo",
      summary: "test",
      files: [
        { path: "src/losses.py", absolutePath: "/repo/src/losses.py", language: "python", sizeBytes: 10, estimatedTokens: 100, modifiedTimeMs: 0 },
        { path: "package.json", absolutePath: "/repo/package.json", language: "json", sizeBytes: 10, estimatedTokens: 20, modifiedTimeMs: 0, gitStatus: "M" }
      ],
      codeMap: [
        {
          path: "src/losses.py",
          language: "python",
          backend: "python-ast",
          imports: ["import torch"],
          symbols: [{ name: "compute_trade_loss", kind: "function", line: 1 }],
          estimatedTokens: 100
        }
      ]
    };

    expect(searchFiles({ query: "trade", task: "fix trade loss", scan })[0].path).toBe("src/losses.py");
    expect(searchFiles({ query: "json", task: "", scan })[0].path).toBe("package.json");
    expect(searchFiles({ query: "torch", task: "", scan })[0].path).toBe("src/losses.py");
  });
});
