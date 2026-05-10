import { spawn } from "child_process";
import { ValidationRunResult } from "./validationTypes";

export async function runValidationCommand(
  repoRoot: string,
  command: string,
  timeoutMs = 120_000
): Promise<ValidationRunResult> {
  const startedAt = Date.now();

  return new Promise<ValidationRunResult>((resolve) => {
    const child = spawn(command, {
      cwd: repoRoot,
      shell: true,
      env: process.env
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutHit = false;

    const finish = (exitCode: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        command,
        exitCode,
        stdout,
        stderr: timeoutHit ? `${stderr}${stderr ? "\n" : ""}Validation timed out after ${timeoutMs}ms.` : stderr,
        durationMs: Date.now() - startedAt,
        passed: !timeoutHit && exitCode === 0
      });
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += error.message;
      finish(null);
    });
    child.on("close", (code) => finish(code));

    const timer = setTimeout(() => {
      timeoutHit = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, timeoutMs);
  });
}
