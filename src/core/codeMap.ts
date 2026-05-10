import { CodeMapEntry } from "./types";
import { parseFile } from "./parsers/parserRegistry";

export function extractCodeMap(
  filePath: string,
  language: string,
  content: string,
  estimatedTokens: number,
  absolutePath?: string
): CodeMapEntry {
  const result = parseFile({ path: filePath, language, content, absolutePath });
  return {
    path: filePath,
    language,
    backend: result.backend,
    imports: result.imports,
    symbols: result.symbols,
    diagnostics: result.diagnostics,
    estimatedTokens
  };
}
