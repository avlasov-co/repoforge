import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function getGitStatus(repoRoot: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoRoot, "status", "--porcelain=v1", "-z", "--untracked-files=all"], {
      encoding: "buffer",
      timeout: 5000
    });
    const records = stdout.toString("utf8").split("\0").filter(Boolean);
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (record.length < 4) {
        continue;
      }
      const status = record.slice(0, 2).trim();
      const filePath = normalizePath(record.slice(3));
      result.set(filePath, status);
      if (status.startsWith("R") || status.startsWith("C")) {
        index++;
      }
    }
  } catch {
    return result;
  }
  return result;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
