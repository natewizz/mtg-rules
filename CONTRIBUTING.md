# Contributing to mtg-rules

Report problems and upgrade requests as issues. Do not open a pull request. Pull requests from anyone other than the repository owner are closed.

Use the issue templates:

- [New rules edition](https://github.com/natewizz/mtg-rules/issues/new?template=rules-edition.yml) when Wizards publishes a new Comprehensive Rules file.
- [Schema change](https://github.com/natewizz/mtg-rules/issues/new?template=schema-change.yml) when an app needs a different field in the packaged JSON.
- Parser bug and feature request templates remain for those cases.

Do not attach the official rules file or paste rules text into an issue.

## Maintainer setup

- Node.js 22+
- npm

```bash
npm ci
```

Run the local quality checks:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run check:package
```

The real Wizards-source integration test is opt-in:

```bash
MTG_RULES_INTEGRATION=1 npm test
```

Or provide a locally downloaded source without committing it:

```bash
MTG_RULES_SOURCE=/tmp/MagicCompRules.txt npm test
```

## Parser changes

A parser change should generally include a small synthetic fixture demonstrating the format or failure case it addresses. Do not copy large portions of the official Comprehensive Rules into fixtures.

The parser is intentionally conservative: meaningful unknown source lines should fail validation rather than disappear silently. If Wizards changes the upstream structure, update the parser and add a focused fixture explaining the change.

## Data and licensing

Wizards has permitted redistribution of generated machine-readable Comprehensive Rules JSON for free, unofficial use. That does not change how contributions should treat source files.

Do not submit or commit:

- official Comprehensive Rules TXT files;
- generated full rules JSON, including `package-data` output;
- historical Comprehensive Rules copies;
- large copied portions of Wizards rules text; or
- private Wizards correspondence.

Keep `parse` output and `package-data` artifacts local or on a reviewed GitHub pre-release asset. Do not add them to Git, `web/rules.json`, or the npm package. Maintainers publishing data must follow [docs/data-release.md](docs/data-release.md). Keep synthetic fixtures original and small. The MIT license covers original code only; Wizards-owned text remains subject to the notices in `NOTICE.md`.

## Maintainer releases

Before changing `main`:

- add or update tests for behavior changes;
- include a synthetic fixture for parser changes;
- run formatting, lint, tests, build, and package checks;
- update documentation when public behavior changes; and
- inspect `git diff`, `git ls-files`, and `npm pack --dry-run` for accidental source data.

Do not publish npm packages from a pull request. Approved generated JSON, if published, must be a reviewed release asset with `NOTICE.txt` and `latest.json`, and must not be Git-tracked. Refresh the committed `latest.json` pointer when the data tag changes. The steps are in [docs/data-release.md](docs/data-release.md).
