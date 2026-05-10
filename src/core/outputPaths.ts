import * as fs from "fs/promises";
import * as path from "path";

export interface RepoForgeOutputPaths {
  rootDir: string;
  historyDir: string;
  projectMemoryPath: string;
  lastContextMarkdownPath: string;
  lastContextJsonPath: string;
  lastHandoffMarkdownPath: string;
  profilesPath: string;
  historyContextMarkdownPath: string;
  historyContextJsonPath: string;
  historyHandoffMarkdownPath: string;
}

export async function getOutputPaths(repoRoot: string, generatedAt = new Date().toISOString()): Promise<RepoForgeOutputPaths> {
  const rootDir = path.join(repoRoot, ".repoforge");
  const historyDir = path.join(rootDir, "history");
  await fs.mkdir(historyDir, { recursive: true });
  const safeTimestamp = generatedAt.replace(/[:.]/g, "-");
  return {
    rootDir,
    historyDir,
    projectMemoryPath: path.join(rootDir, "project-memory.md"),
    lastContextMarkdownPath: path.join(rootDir, "last-context.md"),
    lastContextJsonPath: path.join(rootDir, "last-context.json"),
    lastHandoffMarkdownPath: path.join(rootDir, "last-handoff.md"),
    profilesPath: path.join(rootDir, "profiles.json"),
    historyContextMarkdownPath: path.join(historyDir, `context-${safeTimestamp}.md`),
    historyContextJsonPath: path.join(historyDir, `context-${safeTimestamp}.json`),
    historyHandoffMarkdownPath: path.join(historyDir, `handoff-${safeTimestamp}.md`)
  };
}
