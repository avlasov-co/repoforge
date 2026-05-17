import { ParseResult } from "../types";
import { parsePythonAst } from "./pythonAstParser";
import { ParserInput } from "./parserTypes";
import { parseWithRegex } from "./regexParser";
import { parseRust } from "./rustParser";

export async function parseFile(input: ParserInput): Promise<ParseResult> {
  try {
    if (input.language === "python") {
      return parsePythonAst(input);
    }
    if (input.language === "rust") {
      return parseRust(input);
    }
    return parseWithRegex(input);
  } catch (error) {
    return {
      path: input.path,
      language: input.language,
      backend: "none",
      imports: [],
      symbols: [],
      diagnostics: [`parser registry failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}
