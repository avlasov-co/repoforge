import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { listTaskProfiles, saveTaskProfile } from "../src/vscode/taskProfiles";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("task profiles", () => {
  it("saves and replaces profiles by name", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-profiles-"));
    tempDirs.push(dir);
    await saveTaskProfile(dir, {
      name: "bugfix",
      task: "fix bug",
      mode: "codex",
      contextLimit: 32768,
      reservedOutput: 8000,
      tokenizerProfile: "gpt-4-estimate",
      selectedFiles: [{ path: "src/index.ts", includeMode: "full" }]
    });
    await saveTaskProfile(dir, {
      name: "bugfix",
      task: "fix better",
      mode: "continue",
      contextLimit: 65536,
      reservedOutput: 8000,
      tokenizerProfile: "gpt-4-estimate",
      selectedFiles: []
    });

    const profiles = await listTaskProfiles(dir);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toEqual(expect.objectContaining({ name: "bugfix", task: "fix better", mode: "continue" }));
  });
});
