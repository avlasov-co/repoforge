import * as vscode from "vscode";
import { detectValidationCommands } from "../core/validationCommands";
import { getValidationHistoryPaths, saveValidationRunResult } from "../core/validation/validationHistory";
import { runValidationCommand } from "../core/validation/validationRunner";
import { formatValidationResultMarkdown } from "../formatters/patchResultFormatter";

export class RepoForgeValidationCommands {
  async runValidation(repoRoot: string): Promise<void> {
    const commands = await detectValidationCommands(repoRoot);
    if (!commands.length) {
      vscode.window.showErrorMessage("RepoForge: no validation commands detected.");
      return;
    }

    const picked = await vscode.window.showQuickPick(
      commands.map((command) => ({ label: command, description: "Run validation command", command })),
      { title: "RepoForge Validation Commands" }
    );
    if (!picked) {
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `Run validation command?\n${picked.command}`,
      { modal: true },
      "Run Command"
    );
    if (confirmation !== "Run Command") {
      return;
    }

    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "RepoForge: running validation command" },
      () => runValidationCommand(repoRoot, picked.command)
    );
    const markdown = formatValidationResultMarkdown(result);
    const paths = await saveValidationRunResult(repoRoot, result, markdown);
    await this.openFile(paths.lastValidationMarkdownPath);
  }

  async openLastValidation(repoRoot: string): Promise<void> {
    const paths = await getValidationHistoryPaths(repoRoot);
    await this.openFile(paths.lastValidationMarkdownPath);
  }

  private async openFile(filePath: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document, { preview: false });
  }
}
