import * as fs from "fs/promises";
import * as path from "path";
import { PatchApplyResult, PatchPreview } from "./patchTypes";

export interface PatchHistoryPaths {
  rootDir: string;
  historyDir: string;
  tmpDir: string;
  lastPatchPath: string;
  lastPatchPreviewJsonPath: string;
  lastPatchPreviewMarkdownPath: string;
  lastPatchResultPath: string;
  historyPatchPath: string;
  historyPatchPreviewJsonPath: string;
  historyPatchPreviewMarkdownPath: string;
  historyPatchResultPath: string;
}

export async function getPatchHistoryPaths(repoRoot: string, generatedAt = new Date().toISOString()): Promise<PatchHistoryPaths> {
  const rootDir = path.join(repoRoot, ".repoforge");
  const historyDir = path.join(rootDir, "history");
  const tmpDir = path.join(rootDir, "tmp");
  await Promise.all([fs.mkdir(historyDir, { recursive: true }), fs.mkdir(tmpDir, { recursive: true })]);
  const safeTimestamp = generatedAt.replace(/[:.]/g, "-");

  return {
    rootDir,
    historyDir,
    tmpDir,
    lastPatchPath: path.join(rootDir, "last-patch.diff"),
    lastPatchPreviewJsonPath: path.join(rootDir, "last-patch-preview.json"),
    lastPatchPreviewMarkdownPath: path.join(rootDir, "last-patch-preview.md"),
    lastPatchResultPath: path.join(rootDir, "last-patch-result.json"),
    historyPatchPath: path.join(historyDir, `patch-${safeTimestamp}.diff`),
    historyPatchPreviewJsonPath: path.join(historyDir, `patch-${safeTimestamp}-preview.json`),
    historyPatchPreviewMarkdownPath: path.join(historyDir, `patch-${safeTimestamp}-preview.md`),
    historyPatchResultPath: path.join(historyDir, `patch-${safeTimestamp}-result.json`)
  };
}

export async function saveParsedPatch(repoRoot: string, patchText: string, preview: PatchPreview, markdown?: string): Promise<PatchHistoryPaths> {
  const paths = await getPatchHistoryPaths(repoRoot);
  const normalizedPatchText = `${patchText}${patchText.endsWith("\n") ? "" : "\n"}`;
  const writes: Array<Promise<unknown>> = [
    fs.writeFile(paths.lastPatchPath, normalizedPatchText, "utf8"),
    fs.writeFile(paths.lastPatchPreviewJsonPath, JSON.stringify(preview, null, 2), "utf8"),
    fs.writeFile(paths.historyPatchPath, normalizedPatchText, "utf8"),
    fs.writeFile(paths.historyPatchPreviewJsonPath, JSON.stringify(preview, null, 2), "utf8")
  ];

  if (markdown !== undefined) {
    writes.push(
      fs.writeFile(paths.lastPatchPreviewMarkdownPath, markdown, "utf8"),
      fs.writeFile(paths.historyPatchPreviewMarkdownPath, markdown, "utf8")
    );
  }

  await Promise.all(writes);
  return paths;
}

export async function savePatchApplyResult(repoRoot: string, result: PatchApplyResult): Promise<PatchHistoryPaths> {
  const paths = await getPatchHistoryPaths(repoRoot);
  const payload = JSON.stringify({ savedAt: new Date().toISOString(), ...result }, null, 2);
  await Promise.all([
    fs.writeFile(paths.lastPatchResultPath, payload, "utf8"),
    fs.writeFile(paths.historyPatchResultPath, payload, "utf8")
  ]);
  return paths;
}

export async function readLastPatch(repoRoot: string): Promise<string | undefined> {
  try {
    const paths = await getPatchHistoryPaths(repoRoot);
    return await fs.readFile(paths.lastPatchPath, "utf8");
  } catch {
    return undefined;
  }
}

export async function readLastPatchPreview(repoRoot: string): Promise<PatchPreview | undefined> {
  try {
    const paths = await getPatchHistoryPaths(repoRoot);
    return JSON.parse(await fs.readFile(paths.lastPatchPreviewJsonPath, "utf8")) as PatchPreview;
  } catch {
    return undefined;
  }
}
