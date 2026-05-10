import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { buildContextPack, formatPack } from "../src/core/contextPack";
import { scanRepo } from "../src/core/repoScanner";

const tempDirs: string[] = [];

async function makeRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-test-"));
  tempDirs.push(dir);
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ scripts: { test: "vitest run", build: "tsc -p ./" } }, null, 2),
    "utf8"
  );
  await fs.mkdir(path.join(dir, "src"));
  await fs.writeFile(
    path.join(dir, "src", "index.ts"),
    `export function scanRepo(root: string) {
  return root;
}
`,
    "utf8"
  );
  await fs.mkdir(path.join(dir, ".repoforge"));
  await fs.writeFile(path.join(dir, ".repoforge", "project-memory.md"), "# Project Memory\n\nUse small patches.\n", "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("context packs", () => {
  it("calculates token budget and includes validation commands", async () => {
    const repoRoot = await makeRepo();
    const pack = await buildContextPack({
      mode: "codex",
      task: "Update scanRepo behavior",
      repoRoot,
      tokenLimit: 32768,
      reservedOutput: 8000,
      selectedFiles: [{ path: "src/index.ts", includeMode: "full", reason: "test" }]
    });

    expect(pack.tokenBudget.limit).toBe(32768);
    expect(pack.tokenBudget.reservedOutput).toBe(8000);
    expect(pack.tokenBudget.usedInput).toBeGreaterThan(0);
    expect(pack.tokenBudget.remainingInput).toBe(32768 - 8000 - pack.tokenBudget.usedInput);
    expect(pack.validationCommands).toEqual(expect.arrayContaining(["npm test", "npm run build"]));
    expect(pack.fullFiles[0]).toEqual(expect.objectContaining({ path: "src/index.ts" }));
  });

  it("formats required Codex and Local Qwen sections", async () => {
    const repoRoot = await makeRepo();
    const base = {
      task: "Update scanRepo behavior",
      repoRoot,
      tokenLimit: 65536,
      reservedOutput: 8000,
      selectedFiles: [{ path: "src/index.ts", includeMode: "full" as const, reason: "test" }]
    };

    const codex = await buildContextPack({ ...base, mode: "codex" });
    const codexMarkdown = formatPack(codex);
    expect(codexMarkdown).toContain("# Codex Task Pack");
    expect(codexMarkdown).toContain("## Files to Inspect First");
    expect(codexMarkdown).toContain("## Expected Output");

    const qwen = await buildContextPack({ ...base, mode: "local-qwen", reservedOutput: 16000 });
    const qwenMarkdown = formatPack(qwen);
    expect(qwenMarkdown).toContain("# Local Qwen Long-Context Coding Pack");
    expect(qwenMarkdown).toContain("## Token Budget");
    expect(qwenMarkdown).toContain("## Required Response Format");
  });

  it("honors .repoforgeignore rules", async () => {
    const repoRoot = await makeRepo();
    await fs.writeFile(path.join(repoRoot, ".repoforgeignore"), "ignored/\n*.secret\n!important.secret\n", "utf8");
    await fs.mkdir(path.join(repoRoot, "ignored"));
    await fs.writeFile(path.join(repoRoot, "ignored", "skip.ts"), "export const skip = true;\n", "utf8");
    await fs.writeFile(path.join(repoRoot, "token.secret"), "hidden\n", "utf8");
    await fs.writeFile(path.join(repoRoot, "important.secret"), "visible\n", "utf8");

    const scan = await scanRepo(repoRoot);
    const paths = scan.files.map((file) => file.path);
    expect(paths).not.toContain("ignored/skip.ts");
    expect(paths).not.toContain("token.secret");
    expect(paths).toContain("important.secret");
    expect(paths).not.toContain(".repoforge/project-memory.md");
  });
});
