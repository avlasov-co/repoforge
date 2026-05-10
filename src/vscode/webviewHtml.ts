import * as vscode from "vscode";

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();
  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "webview.css"));
  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "webview.js"));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>RepoForge Context</title>
</head>
<body>
  <main>
    <h1>RepoForge Context</h1>

    <label for="task">Task</label>
    <textarea id="task" placeholder="Describe the coding task"></textarea>

    <label>Mode</label>
    <div class="segmented" id="mode">
      <button data-value="codex">Codex</button>
      <button data-value="local-qwen">Local Qwen/OpenCode</button>
      <button data-value="continue">Continue</button>
    </div>

    <label>Context limit</label>
    <div class="segmented" id="contextLimit">
      <button data-value="32768">32k</button>
      <button data-value="65536">64k</button>
      <button data-value="131072">128k</button>
      <button data-value="262144">262k</button>
    </div>

    <label>Tokenizer profile</label>
    <div class="segmented" id="tokenizerProfile">
      <button data-value="gpt-4-estimate">gpt-4</button>
      <button data-value="qwen-estimate">qwen</button>
      <button data-value="llama-estimate">llama</button>
      <button data-value="chars-only">chars</button>
    </div>

    <label for="reservedOutput">Reserved output tokens</label>
    <input id="reservedOutput" type="number" min="0" step="1000">

    <section>
      <h2>Actions</h2>
      <div class="grid">
        <button id="scanRepo">Scan Repo</button>
        <button id="addCurrentFile">Add Current File</button>
        <button id="addOpenEditors">Add Open Editors</button>
        <button id="generatePack">Generate Pack</button>
        <button id="copyPack">Copy Pack</button>
        <button id="openLastPack">Open Last Pack</button>
        <button id="clearSelection">Clear Selection</button>
        <button id="saveTaskProfile">Save Task Profile</button>
      </div>
    </section>

    <section>
      <h2>Search files</h2>
      <input id="searchFiles" type="search" placeholder="path, language, symbol, import">
      <div id="suggestedFiles" class="list muted">No scan results yet.</div>
    </section>

    <section>
      <h2>Selected files</h2>
      <div id="selectedFiles" class="list muted">No selected files.</div>
    </section>

    <section>
      <h2>Token budget</h2>
      <div id="tokenBudget" class="budget muted">No preview yet.</div>
    </section>

    <section>
      <h2>Scan status</h2>
      <div id="scanStatus" class="muted">No scan run yet.</div>
    </section>

    <section>
      <h2>Task profiles</h2>
      <div id="profiles" class="list muted">No profiles saved.</div>
    </section>
  </main>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i++) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
