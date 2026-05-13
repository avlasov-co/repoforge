(function () {
  const vscode = acquireVsCodeApi();
  let state;
  const uiState = {
    suggestedExpanded: false,
    activeSuggestedMenu: ""
  };

  const els = {
    task: byId("task"),
    defaultIncludeMode: byId("defaultIncludeMode"),
    includeModeHint: byId("includeModeHint"),
    modeSelect: byId("modeSelect"),
    modeHint: byId("modeHint"),
    contextLimit: byId("contextLimit"),
    tokenizerProfile: byId("tokenizerProfile"),
    reservedOutput: byId("reservedOutput"),
    searchFiles: byId("searchFiles"),
    suggestedFiles: byId("suggestedFiles"),
    suggestedSummary: byId("suggestedSummary"),
    suggestedChevron: byId("suggestedChevron"),
    toggleSuggestedFiles: byId("toggleSuggestedFiles"),
    selectedFiles: byId("selectedFiles"),
    selectedCount: byId("selectedCount"),
    tokenBudget: byId("tokenBudget"),
    scanStatus: byId("scanStatus"),
    profiles: byId("profiles"),
    patchPath: byId("patchPath"),
    patchSummary: byId("patchSummary"),
    validationSummary: byId("validationSummary"),
    openInAssistant: byId("openInAssistant")
  };

  init();

  function init() {
    bindInput("task", "input", debounce(() => post({ type: "setTask", task: els.task.value }), 200));
    bindInput("defaultIncludeMode", "change", () => post({ type: "setDefaultIncludeMode", includeMode: els.defaultIncludeMode.value }));
    bindInput("modeSelect", "change", () => post({ type: "setMode", mode: els.modeSelect.value }));
    bindInput("contextLimit", "change", () => post({ type: "setContextLimit", limit: Number(els.contextLimit.value) }));
    bindInput("tokenizerProfile", "change", () => post({ type: "setTokenizerProfile", profile: els.tokenizerProfile.value }));
    bindInput("reservedOutput", "input", debounce(() => post({ type: "setReservedOutput", tokens: Number(els.reservedOutput.value || 0) }), 200));
    bindInput("searchFiles", "input", debounce(() => post({ type: "searchFiles", query: els.searchFiles.value }), 120));
    bindClick("toggleSuggestedFiles", () => {
      uiState.suggestedExpanded = !uiState.suggestedExpanded;
      renderSuggestedVisibility();
    });

    bindClick("scanRepo", () => post({ type: "scanRepo" }), true);
    bindClick("addCurrentFile", () => post({ type: "addFile", path: "__current__", includeMode: mapIncludeMode(els.defaultIncludeMode.value) }), true);
    bindClick("addOpenEditors", () => post({ type: "addFile", path: "__open__", includeMode: mapIncludeMode(els.defaultIncludeMode.value) }), true);
    bindClick("clearSelection", () => post({ type: "clearSelection" }), true);
    bindClick("previewContext", () => post({ type: "previewContext" }), true);
    bindClick("generateHandoff", () => post({ type: "generateHandoff" }), true);
    bindClick("openInAssistant", () => post({ type: "openInAssistant" }), true);
    bindClick("copyPack", () => post({ type: "copyPack" }), true);
    bindClick("openLastPack", () => post({ type: "openLastPack" }), true);
    bindClick("saveTaskProfile", () => {
      flushFormState();
      const name = prompt("Profile name");
      if (name) {
        post({ type: "saveTaskProfile", name });
      }
    }, true);
    bindClick("parsePatchFromClipboard", () => post({ type: "parsePatchFromClipboard" }), true);
    bindClick("previewPatch", () => post({ type: "previewPatch" }), true);
    bindClick("applyLastPatch", () => post({ type: "applyLastPatch" }), true);
    bindClick("runValidation", () => post({ type: "runValidation" }), true);
    bindClick("openLastPatch", () => post({ type: "openLastPatch" }), true);
    bindClick("openLastValidation", () => post({ type: "openLastValidation" }), true);

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "state") {
        state = message.state;
        render();
        return;
      }
      if (message.type === "scanProgress" || message.type === "info" || message.type === "error") {
        setStatus(message.message, message.type === "error" ? "warning" : "");
      }
    });

    window.addEventListener("error", (event) => {
      setStatus(`Sidebar error: ${event.message}`, "warning");
    });
  }

  function render() {
    if (!state) {
      return;
    }

    syncValue(els.task, state.task || "");
    syncValue(els.defaultIncludeMode, state.defaultIncludeMode);
    syncValue(els.modeSelect, state.mode);
    syncValue(els.contextLimit, String(state.contextLimit));
    syncValue(els.tokenizerProfile, state.tokenizerProfile);
    syncValue(els.reservedOutput, String(state.reservedOutput || 0));
    els.patchPath.value = state.lastPatchPath || "";

    renderModeHint();
    renderIncludeModeHint();
    renderTokenBudget();
    renderSelectedFiles();
    renderSearchResults();
    renderProfiles();
    renderPatchSummary();
    renderValidationSummary();
    updateAssistantButtonLabel();

    if (state.scanSummary) {
      setStatus(state.scanSummary);
    }
  }

  function renderModeHint() {
    const hints = {
      codex: "Optimized for OpenAI Codex",
      "local-qwen": "Longer handoff for local reasoning models",
      continue: "Shorter handoff for Continue"
    };
    els.modeHint.textContent = hints[state.mode] || "";
  }

  function renderIncludeModeHint() {
    const hints = {
      smart: "Relevant files + dependencies",
      full: "Adds full file contents by default",
      codemap: "Prefers compact symbol maps",
      snippet: "Keeps file selections trimmed"
    };
    els.includeModeHint.textContent = hints[state.defaultIncludeMode] || "";
  }

  function renderTokenBudget() {
    const preview = state.preview;
    if (!preview) {
      els.tokenBudget.className = "token-summary muted";
      els.tokenBudget.textContent = "No preview yet.";
      return;
    }

    const visibleSelections = getVisibleSelections();
    const budget = preview.budget;
    const usedPct = budget.limit > 0 ? Math.round((budget.usedInput / budget.limit) * 100) : 0;
    const warnings = preview.warnings.length
      ? preview.warnings.map((warning) => `<div class="warning-line">${escapeHtml(warning)}</div>`).join("")
      : "";
    els.tokenBudget.className = "token-summary";
    els.tokenBudget.innerHTML = `
      <div class="token-line">
        <strong>Budget:</strong> ${formatNumber(budget.usedInput)} / ${formatNumber(budget.limit)} tokens (${usedPct}%)
      </div>
      <div class="token-line">
        <strong>Est. Files:</strong> ${visibleSelections.length}
      </div>
      <div class="token-line">
        <strong>Reserved Output:</strong> ${formatNumber(budget.reservedOutput)}
      </div>
      <div class="token-line">
        <strong>Remaining:</strong> ${formatNumber(budget.remainingInput)}
      </div>
      ${warnings}
    `;
  }

  function renderSelectedFiles() {
    const selected = getVisibleSelections();
    els.selectedCount.textContent = `(${selected.length})`;

    if (!selected.length) {
      els.selectedFiles.className = "list muted";
      els.selectedFiles.textContent = "No selected files.";
      return;
    }

    const manuallySelected = new Set((state.selectedFiles || []).map((item) => item.path));
    els.selectedFiles.className = "list";
    els.selectedFiles.innerHTML = "";

    selected.forEach((file) => {
      const row = document.createElement("div");
      row.className = "file-row";

      const head = document.createElement("div");
      head.className = "file-row-head";

      const main = document.createElement("div");
      main.className = "file-row-main";

      const kind = document.createElement("span");
      kind.className = "file-kind";
      kind.textContent = inferFileKind(file.path);

      const title = document.createElement("div");
      title.className = "file-title";
      title.textContent = file.path;

      main.append(kind, title);

      const controls = document.createElement("div");
      controls.className = "selected-controls";

      if (manuallySelected.has(file.path)) {
        const select = document.createElement("select");
        ["full", "snippet", "codemap"].forEach((mode) => {
          const option = document.createElement("option");
          option.value = mode;
          option.textContent = mode;
          option.selected = file.includeMode === mode;
          select.appendChild(option);
        });
        select.addEventListener("change", () => post({ type: "setIncludeMode", path: file.path, includeMode: select.value }));
        controls.appendChild(select);

        const remove = document.createElement("button");
        remove.className = "ghost compact";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => post({ type: "removeFile", path: file.path }));
        controls.appendChild(remove);
      } else {
        const smartBadge = document.createElement("button");
        smartBadge.className = "ghost compact";
        smartBadge.textContent = "Pin";
        smartBadge.addEventListener("click", () => post({ type: "addFile", path: file.path, includeMode: file.includeMode || "codemap" }));
        controls.appendChild(smartBadge);
      }

      head.append(main, controls);

      const meta = document.createElement("div");
      meta.className = "file-row-meta meta";
      const reasons = file.reasons && file.reasons.length ? file.reasons.join(" · ") : file.reason || "Selected for context";
      meta.textContent = `${file.includeMode} · ${reasons}`;

      row.append(head, meta);
      els.selectedFiles.appendChild(row);
    });
  }

  function renderSearchResults() {
    const results = state.searchResults || [];
    const hasQuery = Boolean((els.searchFiles?.value || "").trim());
    updateSuggestedDisclosure(results, hasQuery);

    if (!results.length) {
      els.suggestedFiles.className = "list muted";
      els.suggestedFiles.textContent = hasQuery ? "No matching files." : "No scan results yet.";
      renderSuggestedVisibility();
      return;
    }

    els.suggestedFiles.className = "list";
    els.suggestedFiles.innerHTML = "";
    results.forEach((file) => {
      const row = document.createElement("div");
      row.className = "file-row file-row-button";
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("title", file.reasons.length ? file.reasons.join(" · ") : "Add suggested file");
      row.addEventListener("click", () => {
        post({ type: "addFile", path: file.path, includeMode: mapIncludeMode(els.defaultIncludeMode.value) });
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          post({ type: "addFile", path: file.path, includeMode: mapIncludeMode(els.defaultIncludeMode.value) });
        }
      });

      const head = document.createElement("div");
      head.className = "file-row-head";

      const main = document.createElement("div");
      main.className = "file-row-main";

      const kind = document.createElement("span");
      kind.className = "file-kind";
      kind.textContent = shortLanguage(file.language || inferFileKind(file.path));

      const title = document.createElement("div");
      title.className = "file-title";
      title.textContent = file.path;

      const token = document.createElement("span");
      token.className = "file-token";
      token.textContent = `${formatNumber(file.estimatedTokens)} tok`;

      main.append(kind, title);
      head.append(main, token);

      const meta = document.createElement("div");
      meta.className = "file-row-meta meta";
      meta.textContent = formatSuggestedMeta(file);

      const actions = document.createElement("div");
      actions.className = "row-menu";

      const menuButton = document.createElement("button");
      menuButton.className = "ghost compact menu-trigger";
      menuButton.type = "button";
      menuButton.textContent = "⋯";
      menuButton.setAttribute("aria-label", `Choose include mode for ${file.path}`);
      menuButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        uiState.activeSuggestedMenu = uiState.activeSuggestedMenu === file.path ? "" : file.path;
        renderSearchResults();
      });

      const menu = document.createElement("div");
      menu.className = `mode-menu${uiState.activeSuggestedMenu === file.path ? " is-open" : ""}`;
      ["full", "codemap", "snippet"].forEach((mode) => {
        const button = document.createElement("button");
        button.className = "ghost compact mode-menu-item";
        button.type = "button";
        button.textContent = mode;
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          uiState.activeSuggestedMenu = "";
          post({ type: "addFile", path: file.path, includeMode: mode });
        });
        menu.appendChild(button);
      });

      actions.append(menuButton, menu);
      head.append(actions);
      row.append(head, meta);
      els.suggestedFiles.appendChild(row);
    });
    renderSuggestedVisibility();
  }

  function renderProfiles() {
    const profiles = state.profiles || [];
    if (!profiles.length) {
      els.profiles.className = "profiles-list muted";
      els.profiles.textContent = "No profiles saved.";
      return;
    }

    els.profiles.className = "profiles-list";
    els.profiles.innerHTML = "";
    profiles.slice(0, 3).forEach((profile) => {
      const item = document.createElement("div");
      item.className = "meta";
      item.textContent = `${profile.name}: ${profile.mode}, ${formatNumber(profile.contextLimit)} tokens`;
      els.profiles.appendChild(item);
    });
  }

  function renderPatchSummary() {
    const preview = state.patchPreview;
    if (!preview) {
      els.patchSummary.className = "summary-content muted";
      els.patchSummary.textContent = "No patch parsed yet.";
      return;
    }

    const rows = [
      ["Files changed", String(preview.files.length)],
      ["Additions", formatNumber(preview.totalAdditions)],
      ["Deletions", formatNumber(preview.totalDeletions)]
    ];

    if (preview.diagnostics.length) {
      rows.push(["Diagnostics", String(preview.diagnostics.length)]);
    }

    els.patchSummary.className = "summary-content";
    els.patchSummary.innerHTML = renderSummaryList(rows);
  }

  function renderValidationSummary() {
    const result = state.validationResult;
    if (!result) {
      els.validationSummary.className = "summary-content muted";
      els.validationSummary.textContent = "No validation run yet.";
      return;
    }

    const stateClass = result.passed ? "status-pass" : "status-fail";
    els.validationSummary.className = `summary-content ${stateClass}`;
    els.validationSummary.innerHTML = `
      <div class="summary-list">
        <div class="summary-row">
          <span class="summary-key">Result</span>
          <span class="summary-value">${result.passed ? "PASSED" : "FAILED"}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Command</span>
          <span class="summary-value">${escapeHtml(result.command)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Duration</span>
          <span class="summary-value">${formatNumber(result.durationMs)}ms</span>
        </div>
      </div>
    `;
  }

  function updateAssistantButtonLabel() {
    const labels = {
      codex: "Open in Codex",
      "local-qwen": "Open in OpenCode",
      continue: "Open in Continue"
    };
    els.openInAssistant.textContent = labels[state.mode] || "Open Handoff";
  }

  function getVisibleSelections() {
    const selected = Array.isArray(state.selectedFiles) ? [...state.selectedFiles] : [];
    if (state.defaultIncludeMode !== "smart" || !state.preview || !Array.isArray(state.preview.likelySelections)) {
      return selected;
    }

    const byPath = new Map(selected.map((item) => [item.path, item]));
    state.preview.likelySelections.forEach((item) => {
      if (!byPath.has(item.path)) {
        byPath.set(item.path, item);
      }
    });
    return Array.from(byPath.values());
  }

  function mapIncludeMode(value) {
    return value === "smart" ? "full" : value;
  }

  function syncValue(element, value) {
    if (!element) {
      return;
    }
    if (document.activeElement !== element) {
      element.value = value;
    }
  }

  function bindClick(id, handler, shouldFlush) {
    const element = byId(id);
    if (!element) {
      return;
    }
    element.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        if (shouldFlush) {
          flushFormState();
        }
        handler(event);
      } catch (error) {
        setStatus(`Sidebar action failed: ${error instanceof Error ? error.message : String(error)}`, "warning");
      }
    });
  }

  function bindInput(id, eventName, handler) {
    const element = byId(id);
    if (!element) {
      return;
    }
    element.addEventListener(eventName, () => {
      try {
        handler();
      } catch (error) {
        setStatus(`Sidebar input failed: ${error instanceof Error ? error.message : String(error)}`, "warning");
      }
    });
  }

  function post(message) {
    vscode.postMessage(message);
  }

  function flushFormState() {
    post({ type: "setTask", task: els.task.value });
    post({ type: "setDefaultIncludeMode", includeMode: els.defaultIncludeMode.value });
    post({ type: "setMode", mode: els.modeSelect.value });
    post({ type: "setContextLimit", limit: Number(els.contextLimit.value) });
    post({ type: "setTokenizerProfile", profile: els.tokenizerProfile.value });
    post({ type: "setReservedOutput", tokens: Number(els.reservedOutput.value || 0) });
  }

  function setStatus(message, extraClass) {
    if (!els.scanStatus) {
      return;
    }
    els.scanStatus.className = extraClass ? `muted ${extraClass}` : "muted";
    els.scanStatus.textContent = message;
  }

  function inferFileKind(filePath) {
    const parts = String(filePath || "").split("/");
    const name = parts[parts.length - 1] || "";
    const ext = name.includes(".") ? name.split(".").pop() : "";
    return shortLanguage(ext || name.slice(0, 3) || "file");
  }

  function shortLanguage(value) {
    const text = String(value || "file").replace(/[^a-z0-9#+-]/gi, "").toLowerCase();
    return (text || "file").slice(0, 4);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatSuggestedMeta(file) {
    const parts = [];
    if (file.language) {
      parts.push(file.language);
    }
    if (file.gitStatus) {
      parts.push(`git ${file.gitStatus}`);
    }
    if (file.reasons.length) {
      parts.push(file.reasons[0]);
    }
    return parts.join(" · ") || "Suggested";
  }

  function updateSuggestedDisclosure(results, hasQuery) {
    if (!els.toggleSuggestedFiles || !els.suggestedSummary) {
      return;
    }

    const count = results.length;
    if (!count) {
      uiState.activeSuggestedMenu = "";
      els.suggestedSummary.textContent = hasQuery ? "No matches" : "No scan results";
      els.toggleSuggestedFiles.disabled = true;
      els.toggleSuggestedFiles.setAttribute("aria-expanded", "false");
      return;
    }

    if (uiState.suggestedExpanded === undefined || uiState.suggestedExpanded === null) {
      uiState.suggestedExpanded = false;
    }
    els.toggleSuggestedFiles.disabled = false;
    els.suggestedSummary.textContent = `${count} ${count === 1 ? "file" : "files"}${hasQuery ? " · Search" : " · Scan"}`;
  }

  function renderSuggestedVisibility() {
    if (!els.suggestedFiles || !els.toggleSuggestedFiles || !els.suggestedChevron) {
      return;
    }

    const hasResults = Boolean((state?.searchResults || []).length);
    const expanded = hasResults && Boolean(uiState.suggestedExpanded);
    els.suggestedFiles.hidden = !expanded;
    els.toggleSuggestedFiles.setAttribute("aria-expanded", String(expanded));
    els.suggestedChevron.textContent = expanded ? "▾" : "▸";
  }

  function renderSummaryList(rows) {
    return `
      <div class="summary-list">
        ${rows
          .map(
            ([key, value]) => `
              <div class="summary-row">
                <span class="summary-key">${escapeHtml(key)}</span>
                <span class="summary-value">${escapeHtml(value)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function byId(id) {
    return document.getElementById(id);
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
