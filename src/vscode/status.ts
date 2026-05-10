import * as vscode from "vscode";

export class RepoForgeStatus {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.name = "RepoForge";
    this.item.command = "repoforge.openSidebar";
    this.item.text = "RepoForge";
  }

  show(message = "RepoForge"): void {
    this.item.text = message;
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
