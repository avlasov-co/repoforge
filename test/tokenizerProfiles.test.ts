import { describe, expect, it } from "vitest";
import { defaultTokenizerProfileForMode, estimateTokensForProfile } from "../src/core/tokenizerProfiles";

describe("tokenizer profiles", () => {
  it("estimates tokens with profile-specific divisors", () => {
    const text = "x".repeat(38);
    expect(estimateTokensForProfile(text, "gpt-4-estimate")).toBe(10);
    expect(estimateTokensForProfile(text, "qwen-estimate")).toBe(11);
    expect(estimateTokensForProfile(text, "llama-estimate")).toBe(10);
    expect(estimateTokensForProfile(text, "chars-only")).toBe(38);
  });

  it("chooses default profiles by pack mode", () => {
    expect(defaultTokenizerProfileForMode("codex")).toBe("gpt-4-estimate");
    expect(defaultTokenizerProfileForMode("local-qwen")).toBe("qwen-estimate");
  });
});
