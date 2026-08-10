# Contributing to mtg-rules

Thanks for helping improve `mtg-rules`.

## Requirements and setup

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

## Data and licensing restrictions

Do not submit or commit:

- official Comprehensive Rules TXT files;
- generated full rules JSON;
- historical Comprehensive Rules copies;
- large copied portions of Wizards rules text; or
- private Wizards correspondence.

Fetched source and generated output must remain local while redistribution permission is unresolved. Keep synthetic fixtures original and small.

## Pull requests

Before opening a PR:

- add or update tests for behavior changes;
- include a synthetic fixture for parser changes;
- run formatting, lint, tests, build, and package checks;
- update documentation when public behavior changes; and
- inspect `git diff`, `git ls-files`, and `npm pack --dry-run` for accidental source data.

Do not publish npm packages, GitHub releases, or generated rules data from a PR.
