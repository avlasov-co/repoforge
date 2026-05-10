import * as vscode from "vscode";

export async function copyTextToClipboard(text: string, label: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
  vscode.window.showInformationMessage(`RepoForge copied ${label} to clipboard.`);
}
