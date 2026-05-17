import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { parsePythonAst } from "../src/core/parsers/pythonAstParser";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("python AST parser", () => {
  it("extracts imports, classes, methods, functions, async functions, and line numbers", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-python-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "trainer.py");
    await fs.writeFile(
      filePath,
      `import os
from pathlib import Path

class Trainer:
    def fit(self, model, loader, optimizer):
        return model

async def train_one_epoch(model, loader, optimizer, scheduler, device):
    return model
`,
      "utf8"
    );

    const result = await parsePythonAst({
      path: "trainer.py",
      absolutePath: filePath,
      language: "python",
      content: await fs.readFile(filePath, "utf8")
    });

    expect(result.backend).toBe("python-ast");
    expect(result.imports).toEqual(["import os", "from pathlib import Path"]);
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Trainer", kind: "class", line: 4 }),
        expect.objectContaining({ name: "Trainer.fit", kind: "method", line: 5 }),
        expect.objectContaining({ name: "fit", kind: "method", line: 5 }),
        expect.objectContaining({ name: "train_one_epoch", kind: "function", line: 8 })
      ])
    );
    expect(result.symbols.find((symbol) => symbol.name === "train_one_epoch")?.signature).toBe(
      "train_one_epoch(model, loader, optimizer, scheduler, ...)"
    );
  });

  it("reports syntax errors without throwing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoforge-python-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "broken.py");
    await fs.writeFile(filePath, "def broken(:\n", "utf8");

    const result = await parsePythonAst({ path: "broken.py", absolutePath: filePath, language: "python", content: "def broken(:\n" });

    expect(result.backend).toBe("python-ast");
    expect(result.symbols).toEqual([]);
    expect(result.diagnostics.join("\n")).toContain("syntax error");
  });
});
