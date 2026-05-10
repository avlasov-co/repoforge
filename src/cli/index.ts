import { buildContextPack, saveContextPack } from "../core/contextPack";
import { ContextMode } from "../core/types";

async function main(): Promise<void> {
  const [, , repoRoot = process.cwd(), modeArg = "codex", ...taskParts] = process.argv;
  const mode: ContextMode = modeArg === "local-qwen" ? "local-qwen" : "codex";
  const task = taskParts.join(" ").trim();
  if (!task) {
    console.log("Usage: node dist/src/cli/index.js <repoRoot> <codex|local-qwen> <task>");
    return;
  }
  const pack = await buildContextPack({
    mode,
    task,
    repoRoot,
    tokenLimit: mode === "codex" ? 32768 : 131072,
    reservedOutput: mode === "codex" ? 8000 : 16000,
    selectedFiles: []
  });
  const saved = await saveContextPack(pack);
  console.log(saved.markdownPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
