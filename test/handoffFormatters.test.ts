import { describe, expect, it } from "vitest";
import { ContextPack } from "../src/core/types";
import { formatCodexHandoff } from "../src/formatters/codexHandoffFormatter";
import { formatContinueHandoff } from "../src/formatters/continueHandoffFormatter";
import { formatOpenCodeHandoff } from "../src/formatters/openCodeHandoffFormatter";

describe("handoff formatters", () => {
  it("renders the three handoff flavors", () => {
    const pack: ContextPack = {
      mode: "codex",
      task: "Fix scanner",
      repoRoot: "/repo",
      generatedAt: "2026-05-10T12:00:00.000Z",
      repoSummary: "1 file scanned.",
      selectedFiles: [{ path: "src/index.ts", includeMode: "full" }],
      codeMap: [],
      fullFiles: [],
      logs: [],
      constraints: ["Do not modify unrelated files."],
      validationCommands: ["npm test"],
      tokenBudget: { limit: 32768, reservedOutput: 8000, usedInput: 1000, remainingInput: 23768 },
      tokenizerProfile: "gpt-4-estimate"
    };

    expect(formatCodexHandoff(pack)).toContain("# RepoForge Codex Handoff");
    expect(formatOpenCodeHandoff(pack)).toContain("# RepoForge Local Qwen / OpenCode Handoff");
    expect(formatContinueHandoff(pack)).toContain("# RepoForge Continue Handoff");
  });
});
