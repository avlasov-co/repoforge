import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { getOutputPaths } from "../src/core/outputPaths";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("output paths", () => {
  it("keeps backward-compatible last files and adds history organization", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-paths-"));
    tempDirs.push(dir);
    const paths = await getOutputPaths(dir, "2026-05-10T12:00:00.000Z");

    expect(paths.lastContextMarkdownPath).toBe(path.join(dir, ".repoforge", "last-context.md"));
    expect(paths.lastContextJsonPath).toBe(path.join(dir, ".repoforge", "last-context.json"));
    expect(paths.lastHandoffMarkdownPath).toBe(path.join(dir, ".repoforge", "last-handoff.md"));
    expect(paths.profilesPath).toBe(path.join(dir, ".repoforge", "profiles.json"));
    expect(paths.historyContextMarkdownPath).toContain(path.join(".repoforge", "history", "context-"));
    await expect(fs.stat(paths.historyDir)).resolves.toBeDefined();
  });
});
