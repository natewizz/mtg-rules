# mtg-rules

`mtg-rules` turns the official Magic: The Gathering Comprehensive Rules TXT into validated, deterministic, machine-readable data.

It is useful for local rules search, judge utilities, Discord bots, MTG developer tooling, rules-change detection, and experiments that need structured Comprehensive Rules data. It structures the document; it does **not** interpret gameplay semantics.

## Status and version

This is pre-1.0 software. The parser is tested against the current official Comprehensive Rules, but the public API and generated schema may still evolve before 1.0. If Wizards changes the upstream document structure, validation is expected to fail until the parser is updated rather than silently producing incomplete data.

Current version: **v0.2.0**.

## Data and licensing boundary

This project is unofficial Fan Content. It is not approved, endorsed, or affiliated with Wizards of the Coast LLC. Magic: The Gathering and related names are trademarks of Wizards of the Coast. The Comprehensive Rules text is copyrighted by Wizards of the Coast.

The MIT license applies to original `mtg-rules` code only. It does **not** apply to Wizards-owned rules text.

Generated machine-readable JSON may be redistributed under the named data profile `complete-generated-document`, for **free, noncommercial use only**. Required notices are in [NOTICE.md](NOTICE.md) and are also embedded in packaged JSON. The data may not be sold, paywalled, or otherwise monetized. Maintenance donations or sponsorships may be added later without charging for access to the rules data.

This repository still does **not** contain:

- official Wizards TXT files;
- Git-tracked generated JSON containing the complete rules text;
- historical Comprehensive Rules copies; or
- a hosted rules API.

A public homepage lives in `web/`. It explains the project and searches a packaged `rules.json`. That file is not stored in Git. `npm run prepare:web` downloads the current GitHub pre-release into `web/rules.json`, and the Vercel build runs the same step so the hosted page can load it.

`parse` writes local JSON for the user. `package-data` is the only command that produces an approved distributable artifact, and only when the profile is explicit, validation passes, and provenance plus notices are present. Official source TXT is fetched at runtime or supplied locally. Approved JSON belongs in a GitHub **pre-release asset**, not in Git or the npm package. The manual checklist is in [docs/data-release.md](docs/data-release.md). Synthetic fixtures in `tests/fixtures/` remain original and small.

## Installation

The package is not published to npm yet. From a checkout, install dependencies and build it:

```bash
git clone https://github.com/natewizz/mtg-rules.git
cd mtg-rules
npm ci
npm run build
```

The CLI is then available at `node dist/cli.js`. For local package-style use, link it with `npm link` or use the built CLI directly.

## Quick start

These commands use a local temporary directory so the official source and generated output stay outside the repository:

```bash
mkdir -p /tmp/mtg-rules-demo
node dist/cli.js fetch -o /tmp/mtg-rules-demo/MagicCompRules.txt
node dist/cli.js doctor /tmp/mtg-rules-demo/MagicCompRules.txt
node dist/cli.js parse /tmp/mtg-rules-demo/MagicCompRules.txt -o /tmp/mtg-rules-demo/rules.json
node dist/cli.js rule 704.5f --from /tmp/mtg-rules-demo/rules.json
node dist/cli.js package-data --fetch -o /tmp/mtg-rules-demo/packaged/rules.json --profile complete-generated-document
```

For two locally generated documents:

```bash
node dist/cli.js diff /tmp/old-rules.json /tmp/new-rules.json
```

## CLI

Show command help:

```bash
node dist/cli.js --help
node dist/cli.js doctor --help
```

Fetch the current official source:

```bash
node dist/cli.js fetch -o /tmp/MagicCompRules.txt
```

Parse a local source file into deterministic JSON:

```bash
node dist/cli.js parse /tmp/MagicCompRules.txt -o /tmp/rules.json
```

Validate a source file:

```bash
node dist/cli.js validate /tmp/MagicCompRules.txt
node dist/cli.js validate /tmp/MagicCompRules.txt --json
```

Inspect source health:

```bash
node dist/cli.js doctor /tmp/MagicCompRules.txt
node dist/cli.js doctor /tmp/MagicCompRules.txt --json
```

Look up a rule:

```bash
node dist/cli.js rule 704.5f --from /tmp/rules.json
```

Write an approved distributable JSON artifact with required notices. This is distinct from local `parse`:

```bash
node dist/cli.js package-data /tmp/MagicCompRules.txt -o /tmp/mtg-rules-data/rules.json --profile complete-generated-document --source-url https://media.wizards.com/2026/downloads/MagicCompRules.txt
node dist/cli.js package-data --fetch -o /tmp/mtg-rules-data/rules.json --profile complete-generated-document
```

Publishing that pair as a GitHub pre-release asset is a separate manual process. See [docs/data-release.md](docs/data-release.md).

