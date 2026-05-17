import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { formatValidationResultMarkdown } from "../src/formatters/patchResultFormatter";
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
    const result = await runValidationCommand(repoRoot, `printf 'ok\\n'`);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(true);
    expect(result.stdout).toContain("ok");
  });

  it("disables color output environment variables for validation commands", async () => {
    const repoRoot = await makeTempDir();
    const result = await runValidationCommand(
      repoRoot,
      `printf '%s %s %s\\n' "$NO_COLOR" "$FORCE_COLOR" "$npm_config_color"`
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("1 0 false");
  });

  it("runs a failing command", async () => {
    const repoRoot = await makeTempDir();
    const result = await runValidationCommand(repoRoot, `node -e "process.exit(2)"`);

    expect(result.exitCode).toBe(2);
    expect(result.passed).toBe(false);
  });

  it("truncates large output when saving history", async () => {
    const repoRoot = await makeTempDir();
    const result = await runValidationCommand(
      repoRoot,
      `perl -e 'print "x" x 120000'`
    );
    const paths = await saveValidationRunResult(repoRoot, result);
    const saved = JSON.parse(await fs.readFile(paths.lastValidationPath, "utf8")) as { stdout: string; truncated: boolean };

    expect(saved.truncated).toBe(true);
    expect(Buffer.byteLength(saved.stdout, "utf8")).toBeLessThanOrEqual(1024 * 100 + 32);
  });

  it("strips ANSI escape sequences from markdown and JSON artifacts", async () => {
    const repoRoot = await makeTempDir();
    const result = await runValidationCommand(
      repoRoot,
      `printf '\\033[31mred stdout\\033[0m\\n'; printf '\\033[32mred stderr\\033[0m\\n' >&2`
    );
    const paths = await saveValidationRunResult(repoRoot, result, formatValidationResultMarkdown(result));
    const markdown = await fs.readFile(paths.lastValidationMarkdownPath, "utf8");
    const saved = JSON.parse(await fs.readFile(paths.lastValidationPath, "utf8")) as { stdout: string; stderr: string };

    expect(markdown).not.toContain("\u001b[");
    expect(saved.stdout).toContain("red stdout");
    expect(saved.stderr).toContain("red stderr");
    expect(saved.stdout).not.toContain("\u001b[");
    expect(saved.stderr).not.toContain("\u001b[");
  });
});
