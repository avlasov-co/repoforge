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
  <main class="app-shell">
    <header class="shell-header">
      <div class="brand-mark" aria-hidden="true"></div>
      <h1>RepoForge</h1>
    </header>

    <section class="panel">
      <div class="field-group">
        <label class="field-label" for="task">Task</label>
        <textarea id="task" placeholder="Describe the coding task"></textarea>
      </div>
    </section>

    <section class="panel">
      <div class="field-group">
        <label class="field-label" for="defaultIncludeMode">Include Mode</label>
        <select id="defaultIncludeMode">
          <option value="smart">Smart</option>
          <option value="full">Full File</option>
          <option value="codemap">Code Map</option>
          <option value="snippet">Snippet</option>
        </select>
        <div id="includeModeHint" class="field-hint">Relevant files + dependencies</div>
      </div>

      <div class="field-group">
        <label class="field-label" for="modeSelect">Handoff Mode</label>
        <select id="modeSelect">
          <option value="codex">Codex</option>
          <option value="local-qwen">Local Qwen / OpenCode</option>
          <option value="continue">Continue</option>
        </select>
        <div id="modeHint" class="field-hint">Optimized for OpenAI Codex</div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">Context &amp; Tokens</div>
        <div class="meta-inline">Budget + estimate</div>
      </div>
      <div id="tokenBudget" class="token-summary muted">No preview yet.</div>
      <div class="compact-grid">
        <div class="field-group">
          <label class="field-label" for="contextLimit">Context Limit</label>
          <select id="contextLimit">
            <option value="32768">32k</option>
            <option value="65536">64k</option>
            <option value="131072">128k</option>
            <option value="262144">262k</option>
          </select>
        </div>
        <div class="field-group">
          <label class="field-label" for="tokenizerProfile">Tokenizer</label>
          <select id="tokenizerProfile">
            <option value="gpt-4-estimate">gpt-4</option>
            <option value="qwen-estimate">qwen</option>
            <option value="llama-estimate">llama</option>
            <option value="chars-only">chars</option>
          </select>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label" for="reservedOutput">Reserved Output Tokens</label>
        <input id="reservedOutput" type="number" min="0" step="1000">
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">Selected Files <span id="selectedCount">(0)</span></div>
        <button id="clearSelection" class="ghost compact">Clear</button>
      </div>
      <input id="searchFiles" type="search" placeholder="Search path, language, symbol, import">
      <div class="utility-actions">
        <button id="scanRepo" class="ghost">Scan Repo</button>
        <button id="addCurrentFile" class="ghost">Add Current</button>
        <button id="addOpenEditors" class="ghost">Add Editors</button>
      </div>
      <div id="selectedFiles" class="list muted">No selected files.</div>
      <div class="suggested-group">
        <button id="toggleSuggestedFiles" class="disclosure-toggle" type="button" aria-expanded="false">
          <span id="suggestedChevron" class="disclosure-chevron" aria-hidden="true">▸</span>
          <span class="subsection-title">Suggestions</span>
          <span id="suggestedSummary" class="meta-inline">No scan results</span>
        </button>
        <div id="suggestedFiles" class="list muted" hidden>No scan results yet.</div>
      </div>
    </section>

    <section class="panel">
      <div class="primary-actions">
        <button id="previewContext" class="primary">Preview Context</button>
        <div class="primary-actions-split">
          <button id="generateHandoff" class="primary">Generate Handoff</button>
          <button id="openInAssistant" class="ghost">Open in Codex</button>
        </div>
      </div>
      <div class="secondary-actions">
        <button id="copyPack" class="ghost">Copy Last Pack</button>
        <button id="openLastPack" class="ghost">Open Last Pack</button>
        <button id="saveTaskProfile" class="ghost">Save Task Profile</button>
      </div>
      <div id="profiles" class="profiles-list muted">No profiles saved.</div>
    </section>

    <section class="panel">
      <div class="panel-title">Patch + Validation</div>
      <div class="path-row">
        <input id="patchPath" type="text" readonly placeholder=".repoforge/last-patch.diff">
        <button id="openLastPatch" class="ghost compact">Browse</button>
      </div>
      <div class="patch-actions">
        <button id="parsePatchFromClipboard" class="primary">Parse Patch</button>
        <button id="previewPatch" class="ghost">Preview Patch</button>
        <button id="applyLastPatch" class="ghost">Apply Patch</button>
      </div>
      <div class="summary-card">
        <div class="summary-title">Patch Summary</div>
        <div id="patchSummary" class="summary-content muted">No patch parsed yet.</div>
      </div>
      <div class="patch-actions">
        <button id="runValidation" class="ghost">Run Validation</button>
        <button id="openLastValidation" class="ghost">Open Result</button>
      </div>
      <div class="summary-card">
        <div class="summary-title">Validation Results</div>
        <div id="validationSummary" class="summary-content muted">No validation run yet.</div>
      </div>
    </section>

    <section class="panel panel-muted">
      <div class="panel-row">
        <div class="panel-title">Status</div>
        <div id="scanStatus" class="muted status-inline">No scan run yet.</div>
      </div>
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
