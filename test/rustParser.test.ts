import { describe, expect, it } from "vitest";
import { parseRust } from "../src/core/parsers/rustParser";

describe("rust parser", () => {
  it("extracts Rust imports, types, impl methods, traits, constants, statics, modules, and functions", () => {
    const result = parseRust({
      path: "src/lib.rs",
      language: "rust",
      content: `use std::sync::Arc;
pub mod storage;
pub static READY: bool = true;

pub struct Engine;
enum Mode { Fast }
trait Runnable {
    fn run(&self);
}

impl Runnable for Engine {
    pub async fn run(&self) {}
}

pub fn build_engine() -> Engine {
    Engine
}
`
    });

    expect(result.backend).toBe("rust-aware-regex");
    expect(result.imports).toEqual(expect.arrayContaining(["use std::sync::Arc;", "pub mod storage;"]));
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "storage", kind: "unknown" }),
        expect.objectContaining({ name: "READY", kind: "const" }),
        expect.objectContaining({ name: "Engine", kind: "class" }),
        expect.objectContaining({ name: "Mode", kind: "type" }),
        expect.objectContaining({ name: "Runnable", kind: "interface" }),
        expect.objectContaining({ name: "run", kind: "method" }),
        expect.objectContaining({ name: "Engine.run", kind: "method" }),
        expect.objectContaining({ name: "build_engine", kind: "function" })
      ])
    );
    expect(result.diagnostics.join("\n")).toContain("rust-aware regex scanner");
  });
});
