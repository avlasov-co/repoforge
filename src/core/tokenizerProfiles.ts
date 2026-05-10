import { ContextMode, TokenizerProfile } from "./types";

export function estimateTokensForProfile(text: string, profile: TokenizerProfile): number {
  if (!text) {
    return 0;
  }
  if (profile === "chars-only") {
    return text.length;
  }
  const divisor = profile === "qwen-estimate" ? 3.6 : profile === "llama-estimate" ? 3.8 : 4;
  return Math.ceil(text.length / divisor);
}

export function defaultTokenizerProfileForMode(mode: ContextMode): TokenizerProfile {
  return mode === "local-qwen" ? "qwen-estimate" : "gpt-4-estimate";
}
