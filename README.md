# RepoForge

RepoForge is a local-first VS Code extension for building high-signal repository context packs for coding agents.

It scans a workspace, builds a compact code map, tracks selected files, estimates token usage, reads git changes, and writes structured handoff packs to `.repoforge/` without calling external AI APIs.

## What It Is

RepoForge is a context-preparation tool for developers who work with coding agents and want repeatable, inspectable repository handoffs.

It is designed to reduce the manual work of:

- finding the right files,
- keeping handoffs within a token budget,
- preserving task context,
- and capturing changed files without copying large diffs by hand.

## What It Is Not

RepoForge is not:

- a chat UI,
- an auto-trading bot or autonomous agent,
- a direct Codex, OpenCode, Continue, or LM Studio integration,
- a tree-sitter-based parser stack,
- or a replacement for repository-specific judgment.

It produces Markdown and JSON artifacts for other tools to consume.

## Why Context Packing Matters

Coding agents are only as useful as the repository context they receive.

If the handoff is too large, the important parts get diluted. If it is too small, the model misses the relevant files, symbols, constraints, and recent changes. RepoForge is built around that tradeoff:

- keep high-value context visible,
- keep changed files near the top,
- keep budgets explicit,
- and make the final pack easy to inspect before you hand it to an agent.

## Development Setup

```bash
npm install
npm run compile
npm test
```

Open the repository in VS Code and launch **Run Extension** from the debug panel to run the extension host locally.

## Sidebar Workflow

The RepoForge sidebar is a static VS Code webview with no React or bundler.

Typical flow:

1. Run `RepoForge: Scan Repo`.
2. Open the sidebar.
3. Enter the task.
4. Search files or add the active file.
5. Choose include modes for selected files.
6. Pick the target handoff mode.
7. Review the live token budget.
8. Generate the pack or copy the handoff.

The sidebar supports:

- task editing,
- Codex, Local Qwen/OpenCode, and Continue handoff modes,
- context limit presets,
- tokenizer profile selection,
- reserved output token editing,
- file search over scanned paths, languages, symbols, and imports,
- suggested files with Add Full / Add Codemap / Add Snippet actions,
- selected file include mode editing,
- live token budget preview,
- scan progress and status messages,
- copy/open/generate actions,
- task profile saving,
- patch parsing and preview actions,
- safe patch apply confirmation,
- and validation command summaries.

## Commands

- `RepoForge: Scan Repo`
- `RepoForge: Generate Repo Map`
- `RepoForge: Generate Codex Pack`
- `RepoForge: Generate Local Qwen Pack`
- `RepoForge: Add Current File To Context`
- `RepoForge: Add Open Editors To Context`
- `RepoForge: Clear Selected Context`
- `RepoForge: Open Sidebar`
- `RepoForge: Write Project Memory`
- `RepoForge: Open Last Context Pack`
- `RepoForge: Copy Last Pack`
- `RepoForge: Copy Codex Handoff`
- `RepoForge: Copy Local Qwen/OpenCode Handoff`
- `RepoForge: Copy Continue Handoff`
- `RepoForge: Save Task Profile`
- `RepoForge: Load Task Profile`
- `RepoForge: Search Files`
- `RepoForge: Parse Patch From Clipboard`
- `RepoForge: Preview Patch`
- `RepoForge: Apply Last Patch`
- `RepoForge: Run Validation`
- `RepoForge: Open Last Patch`
- `RepoForge: Open Last Validation`

## Patch + Validation Workflow

RepoForge v0.4 adds an explicit after-model workflow for patch review and verification:

1. Copy a model response or raw unified diff to the clipboard.
2. Run `RepoForge: Parse Patch From Clipboard`.
3. Run `RepoForge: Preview Patch`.
4. Review the summary in the sidebar or the generated Markdown preview.
5. Run `RepoForge: Apply Last Patch` and confirm the apply step.
6. Run `RepoForge: Run Validation` and confirm the selected command.
7. Inspect the saved patch and validation artifacts under `.repoforge/`.

The patch workflow:

- parses unified diffs from raw text or fenced `diff` blocks,
- saves the extracted patch and preview artifacts under `.repoforge/`,
- uses `git apply --check` before any apply attempt,
- blocks patches with parser diagnostics or paths outside the workspace,
- and does not stage, commit, or resolve conflicts.

The validation workflow:

- shows detected repository validation commands,
- only runs after an explicit user confirmation,
- captures stdout, stderr, exit code, and duration,
- saves a trimmed JSON result plus Markdown summary,
- and never auto-runs as part of patch apply.

## Modes

### Codex Companion Mode

Codex mode writes a compact, execution-focused handoff. It favors code maps and selected full files, keeps instructions short, and includes validation commands detected from the repository.

Use it when the goal is a tight implementation task and the agent should spend more budget on code than on narrative.

### Local Qwen / OpenCode Mode

Local Qwen/OpenCode mode writes a longer reasoning-oriented handoff. It includes task context, project memory, token budget details, repo summary, suggested work plan, selected files, code map, optional logs, constraints, and validation commands.

Use it when the target model can handle longer context and the goal is broader analysis or multi-step reasoning.

### Continue Handoff Mode

Continue mode writes a shorter VS Code-oriented handoff with task context, selected files, constraints, and validation.

## `.repoforge/` Output Structure

RepoForge writes its artifacts under `.repoforge/`:

