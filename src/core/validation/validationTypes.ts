export interface ValidationCommand {
  label: string;
  command: string;
  cwd?: string;
}

export interface ValidationRunResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
}
