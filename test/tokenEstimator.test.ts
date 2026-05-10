import { describe, expect, it } from "vitest";
import { estimateTokens } from "../src/core/tokenEstimator";

describe("estimateTokens", () => {
  it("returns zero for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("rounds short text up", () => {
    expect(estimateTokens("abc")).toBeGreaterThan(0);
  });

  it("uses real tokenizer boundaries rather than character division", () => {
    expect(estimateTokens("hello world")).toBe(2);
    expect(estimateTokens("hello world")).not.toBe(Math.ceil("hello world".length / 4));
  });
});
