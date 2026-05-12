import * as path from "path";
import * as vscode from "vscode";
import { ContextMode, ContextSelection, RepoScanResult, TokenBudget, TokenizerProfile } from "../core/types";
import { normalizePath } from "../core/repoScanner";
import { SidebarIncludeMode } from "./webviewMessages";

const SELECTED_FILES_KEY = "repoforge.selectedFiles";
const TASK_KEY = "repoforge.task";
const TOKEN_LIMIT_KEY = "repoforge.tokenLimit";
const RESERVED_OUTPUT_KEY = "repoforge.reservedOutput";
const MODE_KEY = "repoforge.mode";
const TOKENIZER_PROFILE_KEY = "repoforge.tokenizerProfile";
const LAST_PACK_KEY = "repoforge.lastPackPath";
const LAST_HANDOFF_KEY = "repoforge.lastHandoffPath";
const LAST_SCAN_KEY = "repoforge.lastScanSummary";
const LAST_SCAN_RESULT_KEY = "repoforge.lastScanResult";
const LAST_BUDGET_KEY = "repoforge.lastTokenBudget";
const DEFAULT_INCLUDE_MODE_KEY = "repoforge.defaultIncludeMode";

export class RepoForgeState {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getSelectedFiles(): ContextSelection[] {
    return this.context.workspaceState.get<ContextSelection[]>(SELECTED_FILES_KEY, []);
  }

  async setSelectedFiles(files: ContextSelection[]): Promise<void> {
    await this.context.workspaceState.update(SELECTED_FILES_KEY, files);
  }

  async addFiles(paths: string[], repoRoot: string): Promise<ContextSelection[]> {
    const selected = this.getSelectedFiles();
    const byPath = new Map(selected.map((item) => [item.path, item]));
    for (const filePath of paths) {
      const relative = normalizePath(path.relative(repoRoot, filePath));
      if (!relative || relative.startsWith("..")) {
        continue;
      }
      byPath.set(relative, { path: relative, includeMode: "full", reason: "selected in VS Code" });
    }
    const next = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    await this.setSelectedFiles(next);
    return next;
  }

  async clearSelectedFiles(): Promise<void> {
    await this.setSelectedFiles([]);
  }

  async setIncludeMode(filePath: string, includeMode: ContextSelection["includeMode"]): Promise<void> {
    const files = this.getSelectedFiles()
      .map((file) => (file.path === filePath ? { ...file, includeMode } : file))
      .filter((file) => file.includeMode !== "none");
    await this.setSelectedFiles(files);
  }

  async addSelection(selection: ContextSelection): Promise<void> {
    const byPath = new Map(this.getSelectedFiles().map((item) => [item.path, item]));
    if (selection.includeMode === "none") {
      byPath.delete(selection.path);
    } else {
      byPath.set(selection.path, selection);
    }
    await this.setSelectedFiles([...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)));
  }

  getTask(): string {
    return this.context.workspaceState.get<string>(TASK_KEY, "");
  }

  async setTask(task: string): Promise<void> {
    await this.context.workspaceState.update(TASK_KEY, task);
  }

  getTokenLimit(): number {
    return this.context.workspaceState.get<number>(TOKEN_LIMIT_KEY, 32768);
  }

  async setTokenLimit(limit: number): Promise<void> {
    await this.context.workspaceState.update(TOKEN_LIMIT_KEY, limit);
  }

  getReservedOutput(defaultValue: number): number {
    return this.context.workspaceState.get<number>(RESERVED_OUTPUT_KEY, defaultValue);
  }

  async setReservedOutput(value: number): Promise<void> {
    await this.context.workspaceState.update(RESERVED_OUTPUT_KEY, value);
  }

  getMode(): ContextMode {
    return this.context.workspaceState.get<ContextMode>(MODE_KEY, "codex");
  }

  async setMode(mode: ContextMode): Promise<void> {
    await this.context.workspaceState.update(MODE_KEY, mode);
  }

  getDefaultIncludeMode(): SidebarIncludeMode {
    return this.context.workspaceState.get<SidebarIncludeMode>(DEFAULT_INCLUDE_MODE_KEY, "smart");
  }

  async setDefaultIncludeMode(mode: SidebarIncludeMode): Promise<void> {
    await this.context.workspaceState.update(DEFAULT_INCLUDE_MODE_KEY, mode);
  }

  getTokenizerProfile(): TokenizerProfile {
    return this.context.workspaceState.get<TokenizerProfile>(TOKENIZER_PROFILE_KEY, "gpt-4-estimate");
  }

  async setTokenizerProfile(profile: TokenizerProfile): Promise<void> {
    await this.context.workspaceState.update(TOKENIZER_PROFILE_KEY, profile);
  }

  getLastPackPath(): string | undefined {
    return this.context.workspaceState.get<string>(LAST_PACK_KEY);
  }

  async setLastPackPath(value: string): Promise<void> {
    await this.context.workspaceState.update(LAST_PACK_KEY, value);
  }

  getLastHandoffPath(): string | undefined {
    return this.context.workspaceState.get<string>(LAST_HANDOFF_KEY);
  }

  async setLastHandoffPath(value: string): Promise<void> {
    await this.context.workspaceState.update(LAST_HANDOFF_KEY, value);
  }

  getLastScanSummary(): string {
    return this.context.workspaceState.get<string>(LAST_SCAN_KEY, "No scan run yet.");
  }

  async setLastScan(scan: RepoScanResult): Promise<void> {
    await this.context.workspaceState.update(LAST_SCAN_KEY, scan.summary);
    await this.context.workspaceState.update(LAST_SCAN_RESULT_KEY, scan);
  }

  getLastScan(): RepoScanResult | undefined {
    return this.context.workspaceState.get<RepoScanResult>(LAST_SCAN_RESULT_KEY);
  }

  getLastTokenBudget(): TokenBudget | undefined {
    return this.context.workspaceState.get<TokenBudget>(LAST_BUDGET_KEY);
  }

  async setLastTokenBudget(budget: TokenBudget): Promise<void> {
    await this.context.workspaceState.update(LAST_BUDGET_KEY, budget);
  }
}
