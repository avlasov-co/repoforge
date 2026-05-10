import * as fs from "fs/promises";
import * as vscode from "vscode";
import { applyPatch, checkPatchApplies } from "../core/patch/patchApply";
import { getPatchHistoryPaths, readLastPatch, readLastPatchPreview, saveParsedPatch } from "../core/patch/patchHistory";
import { buildPatchPreview } from "../core/patch/patchPreview";
import { parseUnifiedDiff } from "../core/patch/unifiedDiffParser";
import { formatPatchPreviewMarkdown } from "../formatters/patchResultFormatter";

export class RepoForgePatchCommands {
  async parsePatchFromClipboard(repoRoot: string): Promise<void> {
    const clipboardText = await vscode.env.clipboard.readText();
    const parsed = parseUnifiedDiff(clipboardText);
    if (!parsed.files.length) {
      vscode.window.showErrorMessage("RepoForge: no unified diff found in clipboard text.");
      return;
    }

    const preview = buildPatchPreview(parsed);
    const markdown = formatPatchPreviewMarkdown(preview);
    await saveParsedPatch(repoRoot, parsed.rawText, preview, markdown);
    vscode.window.showInformationMessage(
      `RepoForge parsed patch: ${preview.files.length} files, +${preview.totalAdditions} / -${preview.totalDeletions}.`
    );
  }

  async previewPatch(repoRoot: string): Promise<void> {
    const patchText = await readLastPatch(repoRoot);
    if (!patchText) {
      vscode.window.showErrorMessage("RepoForge: no last patch found.");
      return;
    }

    const parsed = parseUnifiedDiff(patchText);
    const preview = buildPatchPreview(parsed);
    const markdown = formatPatchPreviewMarkdown(preview);
    const paths = await saveParsedPatch(repoRoot, parsed.rawText, preview, markdown);
    await this.openFile(paths.lastPatchPreviewMarkdownPath);
  }

  async applyLastPatch(repoRoot: string): Promise<void> {
    const patchText = await readLastPatch(repoRoot);
    if (!patchText) {
      vscode.window.showErrorMessage("RepoForge: no last patch found.");
      return;
    }

    const preview = await readLastPatchPreview(repoRoot);
    if (preview?.diagnostics.length) {
      vscode.window.showErrorMessage("RepoForge: patch preview has diagnostics. Fix or re-parse before applying.");
      return;
    }

    const checkResult = await checkPatchApplies(repoRoot, patchText);
    if (!checkResult.applied) {
      vscode.window.showErrorMessage(`RepoForge: patch check failed. ${checkResult.diagnostics.join(" ")}`.trim());
      return;
    }

    const confirmation = await vscode.window.showWarningMessage(
      `Apply RepoForge patch touching ${checkResult.filesChanged.length} file(s)?`,
      { modal: true },
      "Apply Patch"
    );
    if (confirmation !== "Apply Patch") {
      return;
    }

    const result = await applyPatch(repoRoot, patchText);
    if (!result.applied) {
      vscode.window.showErrorMessage(`RepoForge: patch apply failed. ${result.diagnostics.join(" ")}`.trim());
      return;
    }

    vscode.window.showInformationMessage(`RepoForge applied patch to ${result.filesChanged.length} file(s).`);
  }

  async openLastPatch(repoRoot: string): Promise<void> {
    const paths = await getPatchHistoryPaths(repoRoot);
    await this.openFile(paths.lastPatchPath);
  }

  private async openFile(filePath: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document, { preview: false });
  }
}
