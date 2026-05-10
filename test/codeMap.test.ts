import { describe, expect, it } from "vitest";
import { extractCodeMap } from "../src/core/codeMap";

describe("extractCodeMap", () => {
  it("extracts TypeScript imports and symbols", () => {
    const map = extractCodeMap(
      "src/example.ts",
      "typescript",
      `import { readFile } from "fs/promises";
export interface User { name: string }
export type UserId = string;
export class RepoService {
  async loadUser(id: UserId) {
    return id;
  }
  status = "ready";
}
export function createUser(name: string) {
  return { name };
}
export const routeRequest = () => true;
`,
      100
    );

    expect(map.imports).toContain('import { readFile } from "fs/promises";');
    expect(map.symbols.map((symbol) => symbol.name)).toEqual(
      expect.arrayContaining(["User", "UserId", "RepoService", "loadUser", "status", "createUser", "routeRequest"])
    );
    expect(map.symbols.find((symbol) => symbol.name === "loadUser")?.kind).toBe("method");
  });

  it("extracts React TSX components and exports", () => {
    const map = extractCodeMap(
      "src/App.tsx",
      "typescript",
      `import React, { memo, forwardRef } from "react";
export { Button } from "./Button";

type Props = { title: string };

export function Header({ title }: Props) {
  return <h1>{title}</h1>;
}

export const Card = memo(function Card({ title }: Props) {
  return <section>{title}</section>;
});

const FancyInput = forwardRef<HTMLInputElement, Props>((props, ref) => {
  return <input ref={ref} />;
});

export default FancyInput;
`,
      100
    );

    expect(map.imports).toEqual(expect.arrayContaining(['import React, { memo, forwardRef } from "react";', 'export { Button } from "./Button";']));
    expect(map.symbols.map((symbol) => symbol.name)).toEqual(
      expect.arrayContaining(["Props", "Header", "Card", "FancyInput", "default:FancyInput"])
    );
    expect(map.symbols.find((symbol) => symbol.name === "Card")?.kind).toBe("function");
  });

  it("extracts Python imports, classes, functions, and methods", () => {
    const map = extractCodeMap(
      "app/main.py",
      "python",
      `import os
from pathlib import Path

class Runner:
    def start(self):
        return True

def build_runner():
    return Runner()
`,
      80
    );

    expect(map.imports).toEqual(["import os", "from pathlib import Path"]);
    expect(map.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Runner", kind: "class", line: 4 }),
        expect.objectContaining({ name: "start", kind: "method", line: 5 }),
        expect.objectContaining({ name: "build_runner", kind: "function", line: 8 })
      ])
    );
  });

  it("extracts polished Python async functions, constants, and multiline signatures", () => {
    const map = extractCodeMap(
      "worker/tasks.py",
      "python",
      `from app.core import (
    settings,
)

MAX_RETRIES = 3

class Worker:
    async def run(
        self,
        payload: dict,
    ) -> bool:
        return True

async def dispatch_job(job_id: str):
    return job_id
`,
      120
    );

    expect(map.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "MAX_RETRIES", kind: "const", line: 5 }),
        expect.objectContaining({ name: "Worker", kind: "class", line: 7 }),
        expect.objectContaining({ name: "run", kind: "method", line: 8 }),
        expect.objectContaining({ name: "dispatch_job", kind: "function", line: 14 })
      ])
    );
    expect(map.symbols.find((symbol) => symbol.name === "run")?.signature).toContain("payload: dict");
  });

  it("extracts Rust modules, types, impl methods, traits, constants, and functions", () => {
    const map = extractCodeMap(
      "src/lib.rs",
      "rust",
      `use std::sync::Arc;

pub const DEFAULT_LIMIT: usize = 10;

pub mod engine {
    pub struct Forge {
        limit: usize,
    }

    impl Forge {
        pub async fn run(&self) -> usize {
            self.limit
        }
    }

    pub trait Buildable {
        fn build(&self);
    }
}

pub fn create_forge() -> engine::Forge {
    todo!()
}
`,
      160
    );

    expect(map.imports).toContain("use std::sync::Arc;");
    expect(map.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "DEFAULT_LIMIT", kind: "const", line: 3 }),
        expect.objectContaining({ name: "engine", kind: "unknown", line: 5 }),
        expect.objectContaining({ name: "Forge", kind: "class", line: 6 }),
        expect.objectContaining({ name: "run", kind: "method", line: 11 }),
        expect.objectContaining({ name: "Buildable", kind: "interface", line: 16 }),
        expect.objectContaining({ name: "build", kind: "method", line: 17 }),
        expect.objectContaining({ name: "create_forge", kind: "function", line: 21 })
      ])
    );
  });
});
