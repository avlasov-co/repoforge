import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { buildContextPack, saveContextPack } from "../core/contextPack";
import { extractCodeMap } from "../core/codeMap";
import { ensureProjectMemory } from "../core/projectMemory";
import { languageForPath, normalizePath, scanRepo } from "../core/repoScanner";
import { estimateTokens } from "../core/tokenEstimator";
import { ContextMode } from "../core/types";
import { formatPack } from "../core/contextPack";
import { HandoffKind } from "../formatters/handoffTypes";
import { copyTextToClipboard } from "./clipboard";
import { searchFiles } from "./filePicker";
import { formatHandoff, saveHandoff } from "./handoffCommands";
import { RepoForgePatchCommands } from "./patchCommands";
import { listTaskProfiles, saveTaskProfile } from "./taskProfiles";
import { RepoForgeValidationCommands } from "./validationCommands";
import { WebviewToExtensionMessage } from "./webviewMessages";
import { RepoForgeState } from "./workspaceState";
import { RepoForgeWebviewProvider } from "./webviewProvider";

export class RepoForgeCommands {
  private readonly patchCommands = new RepoForgePatchCommands();
  private readonly validationCommands = new RepoForgeValidationCommands();

  constructor(
    private readonly state: RepoForgeState,
    private readonly webviewProvider?: RepoForgeWebviewProvider
  ) {}

  register(context: vscode.ExtensionContext): void {
    const commands: Array<[string, (...args: unknown[]) => Promise<void>]> = [
      ["repoforge.scanRepo", () => this.scanRepo()],
      ["repoforge.generateRepoMap", () => this.generateRepoMap()],
      ["repoforge.generateCodexPack", () => this.generatePack("codex")],
      ["repoforge.generateLocalQwenPack", () => this.generatePack("local-qwen")],
      ["repoforge.addCurrentFileToContext", () => this.addCurrentFile()],
      ["repoforge.addOpenEditorsToContext", () => this.addOpenEditors()],
      ["repoforge.clearSelectedContext", () => this.clearSelection()],
      ["repoforge.openSidebar", () => this.openSidebar()],
      ["repoforge.writeProjectMemory", () => this.writeProjectMemory()],
      ["repoforge.openLastContextPack", () => this.openLastContextPack()],
      ["repoforge.copyLastPack", () => this.copyLastPack()],
      ["repoforge.copyCodexHandoff", () => this.copyHandoff("codex")],
      ["repoforge.copyLocalQwenHandoff", () => this.copyHandoff("local-qwen")],
      ["repoforge.copyContinueHandoff", () => this.copyHandoff("continue")],
      ["repoforge.saveTaskProfile", () => this.saveTaskProfile()],
      ["repoforge.loadTaskProfile", () => this.loadTaskProfile()],
      ["repoforge.searchFiles", () => this.searchFiles()],
      ["repoforge.parsePatchFromClipboard", () => this.parsePatchFromClipboard()],
      ["repoforge.previewPatch", () => this.previewPatch()],
      ["repoforge.applyLastPatch", () => this.applyLastPatch()],
      ["repoforge.runValidation", () => this.runValidation()],
      ["repoforge.openLastPatch", () => this.openLastPatch()],
      ["repoforge.openLastValidation", () => this.openLastValidation()]
    ];
    for (const [id, handler] of commands) {
      context.subscriptions.push(vscode.commands.registerCommand(id, handler));
    }
  }

