import { ParsedPatch, ParsedPatchFile, ParsedPatchHunk, ParsedPatchLine } from "./patchTypes";

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;
const DIFF_START = /^diff --git /;
const OLD_FILE = /^--- (.+)$/;
const NEW_FILE = /^\+\+\+ (.+)$/;

export function parseUnifiedDiff(input: string): ParsedPatch {
  const extractedText = extractDiffText(input);
  const diagnostics: string[] = [];

  if (!extractedText.trim()) {
    return { files: [], rawText: "", diagnostics: ["No unified diff content found."] };
  }

  const lines = extractedText.replace(/\r\n/g, "\n").split("\n");
  const files: ParsedPatchFile[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!isFileStart(lines, index)) {
      index += 1;
      continue;
    }

    const block = collectFileBlock(lines, index);
    index = block.nextIndex;
    const parsed = parseFileBlock(block.lines, files.length);
    diagnostics.push(...parsed.diagnostics);
    if (parsed.file) {
      files.push(parsed.file);
    }
  }

  if (!files.length) {
    diagnostics.push("No diff file blocks could be parsed.");
  }

  return { files, rawText: serializeParsedFiles(files), diagnostics };
}

function extractDiffText(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n");
  const fencedBlocks = [...normalized.matchAll(/```diff\s*\n([\s\S]*?)```/gi)].map((match) => match[1].trim());
  if (fencedBlocks.length > 0) {
    return fencedBlocks.filter((block) => looksLikeDiff(block)).join("\n\n").trim();
  }

  const lines = normalized.split("\n");
  const captured: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (!capturing && looksLikeDiffStart(line)) {
      capturing = true;
    }
    if (capturing) {
      captured.push(line);
    }
  }

  return captured.join("\n").trim();
}

function looksLikeDiff(block: string): boolean {
  return /(^|\n)diff --git /.test(block) || /(^|\n)--- /.test(block) || /(^|\n)@@ /.test(block);
}

function looksLikeDiffStart(line: string): boolean {
  return DIFF_START.test(line) || OLD_FILE.test(line) || HUNK_HEADER.test(line);
}

function isFileStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (DIFF_START.test(line)) {
    return true;
  }
  if (OLD_FILE.test(line) && NEW_FILE.test(lines[index + 1] ?? "")) {
    return true;
  }
  return false;
}

function collectFileBlock(lines: string[], startIndex: number): { lines: string[]; nextIndex: number } {
  const block: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    if (index > startIndex && DIFF_START.test(lines[index] ?? "")) {
      break;
    }
    block.push(lines[index]);
    index += 1;
  }
  return { lines: block, nextIndex: index };
}

function parseFileBlock(lines: string[], fileIndex: number): { file?: ParsedPatchFile; diagnostics: string[] } {
  const diagnostics: string[] = [];
  let oldPath = "";
  let newPath = "";
  let diffOldPath = "";
  let diffNewPath = "";
  let renamed = false;
  let sawOldHeader = false;
  let sawNewHeader = false;
  const hunks: ParsedPatchHunk[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (DIFF_START.test(line)) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      if (match) {
        diffOldPath = match[1];
        diffNewPath = match[2];
      }
      index += 1;
      continue;
    }

    if (line.startsWith("rename from ")) {
      diffOldPath = line.slice("rename from ".length).trim();
      renamed = true;
      index += 1;
      continue;
    }

    if (line.startsWith("rename to ")) {
      diffNewPath = line.slice("rename to ".length).trim();
      renamed = true;
      index += 1;
      continue;
    }

    const oldMatch = OLD_FILE.exec(line);
    if (oldMatch) {
      sawOldHeader = true;
      oldPath = normalizeDiffPath(oldMatch[1]);
      index += 1;
      continue;
    }

    const newMatch = NEW_FILE.exec(line);
    if (newMatch) {
      sawNewHeader = true;
      newPath = normalizeDiffPath(newMatch[1]);
      index += 1;
      continue;
    }

    const hunkHeader = HUNK_HEADER.exec(line);
    if (hunkHeader) {
      const parsedHunk = parseHunk(lines, index, fileIndex, hunks.length);
      diagnostics.push(...parsedHunk.diagnostics);
      if (parsedHunk.hunk) {
        hunks.push(parsedHunk.hunk);
      }
      index = parsedHunk.nextIndex;
      continue;
    }

    index += 1;
  }

  const resolvedOldPath = sawOldHeader ? oldPath : diffOldPath;
  const resolvedNewPath = sawNewHeader ? newPath : diffNewPath;
  if (!resolvedOldPath && !resolvedNewPath) {
    diagnostics.push(`File block ${fileIndex + 1} is missing file paths.`);
    return { diagnostics };
  }

  return {
    file: {
      oldPath: resolvedOldPath,
      newPath: resolvedNewPath,
      changeType: detectChangeType(resolvedOldPath, resolvedNewPath, renamed),
      hunks
    },
    diagnostics
  };
}

