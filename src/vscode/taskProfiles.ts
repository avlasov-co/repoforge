import * as fs from "fs/promises";
import { getOutputPaths } from "../core/outputPaths";
import { ContextMode, ContextSelection, TokenizerProfile } from "../core/types";

export interface TaskProfile {
  name: string;
  task: string;
  mode: ContextMode;
  contextLimit: number;
  reservedOutput: number;
  tokenizerProfile: TokenizerProfile;
  selectedFiles: ContextSelection[];
}

export async function listTaskProfiles(repoRoot: string): Promise<TaskProfile[]> {
  const paths = await getOutputPaths(repoRoot);
  try {
    const raw = await fs.readFile(paths.profilesPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isTaskProfile) : [];
  } catch {
    return [];
  }
}

export async function saveTaskProfile(repoRoot: string, profile: TaskProfile): Promise<TaskProfile[]> {
  const profiles = await listTaskProfiles(repoRoot);
  const byName = new Map(profiles.map((item) => [item.name, item]));
  byName.set(profile.name, profile);
  const next = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const paths = await getOutputPaths(repoRoot);
  await fs.writeFile(paths.profilesPath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function isTaskProfile(value: unknown): value is TaskProfile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    typeof record.task === "string" &&
    typeof record.mode === "string" &&
    typeof record.contextLimit === "number" &&
    typeof record.reservedOutput === "number" &&
    typeof record.tokenizerProfile === "string" &&
    Array.isArray(record.selectedFiles)
  );
}
