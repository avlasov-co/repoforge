import ts from "typescript";
import { CodeSymbol, ParseResult, ParserBackend } from "../types";
import { ParserInput } from "./parserTypes";

export function parseWithRegex(input: ParserInput, backend: ParserBackend = backendForLanguage(input.language)): ParseResult {
  try {
    const lines = input.content.split(/\r?\n/);
    return {
      path: input.path,
      language: input.language,
      backend,
      imports: extractImports(input.language, lines),
      symbols: extractSymbols(input.path, input.language, input.content, lines),
      diagnostics: []
    };
  } catch (error) {
    return {
      path: input.path,
      language: input.language,
      backend,
      imports: [],
      symbols: [],
      diagnostics: [`regex parser failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

export function backendForLanguage(language: string): ParserBackend {
  return language === "markdown" ? "markdown" : language === "text" ? "none" : "regex";
}

export function extractImports(language: string, lines: string[]): string[] {
  const imports = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    const matches: RegExp[] =
      language === "python"
        ? [/^(?:from\s+[\w.]+\s+import\s+.+|import\s+.+)$/]
        : language === "rust"
          ? [/^(?:(?:pub\s+)?use\s+.+;|(?:pub\s+)?mod\s+[A-Za-z_]\w*\s*;)$/]
          : language === "go"
            ? [/^import\s+(?:\(.+|\S+)/]
            : language === "java"
              ? [/^import\s+.+;$/]
              : [/^(?:import\s+.+from\s+["'].+["'];?|import\s+["'].+["'];?|export\s+.+from\s+["'].+["'];?|const\s+\w+\s*=\s*require\(.+\);?)$/];
    if (matches.some((regex) => regex.test(trimmed))) {
      imports.add(trimmed);
    }
  }
  return [...imports].slice(0, 80);
}

function extractSymbols(filePath: string, language: string, content: string, lines: string[]): CodeSymbol[] {
  if (language === "python") {
    return extractPythonSymbols(lines);
  }
  if (language === "go") {
    return extractGoSymbols(lines);
  }
  if (language === "java") {
    return extractJavaSymbols(lines);
  }
  if (language === "markdown") {
    return extractMarkdownSymbols(lines);
  }
  if (language === "typescript" || language === "javascript") {
    return extractTsJsSymbols(filePath, content, language);
  }
  return [];
}

function extractTsJsSymbols(filePath: string, content: string, language: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const scriptKind = scriptKindForPath(filePath, language);
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
  const printer = ts.createPrinter({ removeComments: true });

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push(toTsSymbol(sourceFile, printer, node.name.text, "function", node));
    } else if (ts.isClassDeclaration(node) && node.name) {
      symbols.push(toTsSymbol(sourceFile, printer, node.name.text, "class", node));
    } else if (ts.isInterfaceDeclaration(node)) {
      symbols.push(toTsSymbol(sourceFile, printer, node.name.text, "interface", node));
    } else if (ts.isTypeAliasDeclaration(node)) {
      symbols.push(toTsSymbol(sourceFile, printer, node.name.text, "type", node));
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      symbols.push(toTsSymbol(sourceFile, printer, node.name.text, "method", node));
    } else if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name)) {
      symbols.push(toTsSymbol(sourceFile, printer, node.name.text, "const", node));
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          const kind = declaration.initializer && isFunctionLikeInitializer(declaration.initializer) ? "function" : "const";
          symbols.push(toTsSymbol(sourceFile, printer, declaration.name.text, kind, declaration));
        }
      }
    } else if (ts.isExportAssignment(node)) {
      const name = defaultExportName(node.expression);
      if (name) {
        symbols.push(toTsSymbol(sourceFile, printer, name, "function", node));
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return symbols;
}

function isFunctionLikeInitializer(node: ts.Expression): boolean {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return true;
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression.getText();
    return ["memo", "React.memo", "forwardRef", "React.forwardRef"].includes(callee);
  }
  return false;
}

function defaultExportName(node: ts.Expression): string | undefined {
  if (ts.isIdentifier(node)) {
    return `default:${node.text}`;
  }
  if (ts.isCallExpression(node)) {
    return `default:${node.expression.getText()}`;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return "default";
  }
  return undefined;
}

function scriptKindForPath(filePath: string, language: string): ts.ScriptKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (lower.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  return language === "typescript" ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function toTsSymbol(sourceFile: ts.SourceFile, printer: ts.Printer, name: string, kind: CodeSymbol["kind"], node: ts.Node): CodeSymbol {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return {
    name,
    kind,
    line,
    signature: compactSignature(printer.printNode(ts.EmitHint.Unspecified, node, sourceFile))
  };
}

function extractPythonSymbols(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const classStack: Array<{ indent: number; name: string }> = [];
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const indent = indentation(line);
    while (classStack.length && indent <= classStack[classStack.length - 1].indent) {
      classStack.pop();
    }
    const classMatch = /^(\s*)class\s+([A-Za-z_]\w*)/.exec(line);
    if (classMatch) {
      symbols.push(toSymbol(classMatch[2], "class", index, line));
      classStack.push({ indent: classMatch[1].length, name: classMatch[2] });
      return;
    }
    const fnMatch = /^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(line);
    if (fnMatch) {
      const className = classStack[classStack.length - 1]?.name;
      const name = className ? `${className}.${fnMatch[2]}` : fnMatch[2];
      symbols.push(toSymbol(name, className ? "method" : "function", index, collectSignature(lines, index, ":")));
      if (className) {
        symbols.push(toSymbol(fnMatch[2], "method", index, collectSignature(lines, index, ":")));
      }
      return;
    }
    const constMatch = /^([A-Z][A-Z0-9_]+)\s*[:=]/.exec(trimmed);
    if (constMatch && indent === 0) {
      symbols.push(toSymbol(constMatch[1], "const", index, line));
    }
  });
  return symbols;
}

function extractGoSymbols(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const patterns: Array<[RegExp, CodeSymbol["kind"]]> = [
    [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/, "function"],
    [/^\s*type\s+([A-Za-z_]\w*)\s+struct/, "class"],
    [/^\s*type\s+([A-Za-z_]\w*)\s+interface/, "interface"],
    [/^\s*const\s+([A-Za-z_]\w*)/, "const"]
  ];
  collectSymbols(lines, patterns, symbols);
  return symbols;
}

function extractJavaSymbols(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const patterns: Array<[RegExp, CodeSymbol["kind"]]> = [
    [/^\s*(?:public|private|protected)?\s*(?:static\s+)?class\s+([A-Za-z_]\w*)/, "class"],
    [/^\s*(?:public|private|protected)?\s*interface\s+([A-Za-z_]\w*)/, "interface"],
    [/^\s*(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\([^)]*\)/, "method"]
  ];
  collectSymbols(lines, patterns, symbols);
  return symbols;
}

function extractMarkdownSymbols(lines: string[]): CodeSymbol[] {
  return lines
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+)$/.exec(line);
      return match ? toSymbol(match[2].trim(), "unknown", index, line) : undefined;
    })
    .filter((symbol): symbol is CodeSymbol => Boolean(symbol));
}

function collectSymbols(lines: string[], patterns: Array<[RegExp, CodeSymbol["kind"]]>, symbols: CodeSymbol[]): void {
  lines.forEach((line, index) => {
    for (const [regex, kind] of patterns) {
      const match = regex.exec(line);
      if (match) {
        symbols.push(toSymbol(match[1], kind, index, line));
        break;
      }
    }
  });
}

export function toSymbol(name: string, kind: CodeSymbol["kind"], index: number, line: string): CodeSymbol {
  return {
    name,
    kind,
    line: index + 1,
    signature: compactSignature(line)
  };
}

export function compactSignature(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function indentation(line: string): number {
  const match = /^(\s*)/.exec(line);
  return match ? match[1].replace(/\t/g, "    ").length : 0;
}

function collectSignature(lines: string[], startIndex: number, terminator: string | string[]): string {
  const terminators = Array.isArray(terminator) ? terminator : [terminator];
  const parts: string[] = [];
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index++) {
    parts.push(lines[index].trim());
    if (terminators.some((item) => lines[index].includes(item))) {
      break;
    }
  }
  return parts.join(" ");
}
