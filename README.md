# mtg-rules

`mtg-rules` turns the official Magic: The Gathering Comprehensive Rules TXT into validated, deterministic, machine-readable data.

It is useful for local rules search, judge utilities, Discord bots, MTG developer tooling, rules-change detection, and experiments that need structured Comprehensive Rules data. It structures the document; it does **not** interpret gameplay semantics.

## Status and version

This is pre-1.0 software. The parser is tested against the current official Comprehensive Rules, but the public API and generated schema may still evolve before 1.0. If Wizards changes the upstream document structure, validation is expected to fail until the parser is updated rather than silently producing incomplete data.

Current version: **v0.1.2**.

## Data and licensing boundary

The complete Comprehensive Rules text is copyrighted by Wizards of the Coast. While permission to redistribute generated rules representations is unresolved, this repository does **not** contain or distribute:

- official Wizards TXT files;
- generated JSON containing the complete rules text;
- historical Comprehensive Rules copies;
- public downloadable rules data; or
- a hosted rules API or website.

The CLI fetches the current TXT from an official Wizards page, or accepts a local file supplied by the user. Fetched source and generated output remain local. Synthetic fixtures in `tests/fixtures/` are original and intentionally small. Local `diff` operates on user-supplied/generated documents and reports IDs and hashes without creating a hosted archive.

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

Compare local generated documents:

```bash
node dist/cli.js diff /tmp/old-rules.json /tmp/new-rules.json
node dist/cli.js diff /tmp/old-rules.json /tmp/new-rules.json --json
```

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

The package also exports the rule-ID helpers `isRuleId`, `parseRuleId`, `parentRuleId`, and `compareRuleIds`, plus source and deterministic serialization helpers. TypeScript declarations are included in the build output.

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

The package check builds a tarball, checks its contents, installs it into a temporary consumer, verifies public imports and declarations, and invokes the packaged CLI. It does not publish anything.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Parser changes should generally include a synthetic fixture showing the format or failure case being addressed. Do not submit official CR files, generated full rules JSON, historical source copies, large copied portions of Wizards text, or private licensing correspondence.

## Project decisions

Short ADRs in `docs/decisions/` record that rule numbers are canonical identifiers, generated output is deterministic, and rules text is not semantically interpreted.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the v0.1.0, v0.1.1, and v0.1.2 history.

## Non-goals

This release does not provide semantic rule interpretation, semantic diffs, rename detection, historical archives, public rules data, a hosted API, a website, web search, a database, card data, Scryfall integration, rule explanations, AI, embeddings, automatic releases, or npm publishing.