function parseHunk(
  lines: string[],
  startIndex: number,
  fileIndex: number,
  hunkIndex: number
): { hunk?: ParsedPatchHunk; diagnostics: string[]; nextIndex: number } {
  const diagnostics: string[] = [];
  const headerLine = lines[startIndex];
  const header = HUNK_HEADER.exec(headerLine);
  if (!header) {
    diagnostics.push(`Malformed hunk header in file ${fileIndex + 1}, hunk ${hunkIndex + 1}.`);
    return { diagnostics, nextIndex: startIndex + 1 };
  }

  const oldStart = Number(header[1]);
  const oldLines = Number(header[2] ?? "1");
  const newStart = Number(header[3]);
  const newLines = Number(header[4] ?? "1");
  const parsedLines: ParsedPatchLine[] = [];
  let oldLine = oldStart;
  let newLine = newStart;

  let index = startIndex + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (HUNK_HEADER.test(line) || DIFF_START.test(line) || (OLD_FILE.test(line) && NEW_FILE.test(lines[index + 1] ?? ""))) {
      break;
    }

    if (line.startsWith("\\ No newline at end of file")) {
      index += 1;
      continue;
    }

    const prefix = line[0];
    const content = line.slice(1);
    if (prefix === " ") {
      parsedLines.push({ kind: "context", content, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else if (prefix === "+") {
      parsedLines.push({ kind: "add", content, newLine });
      newLine += 1;
    } else if (prefix === "-") {
      parsedLines.push({ kind: "remove", content, oldLine });
      oldLine += 1;
    } else if (line === "") {
      diagnostics.push(`Malformed empty hunk line in file ${fileIndex + 1}, hunk ${hunkIndex + 1}.`);
    } else {
      diagnostics.push(`Malformed hunk line "${line}" in file ${fileIndex + 1}, hunk ${hunkIndex + 1}.`);
    }
    index += 1;
  }

  return {
    hunk: {
      oldStart,
      oldLines,
      newStart,
      newLines,
      header: headerLine,
      lines: parsedLines
    },
    diagnostics,
    nextIndex: index
  };
}

function normalizeDiffPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed === "/dev/null") {
    return "";
  }
  if (trimmed.startsWith("a/") || trimmed.startsWith("b/")) {
    return trimmed.slice(2);
  }
  return trimmed;
}

function detectChangeType(oldPath: string, newPath: string, renamed: boolean): ParsedPatchFile["changeType"] {
  if (renamed || (oldPath && newPath && oldPath !== newPath)) {
    return "rename";
  }
  if (!oldPath && newPath) {
    return "add";
  }
  if (oldPath && !newPath) {
    return "delete";
  }
  if (oldPath && newPath) {
    return "modify";
  }
  return "unknown";
}

function serializeParsedFiles(files: ParsedPatchFile[]): string {
  return files.map(serializeFile).join("\n").trim();
}

function serializeFile(file: ParsedPatchFile): string {
  const oldPath = file.oldPath ? `a/${file.oldPath}` : "/dev/null";
  const newPath = file.newPath ? `b/${file.newPath}` : "/dev/null";
  const currentPath = file.newPath || file.oldPath;
  const lines: string[] = [`diff --git ${oldPath} ${newPath}`];

  if (file.changeType === "rename" && file.oldPath && file.newPath) {
    lines.push(`rename from ${file.oldPath}`, `rename to ${file.newPath}`);
  }

  lines.push(`--- ${oldPath}`, `+++ ${newPath}`);
  for (const hunk of file.hunks) {
    lines.push(hunk.header);
    for (const line of hunk.lines) {
      const prefix = line.kind === "context" ? " " : line.kind === "add" ? "+" : "-";
      lines.push(`${prefix}${line.content}`);
    }
  }

  if (!file.hunks.length && currentPath) {
    lines.push(`@@ -0,0 +0,0 @@`);
  }

  return lines.join("\n");
}
