export interface ParsedPatch {
  files: ParsedPatchFile[];
  rawText: string;
  diagnostics: string[];
}

export interface ParsedPatchFile {
  oldPath: string;
  newPath: string;
  changeType: "modify" | "add" | "delete" | "rename" | "unknown";
  hunks: ParsedPatchHunk[];
}

export interface ParsedPatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: ParsedPatchLine[];
}

export interface ParsedPatchLine {
  kind: "context" | "add" | "remove";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface PatchApplyResult {
  applied: boolean;
  filesChanged: string[];
  failedFiles: Array<{ path: string; reason: string }>;
  diagnostics: string[];
}

export interface PatchPreview {
  files: Array<{
    path: string;
    changeType: string;
    additions: number;
    deletions: number;
    hunks: number;
  }>;
  totalAdditions: number;
  totalDeletions: number;
  diagnostics: string[];
}
