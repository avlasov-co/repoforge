(function () {
  const vscode = acquireVsCodeApi();
  let state = undefined;

  const els = {
    task: document.getElementById("task"),
    mode: document.getElementById("mode"),
    contextLimit: document.getElementById("contextLimit"),
    tokenizerProfile: document.getElementById("tokenizerProfile"),
    reservedOutput: document.getElementById("reservedOutput"),
    searchFiles: document.getElementById("searchFiles"),
    suggestedFiles: document.getElementById("suggestedFiles"),
    selectedFiles: document.getElementById("selectedFiles"),
    tokenBudget: document.getElementById("tokenBudget"),
    scanStatus: document.getElementById("scanStatus"),
    profiles: document.getElementById("profiles")
  };

  function post(message) {
    vscode.postMessage(message);
  }

  function bindSegment(id, type, key, coerce) {
    document.querySelectorAll("#" + id + " button").forEach((button) => {
      button.addEventListener("click", () => post({ type, [key]: coerce(button.dataset.value) }));
    });
  }

  bindSegment("mode", "setMode", "mode", String);
  bindSegment("contextLimit", "setContextLimit", "limit", Number);
  bindSegment("tokenizerProfile", "setTokenizerProfile", "profile", String);

  els.task.addEventListener("input", debounce(() => post({ type: "setTask", task: els.task.value }), 250));
  els.reservedOutput.addEventListener("input", debounce(() => post({ type: "setReservedOutput", tokens: Number(els.reservedOutput.value || 0) }), 250));
  els.searchFiles.addEventListener("input", debounce(() => post({ type: "searchFiles", query: els.searchFiles.value }), 200));

  document.getElementById("scanRepo").addEventListener("click", () => post({ type: "scanRepo" }));
  document.getElementById("addCurrentFile").addEventListener("click", () => post({ type: "addFile", path: "__current__", includeMode: "full" }));
  document.getElementById("addOpenEditors").addEventListener("click", () => post({ type: "addFile", path: "__open__", includeMode: "full" }));
  document.getElementById("generatePack").addEventListener("click", () => post({ type: "generatePack" }));
  document.getElementById("copyPack").addEventListener("click", () => post({ type: "copyPack" }));
  document.getElementById("openLastPack").addEventListener("click", () => post({ type: "openLastPack" }));
  document.getElementById("clearSelection").addEventListener("click", () => post({ type: "clearSelection" }));
  document.getElementById("saveTaskProfile").addEventListener("click", () => {
    const name = prompt("Profile name");
    if (name) post({ type: "saveTaskProfile", name });
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "state") {
      state = message.state;
      render();
    } else if (message.type === "scanProgress") {
      els.scanStatus.textContent = message.message;
    } else if (message.type === "error" || message.type === "info") {
      els.scanStatus.textContent = message.message;
    }
  });

  function render() {
    if (!state) return;
    if (document.activeElement !== els.task) els.task.value = state.task || "";
    if (document.activeElement !== els.reservedOutput) els.reservedOutput.value = String(state.reservedOutput || 0);
    setActive("mode", state.mode);
    setActive("contextLimit", String(state.contextLimit));
    setActive("tokenizerProfile", state.tokenizerProfile);
    renderSearch();
    renderSelected();
    renderBudget();
    renderProfiles();
    if (state.scanSummary) els.scanStatus.textContent = state.scanSummary;
  }

  function setActive(id, value) {
    document.querySelectorAll("#" + id + " button").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === String(value));
    });
  }

  function renderSearch() {
    const results = state.searchResults || [];
    if (!results.length) {
      els.suggestedFiles.className = "list muted";
      els.suggestedFiles.textContent = "No matching files.";
      return;
    }
    els.suggestedFiles.className = "list";
    els.suggestedFiles.innerHTML = "";
    for (const file of results) {
      const div = document.createElement("div");
      div.className = "file";
      div.innerHTML = '<div class="file-title"></div><div class="meta"></div><div class="reasons"></div><div class="file-actions"></div>';
      div.querySelector(".file-title").textContent = file.path;
      div.querySelector(".meta").textContent = `${file.language} · ${file.estimatedTokens} tokens${file.gitStatus ? " · git " + file.gitStatus : ""}`;
      div.querySelector(".reasons").textContent = file.reasons && file.reasons.length ? file.reasons.join("; ") : "No relevance reasons yet.";
      const actions = div.querySelector(".file-actions");
      for (const mode of ["full", "codemap", "snippet"]) {
        const button = document.createElement("button");
        button.textContent = mode;
        button.addEventListener("click", () => post({ type: "addFile", path: file.path, includeMode: mode }));
        actions.appendChild(button);
      }
      els.suggestedFiles.appendChild(div);
    }
  }

  function renderSelected() {
    const selected = state.selectedFiles || [];
    if (!selected.length) {
      els.selectedFiles.className = "list muted";
      els.selectedFiles.textContent = "No selected files.";
      return;
    }
    els.selectedFiles.className = "list";
    els.selectedFiles.innerHTML = "";
    for (const file of selected) {
      const row = document.createElement("div");
      row.className = "selected-row";
      const title = document.createElement("div");
      title.className = "file-title";
      title.textContent = file.path;
      const select = document.createElement("select");
      for (const mode of ["full", "snippet", "codemap", "none"]) {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = mode;
        option.selected = file.includeMode === mode;
        select.appendChild(option);
      }
      select.addEventListener("change", () => post({ type: "setIncludeMode", path: file.path, includeMode: select.value }));
      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.addEventListener("click", () => post({ type: "removeFile", path: file.path }));
      row.append(title, select, remove);
      els.selectedFiles.appendChild(row);
    }
  }

  function renderBudget() {
    const preview = state.preview;
    if (!preview) {
      els.tokenBudget.className = "budget muted";
      els.tokenBudget.textContent = "No preview yet.";
      return;
    }
    const warnings = preview.warnings && preview.warnings.length ? `<div class="warnings">${escapeHtml(preview.warnings.join(" "))}</div>` : "";
    els.tokenBudget.className = "budget";
    els.tokenBudget.innerHTML = `Used input: ${preview.budget.usedInput}<br>Reserved output: ${preview.budget.reservedOutput}<br>Limit: ${preview.budget.limit}<br>Remaining: ${preview.budget.remainingInput}${warnings}`;
  }

  function renderProfiles() {
    const profiles = state.profiles || [];
    if (!profiles.length) {
      els.profiles.className = "list muted";
      els.profiles.textContent = "No profiles saved.";
      return;
    }
    els.profiles.className = "list";
    els.profiles.innerHTML = "";
    for (const profile of profiles) {
      const div = document.createElement("div");
      div.className = "file";
      div.textContent = `${profile.name}: ${profile.mode}, ${profile.contextLimit}`;
      els.profiles.appendChild(div);
    }
  }

  function debounce(fn, delay) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
})();