  async scanRepo(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    this.webviewProvider?.postProgress("Scanning workspace...");
    const scan = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "RepoForge: scanning repository" },
      async (progress) => {
        progress.report({ message: "Loaded ignore rules..." });
        this.webviewProvider?.postProgress("Loaded ignore rules...");
        const result = await scanRepo(repoRoot);
        progress.report({ message: `Found ${result.files.length} files...` });
        this.webviewProvider?.postProgress(`Found ${result.files.length} files...`);
        this.webviewProvider?.postProgress("Built code maps...");
        this.webviewProvider?.postProgress("Loaded git diff summary...");
        return result;
      }
    );
    await this.state.setLastScan(scan);
    this.webviewProvider?.postProgress("Done.", true);
    await this.webviewProvider?.refresh();
    vscode.window.showInformationMessage(`RepoForge scanned ${scan.files.length} files.`);
  }

  async generateRepoMap(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const scan = await scanRepo(repoRoot);
    await this.state.setLastScan(scan);
    const dir = path.join(repoRoot, ".repoforge");
    await fs.mkdir(dir, { recursive: true });
    const markdown = [`# RepoForge Repo Map`, "", scan.summary, "", ...scan.codeMap.map((entry) => {
      const symbols = entry.symbols.map((symbol) => `- L${symbol.line} ${symbol.kind} ${symbol.name}`).join("\n") || "- none";
      return `## ${entry.path}\nLanguage: ${entry.language}\n\n${symbols}`;
    })].join("\n");
    const output = path.join(dir, "repo-map.md");
    await fs.writeFile(output, markdown, "utf8");
    await this.openFile(output);
    this.webviewProvider?.refresh();
  }

  async generatePack(
    mode: ContextMode,
    overrides?: { task?: string; tokenLimit?: number; reservedOutput?: number; copyOnly?: boolean }
  ): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const task = await this.resolveTask(overrides?.task);
    if (!task) {
      return;
    }
    const defaultReserved = mode === "codex" ? 8000 : 16000;
    const tokenLimit = overrides?.tokenLimit ?? this.state.getTokenLimit();
    const reservedOutput = overrides?.reservedOutput ?? this.state.getReservedOutput(defaultReserved);
    await this.state.setTask(task);
    await this.state.setMode(mode);
    await this.state.setTokenLimit(tokenLimit);
    await this.state.setReservedOutput(reservedOutput);

    const openFiles = vscode.window.visibleTextEditors
      .map((editor) => normalizePath(path.relative(repoRoot, editor.document.uri.fsPath)))
      .filter((relative) => relative && !relative.startsWith(".."));

    const pack = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "RepoForge: generating context pack" },
      () =>
        buildContextPack({
          mode,
          task,
          repoRoot,
          tokenLimit,
          reservedOutput,
          selectedFiles: this.state.getSelectedFiles(),
          openFiles,
          tokenizerProfile: this.state.getTokenizerProfile()
        })
    );
    const saved = await saveContextPack(pack);
    const handoffKind = this.handoffKindForMode(mode);
    const handoff = await saveHandoff(pack, handoffKind);
    await this.state.setLastPackPath(saved.markdownPath);
    await this.state.setLastHandoffPath(handoff.markdownPath);
    await this.state.setLastTokenBudget(pack.tokenBudget);
    if (!overrides?.copyOnly) {
      await this.openFile(saved.markdownPath);
    }
    await this.webviewProvider?.refresh();
    const overBudget = pack.tokenBudget.remainingInput < 0 ? " Pack exceeds budget." : "";
    vscode.window.showInformationMessage(`RepoForge wrote ${path.relative(repoRoot, saved.markdownPath)}.${overBudget}`);
  }

  async addCurrentFile(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    const editor = vscode.window.activeTextEditor;
    if (!repoRoot || !editor) {
      vscode.window.showErrorMessage("RepoForge: no active editor file.");
      return;
    }
    await this.state.addFiles([editor.document.uri.fsPath], repoRoot);
    await this.webviewProvider?.refresh();
  }

  async addOpenEditors(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const files = vscode.window.visibleTextEditors.map((editor) => editor.document.uri.fsPath);
    await this.state.addFiles(files, repoRoot);
    await this.webviewProvider?.refresh();
  }

  async clearSelection(): Promise<void> {
    await this.state.clearSelectedFiles();
    await this.webviewProvider?.refresh();
  }

  async openSidebar(): Promise<void> {
    await vscode.commands.executeCommand("workbench.view.extension.repoforge");
  }

  async writeProjectMemory(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const memoryPath = await ensureProjectMemory(repoRoot);
    await this.openFile(memoryPath);
  }

  async openLastContextPack(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const lastPath = this.state.getLastPackPath() ?? path.join(repoRoot, ".repoforge", "last-context.md");
    try {
      await this.openFile(lastPath);
    } catch {
      vscode.window.showErrorMessage("RepoForge: no generated context pack found.");
    }
  }

  async copyLastPack(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const lastPath = this.state.getLastPackPath() ?? path.join(repoRoot, ".repoforge", "last-context.md");
    try {
      await copyTextToClipboard(await fs.readFile(lastPath, "utf8"), "last pack");
    } catch {
      vscode.window.showErrorMessage("RepoForge: no generated context pack found.");
    }
  }

  async copyHandoff(kind: HandoffKind): Promise<void> {
    const pack = await this.buildPackForCurrentState(kind === "continue" ? "continue" : kind === "codex" ? "codex" : "local-qwen");
    if (!pack) {
      return;
    }
    const saved = await saveHandoff(pack, kind);
    await this.state.setLastHandoffPath(saved.markdownPath);
    await copyTextToClipboard(formatHandoff(pack, kind), `${kind} handoff`);
    await this.webviewProvider?.refresh();
  }

  async saveTaskProfile(nameOverride?: string): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const name =
      nameOverride?.trim() ||
      (await vscode.window.showInputBox({ title: "RepoForge Task Profile", prompt: "Profile name", ignoreFocusOut: true }))?.trim();
    if (!name) {
      return;
    }
    await saveTaskProfile(repoRoot, {
      name,
      task: this.state.getTask(),
      mode: this.state.getMode(),
      contextLimit: this.state.getTokenLimit(),
      reservedOutput: this.state.getReservedOutput(this.state.getMode() === "local-qwen" ? 16000 : 8000),
      tokenizerProfile: this.state.getTokenizerProfile(),
      selectedFiles: this.state.getSelectedFiles()
    });
    await this.webviewProvider?.refresh();
    vscode.window.showInformationMessage(`RepoForge saved task profile "${name}".`);
  }

  async loadTaskProfile(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    const profiles = await listTaskProfiles(repoRoot);
    const picked = await vscode.window.showQuickPick(
      profiles.map((profile) => ({ label: profile.name, profile })),
      { title: "Load RepoForge Task Profile" }
    );
    if (!picked) {
      return;
    }
    await this.state.setTask(picked.profile.task);
    await this.state.setMode(picked.profile.mode);
    await this.state.setTokenLimit(picked.profile.contextLimit);
    await this.state.setReservedOutput(picked.profile.reservedOutput);
    await this.state.setTokenizerProfile(picked.profile.tokenizerProfile);
    await this.state.setSelectedFiles(picked.profile.selectedFiles);
    await this.webviewProvider?.refresh();
  }

  async searchFiles(): Promise<void> {
    const scan = this.state.getLastScan();
    if (!scan) {
      vscode.window.showInformationMessage("RepoForge: scan the repository before searching files.");
      return;
    }
    const query = await vscode.window.showInputBox({ title: "RepoForge Search Files", prompt: "Search path, language, symbols, or imports" });
    if (query === undefined) {
      return;
    }
    const results = searchFiles({ query, task: this.state.getTask(), scan, selectedFiles: this.state.getSelectedFiles(), limit: 30 });
    const picked = await vscode.window.showQuickPick(
      results.map((result) => ({ label: result.path, description: `${result.language}, ${result.estimatedTokens} tokens`, result })),
      { title: "Add File To RepoForge Context" }
    );
    if (picked) {
      await this.state.addSelection({ path: picked.result.path, includeMode: "codemap", reason: "selected from search" });
      await this.webviewProvider?.refresh();
    }
  }

  async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    if (message.type === "setTask") {
      await this.state.setTask(message.task);
    } else if (message.type === "setMode") {
      await this.state.setMode(message.mode);
    } else if (message.type === "setContextLimit") {
      await this.state.setTokenLimit(message.limit);
    } else if (message.type === "setTokenizerProfile") {
      await this.state.setTokenizerProfile(message.profile);
    } else if (message.type === "setReservedOutput") {
      await this.state.setReservedOutput(message.tokens);
    } else if (message.type === "scanRepo") {
      await this.scanRepo();
    } else if (message.type === "addFile") {
      if (message.path === "__current__") {
        await this.addCurrentFile();
      } else if (message.path === "__open__") {
        await this.addOpenEditors();
      } else {
        await this.state.addSelection({ path: message.path, includeMode: message.includeMode, reason: "selected in sidebar" });
      }
    } else if (message.type === "removeFile") {
      await this.state.addSelection({ path: message.path, includeMode: "none" });
    } else if (message.type === "setIncludeMode") {
      await this.state.setIncludeMode(message.path, message.includeMode);
    } else if (message.type === "clearSelection") {
      await this.clearSelection();
    } else if (message.type === "generatePack") {
      await this.generatePack(this.state.getMode());
    } else if (message.type === "copyPack") {
      await this.copyLastPack();
    } else if (message.type === "openLastPack") {
      await this.openLastContextPack();
    } else if (message.type === "parsePatchFromClipboard") {
      await this.parsePatchFromClipboard();
    } else if (message.type === "previewPatch") {
      await this.previewPatch();
    } else if (message.type === "applyLastPatch") {
      await this.applyLastPatch();
    } else if (message.type === "runValidation") {
      await this.runValidation();
    } else if (message.type === "openLastPatch") {
      await this.openLastPatch();
    } else if (message.type === "openLastValidation") {
      await this.openLastValidation();
    } else if (message.type === "saveTaskProfile") {
      await this.saveTaskProfile(message.name);
    }
  }

  async parsePatchFromClipboard(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    await this.patchCommands.parsePatchFromClipboard(repoRoot);
    await this.webviewProvider?.refresh();
  }

  async previewPatch(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    await this.patchCommands.previewPatch(repoRoot);
    await this.webviewProvider?.refresh();
  }

  async applyLastPatch(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    await this.patchCommands.applyLastPatch(repoRoot);
    await this.webviewProvider?.refresh();
  }

  async runValidation(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    await this.validationCommands.runValidation(repoRoot);
    await this.webviewProvider?.refresh();
  }

  async openLastPatch(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    await this.patchCommands.openLastPatch(repoRoot);
  }

  async openLastValidation(): Promise<void> {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return;
    }
    await this.validationCommands.openLastValidation(repoRoot);
  }

  private async buildPackForCurrentState(mode: ContextMode) {
    const repoRoot = this.requireWorkspaceRoot();
    if (!repoRoot) {
      return undefined;
    }
    const task = await this.resolveTask();
    if (!task) {
      return undefined;
    }
    return buildContextPack({
      mode,
      task,
      repoRoot,
      tokenLimit: this.state.getTokenLimit(),
      reservedOutput: this.state.getReservedOutput(mode === "local-qwen" ? 16000 : 8000),
      selectedFiles: this.state.getSelectedFiles(),
      tokenizerProfile: this.state.getTokenizerProfile()
    });
  }

  private handoffKindForMode(mode: ContextMode): HandoffKind {
    return mode === "continue" ? "continue" : mode === "codex" ? "codex" : "local-qwen";
  }

  private async resolveTask(taskOverride?: string): Promise<string | undefined> {
    const existing = taskOverride?.trim() || this.state.getTask().trim();
    if (existing) {
      return existing;
    }
    const input = await vscode.window.showInputBox({
      title: "RepoForge Task",
      prompt: "Describe the coding task for this context pack.",
      ignoreFocusOut: true
    });
    return input?.trim() || undefined;
  }

  private requireWorkspaceRoot(): string | undefined {
    const repoRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!repoRoot) {
      vscode.window.showErrorMessage("RepoForge requires an open workspace folder.");
      return undefined;
    }
    return repoRoot;
  }

  private async openFile(filePath: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document, { preview: false });
  }
}

export async function mapCurrentDocument(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const filePath = editor.document.uri.fsPath;
  const content = editor.document.getText();
  const language = languageForPath(filePath);
  extractCodeMap(filePath, language, content, estimateTokens(content));
}
