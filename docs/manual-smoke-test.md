# Manual Smoke Test

Use this checklist before shipping a release build.

1. Open RepoForge in VS Code.
   - Expected: the repository opens without errors and the extension sources are available.
2. Press `F5` / Run Extension.
   - Expected: a new Extension Development Host opens successfully.
3. Open a sample repo.
   - Expected: RepoForge can work against a real workspace, not just the extension source tree.
4. Run `RepoForge: Scan Repo`.
   - Expected: scan completes and repo metadata, file lists, and symbol data are populated.
5. Open the sidebar.
   - Expected: the RepoForge view appears in the activity bar and the webview loads.
6. Enter task.
   - Expected: the task field accepts text and preserves the current value.
7. Search files.
   - Expected: search returns relevant files from the scanned repository.
8. Add current file.
   - Expected: the active editor file is added to the selected context list.
9. Change include mode.
   - Expected: the selected file switches between full file, codemap, and snippet modes.
10. Generate Codex pack.
    - Expected: `.repoforge/last-context.md` and `.repoforge/last-context.json` are written for Codex mode.
11. Generate Local Qwen pack.
    - Expected: a long-context pack is generated with the Local Qwen/OpenCode format.
12. Copy handoff to clipboard.
    - Expected: the handoff text lands on the clipboard without errors.
13. Save/load task profile.
    - Expected: a profile is persisted to `.repoforge/profiles.json` and can be loaded back into the sidebar.
14. Verify `.repoforge/last-context.md`.
    - Expected: the file exists and contains the latest generated context pack.
15. Verify `.repoforge/last-handoff.md`.
    - Expected: the file exists and contains the latest generated handoff text.
