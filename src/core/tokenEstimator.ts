import { encodingForModel, Tiktoken } from "js-tiktoken";

let encoder: Tiktoken | undefined;

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return getEncoder().encode(text).length;
}

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = encodingForModel("gpt-4");
  }
  return encoder;
}
