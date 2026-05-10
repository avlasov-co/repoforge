import * as vscode from "vscode";
import { readLastPatchPreview } from "../core/patch/patchHistory";
import { readLastValidationResult } from "../core/validation/validationHistory";
import { buildContextPreview } from "../core/contextPreview";
import { getGitDiffSummary } from "../core/git/gitDiff";
import { scoreRelevantFiles, suggestRelevantFiles } from "../core/relevance";
import { getWebviewHtml } from "./webviewHtml";
import { searchFiles } from "./filePicker";
import { listTaskProfiles } from "./taskProfiles";
import { ExtensionToWebviewMessage, WebviewState, WebviewToExtensionMessage } from "./webviewMessages";
import { RepoForgeState } from "./workspaceState";

export type WebviewMessageHandler = (message: WebviewToExtensionMessage) => Promise<void>;

export class RepoForgeWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private handler?: WebviewMessageHandler;
  private searchQuery = "";

  constructor(private readonly extensionUri: vscode.Uri, private readonly state: RepoForgeState) {}

  setMessageHandler(handler: WebviewMessageHandler): void {
    this.handler = handler;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);
    webviewView.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      if (message.type === "searchFiles") {
        this.searchQuery = message.query;
      }
      await this.handler?.(message);
      await this.refresh();
    });
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    this.post({ type: "state", state: await this.buildState() });
  }

  postProgress(message: string, done?: boolean): void {
    this.post({ type: "scanProgress", message, done });
  }

  postInfo(message: string): void {
    this.post({ type: "info", message });
  }

  postError(message: string): void {
    this.post({ type: "error", message });
  }

  private post(message: ExtensionToWebviewMessage): void {
    void this.view?.webview.postMessage(message);
  }

  private async buildState(): Promise<WebviewState> {
    const repoRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const scan = this.state.getLastScan();
    const mode = this.state.getMode();
    const contextLimit = this.state.getTokenLimit();
    const reservedOutput = this.state.getReservedOutput(mode === "local-qwen" ? 16000 : 8000);
    const tokenizerProfile = this.state.getTokenizerProfile();
    const selectedFiles = this.state.getSelectedFiles();
    const gitDiff = repoRoot ? await getGitDiffSummary(repoRoot) : { changedFiles: [], hunks: [] };
    const suggestions = scan
      ? suggestRelevantFiles({
          task: this.state.getTask(),
          files: scan.files,
          codeMap: scan.codeMap,
          selectedFiles,
          gitDiff,
          limit: 20
        })
      : [];
    const relevance = scan
      ? scoreRelevantFiles({
          task: this.state.getTask(),
          files: scan.files,
          codeMap: scan.codeMap,
          selectedFiles,
          gitDiff
        })
      : [];
    const preview = scan
      ? buildContextPreview({
          task: this.state.getTask(),
          selectedFiles,
          suggestedFiles: suggestions,
          files: scan.files,
          mode,
          contextLimit,
          reservedOutput,
          tokenizerProfile,
          relevanceScores: relevance,
          changedFiles: gitDiff.changedFiles
        })
      : undefined;
    return {
      task: this.state.getTask(),
      mode,
      contextLimit,
      reservedOutput,
      tokenizerProfile,
      selectedFiles,
      scanSummary: this.state.getLastScanSummary(),
      tokenBudget: this.state.getLastTokenBudget(),
      preview,
      searchResults: searchFiles({
        query: this.searchQuery,
        task: this.state.getTask(),
        scan,
        selectedFiles,
        gitDiff,
        limit: 30
      }),
      profiles: repoRoot ? await listTaskProfiles(repoRoot) : [],
      lastPackPath: this.state.getLastPackPath(),
      patchPreview: repoRoot ? await readLastPatchPreview(repoRoot) : undefined,
      validationResult: repoRoot ? await readLastValidationResult(repoRoot) : undefined
    };
  }
}
