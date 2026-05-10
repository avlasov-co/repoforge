import * as fs from "fs/promises";
import { getOutputPaths } from "./outputPaths";

export const PROJECT_MEMORY_TEMPLATE = `# Project Memory

## Purpose

## Architecture Notes

## Important Commands

## Constraints

## Do Not Touch

## Known Issues
`;

export async function readProjectMemory(repoRoot: string): Promise<string | undefined> {
  const memoryPath = (await getOutputPaths(repoRoot)).projectMemoryPath;
  try {
    return await fs.readFile(memoryPath, "utf8");
  } catch {
    return undefined;
  }
}

export async function ensureProjectMemory(repoRoot: string): Promise<string> {
  const memoryPath = (await getOutputPaths(repoRoot)).projectMemoryPath;
  try {
    await fs.access(memoryPath);
  } catch {
    await fs.writeFile(memoryPath, PROJECT_MEMORY_TEMPLATE, "utf8");
  }
  return memoryPath;
}
