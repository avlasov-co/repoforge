import { ParsedPatch, PatchPreview } from "./patchTypes";

export function buildPatchPreview(parsed: ParsedPatch): PatchPreview {
  const files = parsed.files.map((file) => {
    let additions = 0;
    let deletions = 0;
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.kind === "add") {
          additions += 1;
        } else if (line.kind === "remove") {
          deletions += 1;
        }
      }
    }

    return {
      path: file.newPath || file.oldPath,
      changeType: file.changeType,
      additions,
      deletions,
      hunks: file.hunks.length
    };
  });

  return {
    files,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
    diagnostics: [...parsed.diagnostics]
  };
}
