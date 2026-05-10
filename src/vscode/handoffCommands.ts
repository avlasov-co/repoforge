import * as fs from "fs/promises";
import { getOutputPaths } from "../core/outputPaths";
import { ContextPack, SavedHandoff } from "../core/types";
import { formatCodexHandoff } from "../formatters/codexHandoffFormatter";
import { formatContinueHandoff } from "../formatters/continueHandoffFormatter";
import { HandoffKind } from "../formatters/handoffTypes";
import { formatOpenCodeHandoff } from "../formatters/openCodeHandoffFormatter";

export function formatHandoff(pack: ContextPack, kind: HandoffKind): string {
  if (kind === "codex") {
    return formatCodexHandoff(pack);
  }
  if (kind === "continue") {
    return formatContinueHandoff(pack);
  }
  return formatOpenCodeHandoff(pack);
}

export async function saveHandoff(pack: ContextPack, kind: HandoffKind): Promise<SavedHandoff> {
  const markdown = formatHandoff(pack, kind);
  const paths = await getOutputPaths(pack.repoRoot, pack.generatedAt);
  await Promise.all([
    fs.writeFile(paths.lastHandoffMarkdownPath, markdown, "utf8"),
    fs.writeFile(paths.historyHandoffMarkdownPath, markdown, "utf8")
  ]);
  return { markdown, markdownPath: paths.lastHandoffMarkdownPath };
}
