# Changelog

## v0.4.7

### Changed
- Bumped the extension version to `0.4.7` for the next GitHub release and VSIX package.

## v0.4.5

### Changed
- Bumped the extension version to `0.4.5` for the next GitHub release and VSIX package.

## v0.4.4

### Fixed
- Reworked the sidebar to match the documented release workflow more closely.
- Fixed broken sidebar button wiring so actions dispatch reliably from the webview.
- Added context preview and handoff actions that align with the updated sidebar flow.

## v0.4.3

### Fixed
- Packaged runtime dependencies into the VSIX so activation can load required modules.
- Moved `typescript` from `devDependencies` to runtime `dependencies` because the extension imports it at runtime.
- Pinned runtime dependencies to `js-tiktoken` `1.0.21` and `typescript` `5.4.5`.

## v0.4.0

### Added
- Unified diff parser.
- Patch preview workflow.
- Safe patch application through `git apply --check` and `git apply`.
- Patch artifacts and history under `.repoforge/`.
- Validation command runner.
- Validation artifacts and history under `.repoforge/`.
- Sidebar Patch + Validation section.
- Patch and validation result formatters.
- Tests for patch parsing, patch apply, validation runner, and patch history.

### Notes
- Patch apply requires a Git repository.
- Only unified diffs are supported.
- Validation runs one user-approved command at a time.
- No staging, committing, conflict resolution, or auto-running validation.

## v0.3.0

### Added
- VS Code sidebar workflow.
- File search and selected file include modes.
- Live token budget preview.
- Codex handoff formatter.
- Local Qwen/OpenCode handoff formatter.
- Continue handoff formatter.
- Clipboard commands.
- Task profiles.
- Organized `.repoforge/history` output.

## v0.2.0

### Added
- Parser backend abstraction.
- Python AST bridge.
- Rust-aware scanner.
- `.gitignore` and `.repoforgeignore` support.
- Git diff-aware context.
- Tokenizer profiles.
- Budget optimizer.

## v0.1.0

### Added
- Initial repo scanner.
- Code map generation.
- Token estimation.
- Context pack generation.
- Codex and Local Qwen pack formats.
