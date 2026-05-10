import { CodeSymbol, ParseResult, ParserBackend } from "../types";

export type { CodeSymbol, ParseResult, ParserBackend };

export interface ParserInput {
  path: string;
  language: string;
  content: string;
  absolutePath?: string;
}

export interface Parser {
  backend: ParserBackend;
  parse(input: ParserInput): ParseResult;
}
