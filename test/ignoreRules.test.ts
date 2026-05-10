import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadIgnoreRules, shouldIgnore } from "../src/core/ignoreRules";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("ignore rules", () => {
  it("honors built-in ignores", () => {
    expect(shouldIgnore("node_modules/pkg/index.js")).toBe(true);
    expect(shouldIgnore("dist/index.js")).toBe(true);
    expect(shouldIgnore("src/index.ts")).toBe(false);
  });

  it("loads .gitignore and .repoforgeignore with nested paths and negation", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-ignore-"));
    tempDirs.push(dir);
    await fs.writeFile(path.join(dir, ".gitignore"), "ignored/\n*.tmp\n", "utf8");
    await fs.writeFile(path.join(dir, ".repoforgeignore"), "generated/**\n!important.tmp\n", "utf8");

    const matcher = await loadIgnoreRules(dir);

    expect(shouldIgnore("ignored/file.ts", matcher)).toBe(true);
    expect(shouldIgnore("nested/ignored/file.ts", matcher)).toBe(true);
    expect(shouldIgnore("build.tmp", matcher)).toBe(true);
    expect(shouldIgnore("important.tmp", matcher)).toBe(false);
    expect(shouldIgnore("generated/client/index.ts", matcher)).toBe(true);
    expect(shouldIgnore("src/index.ts", matcher)).toBe(false);
  });
});
