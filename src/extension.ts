import * as vscode from "vscode";
import { RepoForgeCommands } from "./vscode/commands";
import { RepoForgeStatus } from "./vscode/status";
import { RepoForgeWebviewProvider } from "./vscode/webviewProvider";
import { RepoForgeState } from "./vscode/workspaceState";

export function activate(context: vscode.ExtensionContext): void {
  const state = new RepoForgeState(context);
  const webviewProvider = new RepoForgeWebviewProvider(context.extensionUri, state);
  const status = new RepoForgeStatus();
  const commands = new RepoForgeCommands(state, webviewProvider);
  webviewProvider.setMessageHandler((message) => commands.handleWebviewMessage(message));
  commands.register(context);

  context.subscriptions.push(
    status,
    vscode.window.registerWebviewViewProvider("repoforgeContext", webviewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  status.show();
}

export function deactivate(): void {
  // No background resources.
}
