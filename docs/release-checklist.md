# Release Checklist

## Local Validation

```bash
npm install
npm run compile
npm test
npm run package
```

## Release Tagging

```bash
git status
git tag v0.3.0
```

Do not create the tag until the release is approved.

## Notes

- Verify the generated `.vsix` before publishing.
- Confirm the extension entrypoint still points at the compiled `dist/` output.
- Keep generated release artifacts out of the commit unless intentionally shipping them.
