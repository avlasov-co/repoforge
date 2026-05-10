# Architecture

RepoForge is intentionally small and pipeline-shaped:

```text
VS Code extension
→ repo scanner
→ parser/code map engine
→ relevance scorer
→ budget optimizer
→ formatter
→ .repoforge output / clipboard handoff
```

The pipeline is designed so each stage can be inspected independently:

- the scanner finds files and metadata,
- the parser/code map engine extracts symbols and structure,
- the relevance scorer ranks candidate files,
- the budget optimizer fits the pack into the requested budget,
- and the formatter emits the final handoff.

## Main Modes

```text
Codex mode = compact execution handoff
Local Qwen/OpenCode mode = long-context reasoning handoff
```

Codex mode keeps the pack concise and implementation-oriented.

Local Qwen/OpenCode mode keeps more context available for broader reasoning and longer prompts.

## Output Boundary

RepoForge stops at Markdown/JSON generation and clipboard handoff.

It does not execute the target agent, apply patches, or send repository contents to a remote model endpoint.
