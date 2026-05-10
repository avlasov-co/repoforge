import * as vscode from "vscode";
import { ContextSelection } from "../core/types";

export class RepoTreeProvider implements vscode.TreeDataProvider<ContextSelection> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private getSelections: () => ContextSelection[]) {}

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: ContextSelection): vscode.TreeItem {
    const item = new vscode.TreeItem(element.path, vscode.TreeItemCollapsibleState.None);
    item.description = element.includeMode;
    item.tooltip = element.reason;
    return item;
  }

  getChildren(): ContextSelection[] {
    return this.getSelections();
  }
}
