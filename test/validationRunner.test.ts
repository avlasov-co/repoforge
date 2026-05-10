import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { saveValidationRunResult } from "../src/core/validation/validationHistory";
import { runValidationCommand } from "../src/core/validation/validationRunner";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-validation-"));
  tempDirs.push(dir);
  return dir;
}

describe("validation runner", () => {
  it("runs a passing command", async () => {
    const repoRoot = await makeTempDir();
    const result = await runValidationCommand(repoRoot, `node -e "console.log('ok')"`);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.stdout).toContain("ok");
  });

  it("runs a failing command", async () => {
    const repoRoot = await makeTempDir();
    const result = await runValidationCommand(repoRoot, `node -e "process.exit(2)"`);

    expect(result.exitCode).toBe(2);
    expect(result.passed).toBe(false);
  });

  it("truncates large output when saving history", async () => {
    const repoRoot = await makeTempDir();
    const result = await runValidationCommand(repoRoot, `node -e "process.stdout.write('x'.repeat(120000))"`);
    const paths = await saveValidationRunResult(repoRoot, result);
    const saved = JSON.parse(await fs.readFile(paths.lastValidationPath, "utf8")) as { stdout: string; truncated: boolean };

    expect(saved.truncated).toBe(true);
    expect(Buffer.byteLength(saved.stdout, "utf8")).toBeLessThanOrEqual(1024 * 100 + 32);
  });
});
