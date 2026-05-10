import { CodeSymbol, ParseResult } from "../types";
import { ParserInput } from "./parserTypes";
import { compactSignature, extractImports, toSymbol } from "./regexParser";

interface ImplContext {
  kind: "impl" | "trait";
  typeName: string;
  depth: number;
}

export function parseRust(input: ParserInput): ParseResult {
  try {
    const lines = input.content.split(/\r?\n/);
    return {
      path: input.path,
      language: input.language,
      backend: "rust-aware-regex",
      imports: extractImports("rust", lines),
      symbols: extractRustSymbols(lines),
      diagnostics: ["Rust parser uses a rust-aware regex scanner; full rust-analyzer/tree-sitter support is future work."]
    };
  } catch (error) {
    return {
      path: input.path,
      language: input.language,
      backend: "rust-aware-regex",
      imports: [],
      symbols: [],
      diagnostics: [`rust-aware parser failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

export function extractRustSymbols(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const implStack: ImplContext[] = [];
  let braceDepth = 0;

  lines.forEach((line, index) => {
    const stripped = stripLineComment(line);
    const trimmed = stripped.trim();
    while (implStack.length && braceDepth < implStack[implStack.length - 1].depth) {
      implStack.pop();
    }

    const implMatch = parseImpl(trimmed);
    if (implMatch && trimmed.includes("{")) {
      symbols.push(toSymbol(implMatch.typeName, "type", index, stripped));
      implStack.push({ kind: "impl", typeName: implMatch.typeName, depth: braceDepth + 1 });
    }

    const typePatterns: Array<[RegExp, CodeSymbol["kind"]]> = [
      [/^(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_]\w*)/, "class"],
      [/^(?:pub(?:\([^)]*\))?\s+)?enum\s+([A-Za-z_]\w*)/, "type"],
      [/^(?:pub(?:\([^)]*\))?\s+)?(?:unsafe\s+)?trait\s+([A-Za-z_]\w*)/, "interface"],
      [/^(?:pub(?:\([^)]*\))?\s+)?type\s+([A-Za-z_]\w*)/, "type"],
      [/^(?:pub(?:\([^)]*\))?\s+)?(?:const|static)\s+([A-Za-z_]\w*)/, "const"],
      [/^(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_]\w*)/, "unknown"]
    ];

    for (const [regex, kind] of typePatterns) {
      const match = regex.exec(trimmed);
      if (match) {
        symbols.push(toSymbol(match[1], kind, index, collectSignature(lines, index)));
        if (kind === "interface" && trimmed.includes("{")) {
          implStack.push({ kind: "trait", typeName: match[1], depth: braceDepth + 1 });
        }
        break;
      }
    }

    const fnMatch = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]+"\s+)?fn\s+([A-Za-z_]\w*)\s*(?:<[^>]+>)?\s*\(/.exec(trimmed);
    if (fnMatch) {
      const context = implStack[implStack.length - 1];
      const signature = collectSignature(lines, index);
      if (context) {
        if (context.kind === "impl") {
          symbols.push(toSymbol(`${context.typeName}.${fnMatch[1]}`, "method", index, signature));
        }
        symbols.push(toSymbol(fnMatch[1], "method", index, signature));
      } else {
        symbols.push(toSymbol(fnMatch[1], "function", index, signature));
      }
    }

    const macroMatch = /^macro_rules!\s+([A-Za-z_]\w*)/.exec(trimmed);
    if (macroMatch) {
      symbols.push(toSymbol(macroMatch[1], "function", index, collectSignature(lines, index)));
    }

    braceDepth += countBraceDelta(stripped);
  });

  return symbols;
}

function parseImpl(trimmed: string): { typeName: string } | undefined {
  const match = /^(?:unsafe\s+)?impl(?:\s*<[^>{]+>)?\s+(.+?)\s*\{/.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const declaration = match[1].trim();
  const forMatch = /\bfor\s+([A-Za-z_][\w:<>]*)/.exec(declaration);
  const rawType = forMatch ? forMatch[1] : declaration.split(/\s+/)[0];
  const typeName = rawType.replace(/<.*$/, "").split("::").pop();
  return typeName ? { typeName } : undefined;
}

function collectSignature(lines: string[], startIndex: number): string {
  const parts: string[] = [];
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index++) {
    parts.push(lines[index].trim());
    if (/[{;]/.test(lines[index])) {
      break;
    }
  }
  return compactSignature(parts.join(" "));
}

function stripLineComment(line: string): string {
  const index = line.indexOf("//");
  return index >= 0 ? line.slice(0, index) : line;
}

function countBraceDelta(line: string): number {
  let delta = 0;
  let inString = false;
  let quote = "";
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if ((char === "\"" || char === "'") && line[index - 1] !== "\\") {
      if (inString && char === quote) {
        inString = false;
      } else if (!inString) {
        inString = true;
        quote = char;
      }
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      delta++;
    } else if (char === "}") {
      delta--;
    }
  }
  return delta;
}