Compare local generated documents:

```bash
node dist/cli.js diff /tmp/old-rules.json /tmp/new-rules.json
node dist/cli.js diff /tmp/old-rules.json /tmp/new-rules.json --json
```

## Static tester

`web/` is a small lookup page for packaged JSON. It is free to use, shows the unofficial notices, and refuses JSON that is not a `complete-generated-document` artifact.

```bash
cp output/data-release/rules.json web/rules.json
npm run web
```

Then open http://127.0.0.1:4173/. Do not commit `web/rules.json`. You can also open a downloaded release JSON with the file picker. GitHub release downloads are often blocked by browser CORS; same-origin `web/rules.json` or a local file is the reliable path.

## Programmatic API

The intended public API is small:

```ts
import { diffRules, getRule, parseRules, validateRules } from 'mtg-rules';

const document = parseRules(sourceText, {
  sourceUrl: 'https://media.wizards.com/.../MagicCompRules.txt',
});

const report = validateRules(document);
const rule = getRule(document, '704.5f');
const changes = diffRules(oldDocument, document);
```

To produce a distributable document, use `packageRulesSource` with the permitted profile. Local `parseRules` output is not a redistributable artifact.

```ts
import { packageRulesSource } from 'mtg-rules';

const packaged = packageRulesSource(sourceText, {
  profile: 'complete-generated-document',
  sourceUrl: 'https://media.wizards.com/.../MagicCompRules.txt',
});
```

The package also exports the rule-ID helpers `isRuleId`, `parseRuleId`, `parentRuleId`, and `compareRuleIds`, plus source, notices, and deterministic serialization helpers. TypeScript declarations are included in the build output.

## Validation and doctor

Validation reports stable machine-readable diagnostics such as:

- `UNCLASSIFIED_LINE`
- `DUPLICATE_RULE_ID`
- `INVALID_RULE_ID`
- `ORPHAN_RULE`
- `MISSING_EFFECTIVE_DATE`

Use `validate --json` when another tool needs structured output. `doctor` composes parsing, provenance, and validation into a source-health report and exits non-zero if the source is not fully understood.

## Local diffing

`diffRules(oldDocument, newDocument)` classifies rules as:

- **added** — ID exists only in the new document;
- **removed** — ID exists only in the old document;
- **changed** — ID exists in both documents but hashes differ; and
- **unchanged** — ID exists in both documents and hashes match.

No semantic rename detection is attempted. A renumbered rule is removed and added. Diff output contains deterministic ID lists, hashes/provenance where available, and no complete rule text by default.

## Data model and rule IDs

Wizards rule numbers are the canonical identifiers:

```text
100
100.1
100.1a
704.5
704.5f
903.10
```

The parsed document includes metadata, sections, flat rule lookup, examples, glossary entries, credits, classification statistics, source provenance, and per-rule SHA-256 hashes. Rules text is normalized for deterministic comparison, not semantically interpreted.

## Examples

Small runnable library examples are in `examples/` and do not contain official rules data:

```bash
npm run example:parse -- /tmp/MagicCompRules.txt
npm run example:lookup -- /tmp/rules.json 704.5f
npm run example:validate -- /tmp/MagicCompRules.txt
npm run example:diff -- /tmp/old-rules.json /tmp/new-rules.json
```

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run check:package
```

The real-source integration test is opt-in and should use a local source or temporary network fetch:

```bash
MTG_RULES_INTEGRATION=1 npm test
# or
MTG_RULES_SOURCE=/tmp/MagicCompRules.txt npm test
```

The package check builds a tarball, checks its contents, installs it into a temporary consumer, verifies public imports and declarations, and invokes the packaged CLI. It does not publish anything. After `package-data` has written a local artifact, `npm run check:data-artifact -- output/data-release/rules.json` verifies notices and provenance. Do not commit that artifact. The GitHub upload steps are in [docs/data-release.md](docs/data-release.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Parser changes should generally include a synthetic fixture showing the format or failure case being addressed. Do not submit official CR files, Git-tracked generated full rules JSON, historical source copies, large copied portions of Wizards text, or private licensing correspondence.

## Project decisions

Short ADRs in `docs/decisions/` record that rule numbers are canonical identifiers, generated output is deterministic, rules text is not semantically interpreted, and generated JSON may be redistributed only through the `complete-generated-document` profile with required notices.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the v0.1.0, v0.1.1, v0.1.2, and v0.2.0 history.

## Non-goals

This release does not provide semantic rule interpretation, semantic diffs, rename detection, historical archives, a hosted API, a database, card data, Scryfall integration, rule explanations, AI, embeddings, automatic data releases, or npm publishing of full rules JSON.
