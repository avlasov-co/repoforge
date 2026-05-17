import { CodeMapEntry } from "./types";
import { parseFile } from "./parsers/parserRegistry";

export function extractCodeMap(
  filePath: string,
  language: string,
  content: string,
  estimatedTokens: number,
  absolutePath?: string
): Promise<CodeMapEntry> {
  return parseFile({ path: filePath, language, content, absolutePath }).then((result) => ({
    path: filePath,
    language,
    backend: result.backend,
    imports: result.imports,
    symbols: result.symbols,
    diagnostics: result.diagnostics,
    estimatedTokens
  }));
}
