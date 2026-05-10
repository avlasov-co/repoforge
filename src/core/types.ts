export type ContextMode = "codex" | "local-qwen" | "continue";

export type ParserBackend =
  | "python-ast"
  | "tree-sitter"
  | "rust-aware-regex"
  | "regex"
  | "markdown"
  | "none";

export type TokenizerProfile =
  | "gpt-4-estimate"
  | "qwen-estimate"
  | "llama-estimate"
  | "chars-only";

export interface RepoFile {
  path: string;
  absolutePath: string;
  language: string;
  sizeBytes: number;
  estimatedTokens: number;
  modifiedTimeMs: number;
  gitStatus?: string;
}

export interface CodeSymbol {
  name: string;
  kind: "function" | "class" | "method" | "const" | "type" | "interface" | "unknown";
  line: number;
  signature?: string;
}

export interface CodeMapEntry {
  path: string;
  language: string;
  backend: ParserBackend;
  imports: string[];
  symbols: CodeSymbol[];
  diagnostics?: string[];
  estimatedTokens: number;
}

export interface ContextSelection {
  path: string;
  includeMode: "full" | "codemap" | "snippet" | "none";
  reason?: string;
  reasons?: string[];
  score?: number;
}

export interface TokenBudget {
  limit: number;
  reservedOutput: number;
  usedInput: number;
  remainingInput: number;
}

export interface ContextPack {
  mode: ContextMode;
  task: string;
  repoRoot: string;
  generatedAt: string;
  projectMemory?: string;
  repoSummary: string;
  selectedFiles: ContextSelection[];
  codeMap: CodeMapEntry[];
  fullFiles: Array<{ path: string; content: string; estimatedTokens: number }>;
  logs: string[];
  constraints: string[];
  validationCommands: string[];
  tokenBudget: TokenBudget;
  tokenizerProfile: TokenizerProfile;
  gitDiff?: GitDiffSummary;
  relevance?: RelevanceScore[];
  budgetWarnings?: string[];
}

export interface RepoScanResult {
  repoRoot: string;
  files: RepoFile[];
  codeMap: CodeMapEntry[];
  summary: string;
}

export interface PackOptions {
  mode: ContextMode;
  task: string;
  repoRoot: string;
  tokenLimit: number;
  reservedOutput: number;
  selectedFiles: ContextSelection[];
  openFiles?: string[];
  logs?: string[];
  tokenizerProfile?: TokenizerProfile;
}

export interface SavedContextPack {
  pack: ContextPack;
  markdown: string;
  jsonPath: string;
  markdownPath: string;
}

export interface SavedHandoff {
  markdown: string;
  markdownPath: string;
}

export interface ParseResult {
  path: string;
  language: string;
  backend: ParserBackend;
  imports: string[];
  symbols: CodeSymbol[];
  diagnostics: string[];
}

export interface GitDiffHunk {
  filePath: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  bodyPreview: string;
}

export interface GitDiffSummary {
  changedFiles: string[];
  hunks: GitDiffHunk[];
}

export interface RelevanceScore {
  path: string;
  score: number;
  reasons: string[];
}

export interface BudgetOptimizationResult {
  selections: ContextSelection[];
  budget: TokenBudget;
  warnings: string[];
}
