import * as path from "path";
import { execFileSync } from "child_process";
import { CodeSymbol, ParseResult } from "../types";
import { ParserInput } from "./parserTypes";
import { parseWithRegex } from "./regexParser";

interface PythonBridgeResult {
  imports?: unknown;
  symbols?: unknown;
  diagnostics?: unknown;
}

export function parsePythonAst(input: ParserInput): ParseResult {
  if (!input.absolutePath) {
    const fallback = parseWithRegex(input, "regex");
    return { ...fallback, diagnostics: ["python AST parser requires an absolute file path; used regex fallback"] };
  }

  const bridge = resolveBridgePath();
  try {
    const stdout = execFileSync("python3", [bridge, input.absolutePath], {
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const parsed = JSON.parse(stdout) as PythonBridgeResult;
    return {
      path: input.path,
      language: input.language,
      backend: "python-ast",
      imports: stringArray(parsed.imports),
      symbols: symbolArray(parsed.symbols),
      diagnostics: stringArray(parsed.diagnostics)
    };
  } catch (error) {
    const fallback = parseWithRegex(input, "regex");
    return {
      ...fallback,
      diagnostics: [
        `python AST parser unavailable or failed: ${error instanceof Error ? error.message : String(error)}`,
        ...fallback.diagnostics
      ]
    };
  }
}

function resolveBridgePath(): string {
  return path.join(process.cwd(), "src", "core", "parsers", "python_ast_bridge.py");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function symbolArray(value: unknown): CodeSymbol[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): CodeSymbol | undefined => {
      if (!item || typeof item !== "object") {
        return undefined;
      }
      const raw = item as Record<string, unknown>;
      if (typeof raw.name !== "string" || typeof raw.line !== "number") {
        return undefined;
      }
      const kind = raw.kind;
      return {
        name: raw.name,
        kind: isSymbolKind(kind) ? kind : "unknown",
        line: raw.line,
        signature: typeof raw.signature === "string" ? raw.signature : undefined
      };
    })
    .filter((item): item is CodeSymbol => Boolean(item));
}

function isSymbolKind(value: unknown): value is CodeSymbol["kind"] {
  return ["function", "class", "method", "const", "type", "interface", "unknown"].includes(String(value));
}
