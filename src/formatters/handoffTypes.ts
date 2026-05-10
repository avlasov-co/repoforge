import { ContextPack } from "../core/types";

export interface HandoffFormatInput {
  pack: ContextPack;
}

export type HandoffKind = "codex" | "local-qwen" | "continue";
