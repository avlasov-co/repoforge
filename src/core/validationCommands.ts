import * as fs from "fs/promises";
import * as path from "path";

export async function detectValidationCommands(repoRoot: string): Promise<string[]> {
  const commands: string[] = [];
  const packageJsonPath = path.join(repoRoot, "package.json");
  try {
    const parsed = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as { scripts?: Record<string, string> };
    if (parsed.scripts?.test) {
      commands.push("npm test");
    }
    if (parsed.scripts?.build) {
      commands.push("npm run build");
    }
  } catch {
    // Optional.
  }

  if ((await exists(path.join(repoRoot, "pyproject.toml"))) || (await exists(path.join(repoRoot, "pytest.ini")))) {
    commands.push("python3 -m pytest -q");
  }
  if (await exists(path.join(repoRoot, "Cargo.toml"))) {
    commands.push("cargo test");
  }
  if (await exists(path.join(repoRoot, "go.mod"))) {
    commands.push("go test ./...");
  }
  const makefile = path.join(repoRoot, "Makefile");
  if (await exists(makefile)) {
    const content = await fs.readFile(makefile, "utf8");
    if (/^test\s*:/m.test(content)) {
      commands.push("make test");
    }
  }
  return [...new Set(commands)];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
