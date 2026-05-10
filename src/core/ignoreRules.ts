import * as fs from "fs/promises";
import * as path from "path";

const BUILT_IN_IGNORED_NAMES = new Set([
  ".git",
  ".repoforge",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".cache",
  ".DS_Store"
]);

const BUILT_IN_IGNORED_EXTENSIONS = new Set([
  ".pyc",
  ".pyo",
  ".log",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".bin",
  ".gguf",
  ".safetensors"
]);

interface IgnoreRule {
  negate: boolean;
  regex: RegExp;
}

export class IgnoreMatcher {
  constructor(private readonly rules: IgnoreRule[]) {}

  ignores(filePath: string): boolean {
    const normalized = normalizePath(filePath).replace(/^\/+/, "");
    if (isBuiltInIgnored(normalized)) {
      return true;
    }

    let ignored = false;
    for (const rule of this.rules) {
      if (rule.regex.test(normalized)) {
        ignored = !rule.negate;
      }
    }
    return ignored;
  }
}

export async function loadIgnoreRules(repoRoot: string): Promise<IgnoreMatcher> {
  const rules: IgnoreRule[] = [];
  for (const fileName of [".gitignore", ".repoforgeignore"]) {
    const fileRules = await readIgnoreFile(path.join(repoRoot, fileName));
    rules.push(...fileRules);
  }
  return new IgnoreMatcher(rules);
}

export function shouldIgnore(filePath: string, matcher?: IgnoreMatcher): boolean {
  const normalized = normalizePath(filePath);
  if (matcher) {
    return matcher.ignores(normalized);
  }
  return isBuiltInIgnored(normalized);
}

export function isBuiltInIgnored(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  if (parts.some((part) => BUILT_IN_IGNORED_NAMES.has(part))) {
    return true;
  }
  return BUILT_IN_IGNORED_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

async function readIgnoreFile(filePath: string): Promise<IgnoreRule[]> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map(parseIgnoreRule);
  } catch {
    return [];
  }
}

function parseIgnoreRule(rawRule: string): IgnoreRule {
  const negate = rawRule.startsWith("!");
  let pattern = negate ? rawRule.slice(1) : rawRule;
  const directoryOnly = pattern.endsWith("/");
  const anchored = pattern.startsWith("/");
  pattern = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
  const regexSource = globToRegex(pattern);
  const prefix = anchored || pattern.includes("/") ? "^" : "(^|.*/)";
  const suffix = directoryOnly ? "(/.*)?$" : "($|/.*$)";
  return {
    negate,
    regex: new RegExp(`${prefix}${regexSource}${suffix}`)
  };
}

function globToRegex(pattern: string): string {
  let output = "";
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      output += ".*";
      index++;
    } else if (char === "*") {
      output += "[^/]*";
    } else if (char === "?") {
      output += "[^/]";
    } else {
      output += escapeRegex(char);
    }
  }
  return output;
}

function escapeRegex(char: string): string {
  return /[|\\{}()[\]^$+*?.]/.test(char) ? `\\${char}` : char;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
