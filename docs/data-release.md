# Manual data-release checklist

Generated Comprehensive Rules JSON is redistributed only as a **GitHub release asset**, never as a Git-tracked file and never inside the npm package.

This process is **manual**. Do not add CI that publishes data automatically.

## What is published

Attach both files to a **pre-release**:

- `rules.json` — profile `complete-generated-document`
- `NOTICE.txt` — required unofficial / free-use notices

Do not attach the official Wizards TXT. Do not publish the JSON to npm. Do not merge this work to `main` unless that is a separate, explicit decision.

## Checklist

From the repository root, on the intended feature branch (not `main` unless that is separately approved):

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run check:package
```

Then fetch, package, and inspect. `output/` is gitignored:

```bash
node dist/cli.js package-data --fetch -o output/data-release/rules.json --profile complete-generated-document
npm run check:data-artifact -- output/data-release/rules.json
```

Inspect before uploading:

```bash
git status --short --branch
git ls-files
ls -l output/data-release
```

Confirm no `MagicCompRules`, `rules.json`, or `output/` paths appear in `git ls-files`. Then confirm:

- `git status` does not show `rules.json`, `NOTICE.txt` under `output/`, or a Wizards TXT;
- the artifact check printed a Wizards `sourceUrl`, 64-character `sourceSha256`, effective date, `unofficial: true`, and `freeUseOnly: true`;
- `output/data-release/NOTICE.txt` matches `NOTICE.md`.

Create a **pre-release** from the current feature-branch commit. Use a data-specific prerelease tag such as `v0.2.0-data.1`, not a final `v0.2.0` tag on `main`:

```bash
gh release create v0.2.0-data.1 \
  --prerelease \
  --target "$(git rev-parse HEAD)" \
  --title "Comprehensive Rules JSON (pre-release)" \
  --notes-file - \
  output/data-release/rules.json \
  output/data-release/NOTICE.txt
```

Release notes must include the unofficial disclaimer, that the JSON is free to use only, the effective date, source URL, source SHA-256, and a reminder that MIT does not apply to Wizards-owned text.

After the upload, confirm the GitHub release file list is only `rules.json` and `NOTICE.txt`, then delete the local `output/data-release` copy if you no longer need it.

## Next CR update

Repeat this checklist. Bump the data tag (`v0.2.0-data.2`, …). Do not overwrite Git history with rules JSON.