```text
.repoforge/
├── project-memory.md
├── last-context.md
├── last-context.json
├── last-handoff.md
├── last-patch.diff
├── last-patch-preview.json
├── last-patch-preview.md
├── last-patch-result.json
├── last-validation.json
├── last-validation.md
├── profiles.json
├── tmp/
│   └── patch-<timestamp>.diff
└── history/
    ├── context-<timestamp>.md
    ├── context-<timestamp>.json
    ├── handoff-<timestamp>.md
    ├── patch-<timestamp>.diff
    ├── patch-<timestamp>-preview.json
    ├── patch-<timestamp>-preview.md
    ├── patch-<timestamp>-result.json
    ├── validation-<timestamp>.json
    └── validation-<timestamp>.md
```

`last-context.md` and `last-context.json` are kept for backward compatibility.

`last-handoff.md`, patch artifacts, validation results, and the `history/` copies make it easy to inspect what happened after the fact.

## Parser Support

RepoForge uses parser metadata to build the code map.

- TypeScript, JavaScript, JSX, and TSX use the TypeScript compiler API through the regex backend wrapper.
- Python uses a bundled `python3` AST bridge when available. It extracts imports, classes, methods as `ClassName.method`, functions, async functions, constants, line numbers, and compact signatures. If parsing fails, RepoForge falls back without crashing the scan and records diagnostics.
- Rust uses a stronger rust-aware scanner. It extracts `use`, `mod`, `struct`, `enum`, `trait`, `type`, `const`, `static`, free functions, `impl Type`, `impl Trait for Type`, and methods as `Type.method`.
- Markdown headings are mapped as symbols.
- Go and Java are still basic regex scanners.

Rust support is intentionally not rust-analyzer-grade yet. Full tree-sitter or language-server-backed parsing remains future work.

## Git Diff-Aware Context

When the workspace is a Git repository, RepoForge reads both working tree and staged diffs.

Context packs include:

- changed files,
- compact hunk metadata,
- short diff previews,
- relevance reasons that prioritize changed files and changed hunks.

Full diffs are not included by default to avoid bloated packs.

## Tokenizer Profiles

RepoForge supports lightweight tokenizer profiles:

- `gpt-4-estimate`: `ceil(chars / 4)`
- `qwen-estimate`: `ceil(chars / 3.6)`
- `llama-estimate`: `ceil(chars / 3.8)`
- `chars-only`: raw character count

Codex mode defaults to `gpt-4-estimate`.
Local Qwen mode defaults to `qwen-estimate`.

The original `js-tiktoken` estimator remains available for the internal token estimates used by the extension.

## Budget Optimizer

Context pack generation tries to fit the requested budget before writing the final pack.

Priority order is:

1. manual full-file selections,
2. changed files,
3. high-relevance suggestions,
4. lower-priority optional context.

When needed, RepoForge downgrades lower-priority full files to snippets, snippets to code maps, and low-priority code map entries to dropped entries. It records warnings instead of silently discarding important context.

## Task Profiles

Task profiles are saved in `.repoforge/profiles.json`.

Each profile stores:

- profile name,
- task text,
- mode,
- context limit,
- reserved output tokens,
- tokenizer profile,
- selected files and include modes.

Use `RepoForge: Save Task Profile` and `RepoForge: Load Task Profile`, or save from the sidebar.

## Project Memory

Run `RepoForge: Write Project Memory` to create `.repoforge/project-memory.md`.

RepoForge includes this file in generated packs when present.

## Ignore Rules

RepoForge keeps built-in ignores for heavy or generated paths such as `.git`, `.repoforge`, `node_modules`, `dist`, caches, virtual environments, model weights, archives, images, and logs.

It also loads ignore rules from the workspace root:

- `.gitignore`
- `.repoforgeignore`

`.repoforgeignore` is for RepoForge-specific additions or overrides, including negated rules such as `!important.file`.

## Limitations

- Tokenizer profiles are estimates, not model-exact tokenizers.
- TypeScript, JavaScript, JSX, and TSX code maps use the TypeScript compiler API. Python uses AST when `python3` is available. Rust uses a stronger scanner, not rust-analyzer.
- Go and Java remain basic regex scanners.
- Git status enrichment uses NUL-delimited porcelain output, and diff enrichment uses compact hunk summaries when the workspace is a Git repository.
- Files larger than 1 MB are scanned by metadata but skipped for full reads.
- The sidebar is intentionally simple static HTML, CSS, and JavaScript.
- No network calls, AI API calls, or built-in chat interface.
- No direct OpenCode, Continue, LM Studio, or Codex integration yet.
- Handoff is copy/save based.
- Patch application requires a Git repository and uses `git apply`.
- Patch application does not stage, commit, or resolve conflicts.
- Validation commands only run after an explicit user confirmation.
- Validation history trims large stdout and stderr streams to keep `.repoforge` artifacts small.
- Extension-host integration tests are not wired into the current npm test script yet.

## Roadmap

- Tree-sitter backend.
- rust-analyzer-grade Rust support.
- Parser-grade Go and Java support.
- Richer file picker, search, per-file include mode editing, and live token budget controls.
- Extension-host integration test harness.
- Direct LM Studio streaming.
- More resilient patch conflict handling and partial apply workflows.
- Richer validation profiles and multi-command pipelines.
- Resource monitor for RAM, VRAM, and context pressure.
